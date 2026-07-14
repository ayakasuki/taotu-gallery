/**
 * 图库路径监听服务
 * 使用 chokidar 监听本地图库和自定义路径变化
 */
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const configService = require('./configService');
const imageService = require('./imageService');
const logger = require('../config/logger');
const imageProcessor = require('../utils/imageProcessor');

let watcher = null;
const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

function isDerivedGalleryAsset(filePath) {
  const relative = path.relative(config.galleryDir, filePath).replace(/\\/g, '/');
  return relative === '.derived' || relative.startsWith('.derived/');
}

// 启动监听
async function startWatching() {
  if (watcher) {
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

  logger.info(`开始监听图库路径: ${watchPaths.join(', ')}`);

  watcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: false,
    depth: 3, // 默认递归 3 层
    ignored: /(^|[\/\\])\.|node_modules/,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
  });

  watcher.on('add', async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!imageExts.includes(ext)) return;
    if (isDerivedGalleryAsset(filePath)) return;

    logger.info(`检测到新图片: ${filePath}`);
    await handleNewImage(filePath);
  });

  watcher.on('unlink', async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!imageExts.includes(ext)) return;

    logger.info(`图片已删除: ${filePath}`);
    await handleDeletedImage(filePath);
  });

  watcher.on('error', (error) => {
    logger.error(`图库路径监听错误: ${error.message}`);
  });
}

// 处理新图片
async function handleNewImage(filePath) {
  const db = require('../db');
  const pathUtils = require('../utils/pathUtils');

  try {
    const relativePath = pathUtils.toRelativePath(filePath);
    const filename = path.basename(filePath);

    // 检查是否已存在
    const existing = await db('images').where({ path: relativePath }).first();
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
      const conditionTagService = require('./conditionTagService');
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
  }
}

// 处理删除的图片
async function handleDeletedImage(filePath) {
  const db = require('../db');
  const pathUtils = require('../utils/pathUtils');

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
  if (watcher) {
    watcher.close();
    watcher = null;
    logger.info('图库路径监听已停止');
  }
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
  const db = require('../db');
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
  const db = require('../db');
  const pathUtils = require('../utils/pathUtils');

  const relativePath = pathUtils.toRelativePath(filePath);
  const existing = await db('images').where({ path: relativePath }).first();
  if (existing) {
    await imageProcessor.generateDerivedThumbnails(filePath).catch(err => {
      logger.warn(`补生成缩略图失败: ${filePath} - ${err.message}`);
    });
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
}

async function scanPathEntry({ scanPath, recursive = true, albumId = null, tagIds = [], userId = null, makePublic = false }) {
  const db = require('../db');
  let added = 0;
  let skipped = 0;

  const scanFn = async (filePath) => {
    if (isDerivedGalleryAsset(filePath)) return;
    try {
      const inserted = await indexImageFile({ filePath, albumId, tagIds, userId, makePublic });
      if (inserted) added++;
      else skipped++;
    } catch (err) {
      logger.error(`索引失败: ${filePath} - ${err.message}`);
    }
  };

  if (recursive !== false) {
    await scanDirectory(scanPath, scanFn);
  } else {
    const entries = fs.readdirSync(scanPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (imageExts.includes(ext)) {
          await scanFn(path.join(scanPath, entry.name));
        }
      }
    }
  }

  if (albumId) {
    const [{ cnt }] = await db('images').where({ album_id: albumId }).count('* as cnt');
    await db('albums').where({ id: albumId }).update({ image_count: cnt });
  }

  return { added, skipped };
}

// 扫描并索引所有图片
async function scanAndIndexAll(options = {}) {
  const db = require('../db');

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
        makePublic: !!entry.makePublic
      });
      added += result.added;
      skipped += result.skipped;
    } catch (err) {
      logger.error(`路径扫描失败: ${entry.path} - ${err.message}`);
      errors.push({ path: entry.path, message: err.message });
    }
  }

  logger.info(`扫描完成: 新增 ${added}, 跳过 ${skipped}`);

  // 扫描完成后对所有图片执行条件标签
  if (added > 0) {
    try {
      const conditionTagService = require('./conditionTagService');
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
async function scanSinglePath({ targetPath, recursive, albumId, tagIds, newTags, userId, makePublic = false }) {
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
    makePublic
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

module.exports = {
  startWatching,
  stopWatching,
  scanAndIndexAll,
  scanSinglePath
};
