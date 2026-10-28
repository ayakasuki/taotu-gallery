/**
 * 图库路径监听服务
 * 使用目录级 fs.watch 监听本地图库和自定义路径变化
 */
import path from 'path';
import fs from 'fs';
import config from '../config/index.js';
import configService from './configService.js';
import imageService from './imageService.js';
import logger from '../config/logger.js';
import imageProcessor from '../utils/imageProcessor.js';
import db from '../db/index.js';
import pathUtils from '../utils/pathUtils.js';
import conditionTagService from './conditionTagService.js';

const directoryWatchers = new Map();
const watchDebounceTimers = new Map();
const pendingWatchFiles = new Set();
let watchQueueRunning = false;
const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.ico', '.avif'];
const activeScanPaths = new Set();
const indexingPathKeys = new Set();

function isDerivedGalleryAsset(filePath) {
  const relative = path.relative(config.galleryDir, filePath).replace(/\\/g, '/');
  return relative === '.derived' || relative.startsWith('.derived/');
}

function shouldIgnoreFilename(filePath, ignoreFilenameParts = []) {
  const filename = path.basename(filePath).toLowerCase();
  return ignoreFilenameParts.some((part) => {
    const value = String(part || '').trim().toLowerCase();
    return value && filename.includes(value);
  });
}

function belongsToConfiguredPath(filePath, configuredPath) {
  const fileKey = pathUtils.toCanonicalRelativePath(filePath);
  const rootKey = pathUtils.toCanonicalRelativePath(configuredPath).replace(/\/$/, '');
  return fileKey === rootKey || fileKey.startsWith(`${rootKey}/`);
}

// 启动监听
async function startWatching() {
  if (directoryWatchers.size) {
    logger.warn('图库路径监听已在运行');
    return;
  }

  const pathsConfig = await configService.readPaths();
  const watchPaths = [config.galleryDir];

  // 添加自定义路径
  if (pathsConfig.customPaths) {
    for (const cp of pathsConfig.customPaths) {
      if (cp.path && fs.existsSync(cp.path)) {
        watchPaths.push(cp.path);
      }
    }
  }

  logger.info(`开始监听图库目录（目录级监听）: ${watchPaths.join(', ')}`);
  for (const watchPath of watchPaths) await watchDirectoryTree(watchPath);
}

async function watchDirectoryTree(directoryPath) {
  let directory;
  try {
    directory = await fs.promises.realpath(directoryPath);
  } catch {
    return;
  }
  const key = path.resolve(directory);
  if (directoryWatchers.has(key)) return;

  let watcher;
  try {
    watcher = fs.watch(directory, { persistent: true }, (eventType, filename) => {
      if (filename) queueWatchEvent(directory, String(filename), eventType);
    });
  } catch (error) {
    logger.warn(`目录监听失败: ${directory} - ${error.message}`);
    return;
  }
  directoryWatchers.set(key, watcher);
  watcher.on('error', error => {
    logger.warn(`目录监听异常: ${directory} - ${error.message}`);
    watcher.close();
    directoryWatchers.delete(key);
  });

  let entries;
  try {
    entries = await fs.promises.readdir(directory, { withFileTypes: true });
  } catch (error) {
    logger.warn(`读取监听目录失败: ${directory} - ${error.message}`);
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      await watchDirectoryTree(path.join(directory, entry.name));
    }
  }
}

function queueWatchEvent(directory, filename, eventType) {
  const filePath = path.join(directory, filename);
  const previousTimer = watchDebounceTimers.get(filePath);
  if (previousTimer) clearTimeout(previousTimer);
  const timer = setTimeout(() => {
    watchDebounceTimers.delete(filePath);
    pendingWatchFiles.add(filePath);
    if (eventType === 'rename') {
      fs.promises.stat(filePath).then(stat => {
        if (stat.isDirectory()) return watchDirectoryTree(filePath);
      }).catch(() => closeDirectoryWatchersUnder(filePath));
    }
    drainWatchQueue();
  }, 250);
  watchDebounceTimers.set(filePath, timer);
}

async function drainWatchQueue() {
  if (watchQueueRunning) return;
  watchQueueRunning = true;
  try {
    while (pendingWatchFiles.size) {
      const [filePath] = pendingWatchFiles;
      pendingWatchFiles.delete(filePath);
      const ext = path.extname(filePath).toLowerCase();
      if (!imageExts.includes(ext) || isDerivedGalleryAsset(filePath)) continue;

      try {
        const stat = await waitForStableFile(filePath);
        if (!stat) {
          await handleDeletedImage(filePath);
          continue;
        }
        const currentPathsConfig = await configService.readPaths();
        const pathEntry = (currentPathsConfig.customPaths || []).find(entry => belongsToConfiguredPath(filePath, entry.path));
        if (pathEntry && shouldIgnoreFilename(filePath, pathEntry.ignoreFilenameParts || [])) continue;
        logger.info(`检测到新图片: ${filePath}`);
        await handleNewImage(filePath);
      } catch (error) {
        logger.warn(`处理监听文件失败: ${filePath} - ${error.message}`);
      }
    }
  } finally {
    watchQueueRunning = false;
    if (pendingWatchFiles.size) drainWatchQueue();
  }
}

async function waitForStableFile(filePath) {
  let previousSize = -1;
  let stableChecks = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) return null;
      if (stat.size > 0 && stat.size === previousSize) stableChecks++;
      else stableChecks = 0;
      if (stableChecks >= 2) return stat;
      previousSize = stat.size;
    } catch {
      return null;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  return fs.promises.stat(filePath).catch(() => null);
}

function closeDirectoryWatchersUnder(targetPath) {
  const root = path.resolve(targetPath);
  for (const [directory, watcher] of directoryWatchers) {
    if (directory === root || directory.startsWith(`${root}${path.sep}`)) {
      watcher.close();
      directoryWatchers.delete(directory);
    }
  }
}

// 处理新图片
async function handleNewImage(filePath) {
  const pathKey = pathUtils.getPathKey(filePath);
  if (indexingPathKeys.has(pathKey)) return false;
  indexingPathKeys.add(pathKey);
  try {
    const relativePath = pathUtils.toCanonicalRelativePath(filePath);
    const pathKey = pathUtils.getPathKey(filePath);
    const filename = path.basename(filePath);

    // 检查是否已存在
    const existing = await db('images').where({ path_key: pathKey }).first();
    if (existing) return;

    // 获取图片元信息
    const meta = await imageProcessor.getImageMeta(filePath);
    await imageProcessor.generateDerivedThumbnails(filePath);
    const fileSize = fs.statSync(filePath).size;

    // 插入数据库
    const hashPath = imageService.generateHashPath(filename);
    await db('images').insert({
      filename,
      path: relativePath,
      path_key: pathKey,
      hash_path: hashPath,
      width: meta.width,
      height: meta.height,
      size_bytes: fileSize,
      mime_type: meta.mime_type,
      avg_color: meta.avg_color,
      orientation: meta.orientation,
      upload_source: 'local'
    });

    logger.info(`新图片已索引: ${filename} -> ${hashPath}`);

    // 对新图片执行条件标签
    try {
      const newImage = await db('images').where({ path: relativePath }).first();
      if (newImage) {
        const matched = await conditionTagService.tagImageByConditions(newImage.id);
        if (matched.length > 0) {
          for (const cond of matched) {
            await conditionTagService.insertConditionTag(newImage.id, cond);
          }
          logger.info(`新图片条件标签: ${filename} 匹配 ${matched.length} 个条件`);
        }
      }
    } catch (condErr) {
      logger.warn(`新图片条件标签执行失败: ${condErr.message}`);
    }
  } catch (err) {
    logger.error(`图片索引失败: ${filePath} - ${err.message}`);
  } finally {
    indexingPathKeys.delete(pathKey);
  }
}

// 处理删除的图片
async function handleDeletedImage(filePath) {

  try {
    const relativePath = pathUtils.toRelativePath(filePath);
    await db('images').where({ path: relativePath }).del();
    logger.info(`图片记录已删除: ${relativePath}`);
  } catch (err) {
    logger.error(`图片删除处理失败: ${filePath} - ${err.message}`);
  }
}

// 停止监听
function stopWatching() {
  for (const watcher of directoryWatchers.values()) watcher.close();
  directoryWatchers.clear();
  for (const timer of watchDebounceTimers.values()) clearTimeout(timer);
  watchDebounceTimers.clear();
  pendingWatchFiles.clear();
  logger.info('图库路径监听已停止');
}

function isLocalPath(scanPath) {
  return !/^(smb|s3|ftp):\/\//i.test(String(scanPath || ''));
}

function normalizeName(name) {
  return String(name || '').trim();
}

function createConflictError(message) {
  const err = new Error(message);
  err.statusCode = 409;
  return err;
}

async function resolveNewTagIds(newTags = [], options = {}) {
  if (!newTags.length) return [];
  const reuseExisting = options.reuseExisting === true;

  const publicTags = await configService.readTags();
  if (!publicTags.nextId) publicTags.nextId = 20;
  const existingAll = [...(publicTags.combinable || []), ...(publicTags.nonCombinable || [])];
  const maxId = existingAll.reduce((max, t) => Math.max(max, typeof t.id === 'number' ? t.id : 0), 0);
  if (publicTags.nextId <= maxId) publicTags.nextId = maxId + 1;

  const tagIds = [];
  const seen = new Set();
  for (const rawTagName of newTags) {
    const tagName = normalizeName(rawTagName);
    if (!tagName) continue;
    const key = tagName.toLowerCase();
    if (seen.has(key)) throw createConflictError(`新建标签「${tagName}」重复，请保留一个`);
    seen.add(key);

    const existing = existingAll.find(t => String(t.name).toLowerCase() === key);
    if (existing) {
      if (reuseExisting) {
        tagIds.push(existing.id);
        continue;
      }
      throw createConflictError(`公共标签名「${tagName}」已存在，请从已有标签中选择`);
    }

    const newId = publicTags.nextId++;
    if (!publicTags.combinable) publicTags.combinable = [];
    publicTags.combinable.push({ id: newId, name: tagName, display_name: tagName, combinable: true });
    existingAll.push({ id: newId, name: tagName, display_name: tagName, combinable: true });
    tagIds.push(newId);
  }

  await configService.writeTags(publicTags);
  return [...new Set(tagIds.map(id => Number(id)).filter(Number.isInteger))];
}

async function resolveAlbumId({ albumId, albumName, userId }) {
  if (albumId) return albumId;
  const normalizedAlbumName = normalizeName(albumName);
  if (!normalizedAlbumName) return null;

  const query = db('albums').whereRaw('LOWER(name) = LOWER(?)', [normalizedAlbumName]);
  if (userId) query.andWhere({ user_id: userId });
  else query.whereNull('user_id');
  const existing = await query.first();
  if (existing) throw createConflictError(`相册名「${normalizedAlbumName}」已存在，请从已有相册中选择`);

  const [id] = await db('albums').insert({
    name: normalizedAlbumName,
    user_id: userId || null,
    is_public: false
  });
  return id;
}

async function indexImageFile({ filePath, albumId = null, tagIds = [], userId = null, makePublic = false }) {
  const relativePath = pathUtils.toCanonicalRelativePath(filePath);
  const pathKey = pathUtils.getPathKey(filePath);
  if (indexingPathKeys.has(pathKey)) return false;
  indexingPathKeys.add(pathKey);
  try {
  const existing = await db('images').where({ path_key: pathKey }).first();
  if (existing) {
    const thumbPaths = imageProcessor.getExistingThumbnailPath(filePath, 'thumb');
    const mediumPaths = imageProcessor.getExistingThumbnailPath(filePath, 'medium');
    const hasThumb = thumbPaths.some(thumbnailPath => fs.existsSync(thumbnailPath));
    const hasMedium = mediumPaths.some(thumbnailPath => fs.existsSync(thumbnailPath));
    if (!hasThumb || !hasMedium) {
      await imageProcessor.generateDerivedThumbnails(filePath).catch(err => {
        logger.warn(`补生成缩略图失败: ${filePath} - ${err.message}`);
      });
    }
    if (makePublic && !existing.is_public) {
      await db('images').where({ id: existing.id }).update({ is_public: 1, updated_at: db.fn.now() });
    }
    for (const tagId of tagIds) {
      try {
        await db('image_tags').insert({
          image_id: existing.id,
          tag_id: tagId,
          source: 'manual'
        }).onConflict(['image_id', 'tag_id']).ignore();
      } catch {}
    }
    return false;
  }

  const meta = await imageProcessor.getImageMeta(filePath);
  await imageProcessor.generateDerivedThumbnails(filePath);
  const fileSize = fs.statSync(filePath).size;
  const hashPath = imageService.generateHashPath(path.basename(filePath));

  const [imageId] = await db('images').insert({
    filename: path.basename(filePath),
    path: relativePath,
    path_key: pathKey,
    hash_path: hashPath,
    width: meta.width,
    height: meta.height,
    size_bytes: fileSize,
    mime_type: meta.mime_type,
    avg_color: meta.avg_color,
    orientation: meta.orientation,
    upload_source: 'local',
    album_id: albumId,
    uploader_id: userId || null,
    is_public: !!makePublic
  });

  for (const tagId of tagIds) {
    try {
      await db('image_tags').insert({
        image_id: imageId,
        tag_id: tagId,
        source: 'manual'
      }).onConflict(['image_id', 'tag_id']).ignore();
    } catch {}
  }

  return true;
  } finally {
    indexingPathKeys.delete(pathKey);
  }
}

function createScanControlError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function collectImageFiles(scanPath, recursive, shouldStop = null) {
  const files = [];
  const visit = async (directory) => {
    if (await shouldStop?.()) throw createScanControlError('SCAN_CANCELLED', '扫描已终止');
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && recursive && !entry.name.startsWith('.')) {
        await visit(fullPath);
      } else if (entry.isFile() && imageExts.includes(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  };
  await visit(scanPath);
  return files;
}

async function scanPathEntry({
  scanPath,
  recursive = true,
  albumId = null,
  tagIds = [],
  userId = null,
  makePublic = false,
  ignoreFilenameParts = [],
  onProgress = null,
  shouldStop = null,
  waitIfPaused = null
}) {
  const scanKey = pathUtils.toCanonicalRelativePath(scanPath);
  if (activeScanPaths.has(scanKey)) return { added: 0, skipped: 0, alreadyRunning: true };
  activeScanPaths.add(scanKey);
  let added = 0;
  let skipped = 0;

  try {
    const files = await collectImageFiles(scanPath, recursive !== false, shouldStop);
    const candidates = files.filter(filePath => !isDerivedGalleryAsset(filePath));
    const total = candidates.length;
    await onProgress?.({ total, processed: 0, added, skipped });

    for (const filePath of candidates) {
      if (await shouldStop?.()) {
        throw createScanControlError('SCAN_CANCELLED', '扫描已终止');
      }
      await waitIfPaused?.();
      if (await shouldStop?.()) {
        throw createScanControlError('SCAN_CANCELLED', '扫描已终止');
      }

      if (shouldIgnoreFilename(filePath, ignoreFilenameParts)) {
        skipped++;
      } else {
        try {
          const inserted = await indexImageFile({ filePath, albumId, tagIds, userId, makePublic });
          if (inserted) added++;
          else skipped++;
        } catch (err) {
          logger.error(`索引失败: ${filePath} - ${err.message}`);
          skipped++;
        }
      }
      await onProgress?.({ total, processed: added + skipped, added, skipped });
    }

    if (albumId) {
      const [{ cnt }] = await db('images').where({ album_id: albumId }).count('* as cnt');
      await db('albums').where({ id: albumId }).update({ image_count: cnt });
    }

    return { added, skipped, total, processed: added + skipped };
  } finally {
    activeScanPaths.delete(scanKey);
  }
}

// 扫描并索引所有图片
async function scanAndIndexAll(options = {}) {

  const pathsConfig = await configService.readPaths();
  const scanEntries = [{
    path: config.galleryDir,
    recursive: true,
    albumId: null,
    albumName: null,
    tagIds: [],
    newTagNames: []
  }];

  if (pathsConfig.customPaths) {
    for (const cp of pathsConfig.customPaths) {
      if (cp.path) scanEntries.push(cp);
    }
  }

  let added = 0;
  let skipped = 0;
  let pathCount = 0;
  const errors = [];

  for (const entry of scanEntries) {
    if (!entry.path || !isLocalPath(entry.path) || !fs.existsSync(entry.path)) {
      if (entry.path && !isLocalPath(entry.path)) errors.push({ path: entry.path, message: '远程路径暂不支持直接扫描' });
      else if (entry.path) errors.push({ path: entry.path, message: '路径不存在' });
      continue;
    }

    try {
      pathCount++;
      const finalAlbumId = await resolveAlbumId({
        albumId: entry.albumId || null,
        albumName: entry.albumName || null,
        userId: options.userId
      });
      const newTagIds = await resolveNewTagIds(entry.newTagNames || [], { reuseExisting: true });
      const result = await scanPathEntry({
        scanPath: entry.path,
        recursive: entry.recursive !== false,
        albumId: finalAlbumId,
        tagIds: [...new Set([...(entry.tagIds || []), ...newTagIds].map(id => Number(id)).filter(Number.isInteger))],
        userId: options.userId || null,
        makePublic: !!entry.makePublic,
        ignoreFilenameParts: entry.ignoreFilenameParts || [],
        onProgress: options.onProgress,
        shouldStop: options.shouldStop,
        waitIfPaused: options.waitIfPaused
      });
      added += result.added;
      skipped += result.skipped;
    } catch (err) {
      logger.error(`路径扫描失败: ${entry.path} - ${err.message}`);
      if (['SCAN_CANCELLED', 'SCAN_PATH_DELETED'].includes(err.code)) throw err;
      errors.push({ path: entry.path, message: err.message });
    }
  }

  logger.info(`扫描完成: 新增 ${added}, 跳过 ${skipped}`);

  // 扫描完成后对所有图片执行条件标签
  if (added > 0) {
    try {
      logger.info('扫描完成，开始执行条件标签...');
      const tagResult = await conditionTagService.tagImagesByConditions(null, null, false);
      logger.info(`条件标签完成: ${tagResult.message || `标记 ${tagResult.tagged} 张图片`}`);
    } catch (condErr) {
      logger.warn(`扫描后条件标签执行失败: ${condErr.message}`);
    }
  }

  return { added, skipped, pathCount, errors };
}

// 扫描指定路径（支持相册和标签）
async function scanSinglePath({ targetPath, recursive, albumId, tagIds, newTags, userId, makePublic = false, ignoreFilenameParts = [], onProgress = null, shouldStop = null, waitIfPaused = null }) {
  if (!isLocalPath(targetPath)) {
    throw new Error('远程路径暂不支持直接扫描');
  }
  if (!fs.existsSync(targetPath)) {
    throw new Error('路径不存在');
  }

  const finalAlbumId = await resolveAlbumId({ albumId, userId });
  const allTagIds = [...new Set([
    ...(tagIds || []),
    ...(await resolveNewTagIds(newTags || [], { reuseExisting: true }))
  ].map(id => Number(id)).filter(Number.isInteger))];
  const result = await scanPathEntry({
    scanPath: targetPath,
    recursive,
    albumId: finalAlbumId,
    tagIds: allTagIds,
    userId,
    makePublic,
    ignoreFilenameParts,
    onProgress,
    shouldStop,
    waitIfPaused
  });

  logger.info(`路径扫描完成: ${targetPath}, 新增 ${result.added}, 跳过 ${result.skipped}`);
  return { ...result, albumId: finalAlbumId, tagIds: allTagIds, newTagNames: [] };
}

// 递归扫描目录
async function scanDirectory(dirPath, callback) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      await scanDirectory(fullPath, callback);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (imageExts.includes(ext)) {
        await callback(fullPath);
      }
    }
  }
}

export default {
  startWatching,
  stopWatching,
  scanAndIndexAll,
  scanSinglePath
};
