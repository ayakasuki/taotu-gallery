const express = require('express');
const authMiddleware = require('../../middleware/auth');
const configService = require('../../services/configService');
const galleryWatcher = require('../../services/galleryWatcher');
const db = require('../../db');
const config = require('../../config');
const pathUtils = require('../../utils/pathUtils');
const albumService = require('../../services/albumService');
const imageProcessor = require('../../utils/imageProcessor');

const router = express.Router();

const normalizeDisplayMode = (mode) => mode === 'waterfall' ? 'waterfall' : 'grid';

function normalizePathForLike(filePath) {
  return pathUtils.normalizePath(pathUtils.toRelativePath(filePath || ''));
}

function withTrailingSlash(filePath) {
  const normalized = normalizePathForLike(filePath);
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

async function getScanMetaForPath(filePath) {
  const normalized = withTrailingSlash(filePath);
  const row = await db('images')
    .where(function() {
      this.where('path', normalized.slice(0, -1)).orWhere('path', 'like', `${normalized}%`);
    })
    .max('created_at as last_scanned_at')
    .count('* as image_count')
    .first();

  return {
    last_scanned_at: row?.last_scanned_at || null,
    image_count: Number(row?.image_count || 0)
  };
}

function inferPathType(filePath, isDefault = false) {
  if (isDefault) return 'default';
  const value = String(filePath || '').toLowerCase();
  if (value.startsWith('smb://')) return 'smb';
  if (value.startsWith('s3://')) return 's3';
  if (value.startsWith('ftp://')) return 'ftp';
  return 'local';
}

function pathExists(filePath, isDefault = false) {
  if (!filePath) return false;
  if (/^(smb|s3|ftp):\/\//i.test(filePath)) return true;
  const absolute = isDefault ? filePath : pathUtils.toAbsolutePath(filePath);
  try {
    return require('fs').existsSync(absolute);
  } catch {
    return false;
  }
}

async function enrichPath(pathEntry, options = {}) {
  const isDefault = Boolean(options.default);
  const filePath = isDefault ? config.galleryDir : pathEntry.path;
  const scanMeta = await getScanMetaForPath(filePath);
  const exists = pathExists(filePath, isDefault);
  return {
    ...pathEntry,
    type: inferPathType(pathEntry.path, isDefault),
    status: exists ? 'normal' : 'warning',
    statusText: exists ? '正常' : '警告',
    last_scanned_at: pathEntry.last_scanned_at || scanMeta.last_scanned_at,
    image_count: scanMeta.image_count
  };
}

// 获取图库配置
router.get('/config', authMiddleware, async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    const pathsConfig = await configService.readPaths();
    const customPaths = await Promise.all((pathsConfig.customPaths || []).map(pathEntry => enrichPath(pathEntry)));
    const defaultPath = await enrichPath({
      path: 'data/gallery/',
      recursive: true,
      albumMode: 'public',
      albumName: '公共图库',
      tagIds: [],
      newTagNames: []
    }, { default: true });

    res.json({
      display: { ...(siteConfig.display || {}), mode: normalizeDisplayMode(siteConfig.display?.mode) },
      upload: siteConfig.upload || { showUrlAfterUpload: true },
      defaultPath,
      customPaths
    });
  } catch (err) {
    next(err);
  }
});

// 更新图库配置
router.put('/config', authMiddleware, async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    if (req.body.display) siteConfig.display = { ...req.body.display, mode: normalizeDisplayMode(req.body.display.mode) };
    if (req.body.upload) siteConfig.upload = req.body.upload;
    await configService.writeSiteConfig(siteConfig);

    // 更新自定义路径
    if (req.body.customPaths) {
      await configService.writePaths({ galleryPaths: [], customPaths: req.body.customPaths });
    }

    res.json({ message: '图库配置已更新' });
  } catch (err) {
    next(err);
  }
});

// 立即扫描所有路径
router.post('/scan', authMiddleware, async (req, res, next) => {
  try {
    const result = await galleryWatcher.scanAndIndexAll();
    res.json({ ...result, pathCount: result.pathCount || 0 });
  } catch (err) {
    next(err);
  }
});

// 扫描指定路径（支持指定相册和标签）
router.post('/scan-path', authMiddleware, async (req, res, next) => {
  try {
    const { path: targetPath, recursive, albumId, albumName, tagIds, newTags, makePublic } = req.body;
    if (!targetPath) return res.status(400).json({ error: '请提供路径' });

    let finalAlbumId = albumId || null;

    // 如果指定了新相册名，创建相册
    if (!finalAlbumId && albumName) {
      const album = await albumService.createAlbum({
        name: albumName,
        user_id: req.user.id,
        is_public: false
      });
      finalAlbumId = album.id;
    }

    const result = await galleryWatcher.scanSinglePath({
      targetPath,
      recursive: recursive !== false,
      albumId: finalAlbumId,
      tagIds: tagIds || [],
      newTags: newTags || [],
      userId: req.user.id,
      makePublic: !!makePublic
    });

    const pathsConfig = await configService.readPaths();
    const existingPaths = pathsConfig.customPaths || [];
    const existingIndex = existingPaths.findIndex(cp => cp.path === targetPath);
    const savedPath = {
      path: targetPath,
      recursive: recursive !== false,
      albumMode: albumName ? 'new' : (finalAlbumId ? 'existing' : 'none'),
      albumId: finalAlbumId,
      albumName: albumName || null,
      makePublic: !!makePublic,
      tagIds: tagIds || [],
      newTagNames: newTags || []
    };
    if (existingIndex >= 0) existingPaths[existingIndex] = { ...existingPaths[existingIndex], ...savedPath };
    else existingPaths.push(savedPath);
    await configService.writePaths({ galleryPaths: [], customPaths: existingPaths });

    res.json({ ...result, pathCount: 1 });
  } catch (err) { next(err); }
});

// 删除自定义路径并清理该路径扫描入库的图片记录与标签关联（不删除原始磁盘文件）
router.post('/delete-path', authMiddleware, async (req, res, next) => {
  try {
    const { path: targetPath } = req.body || {};
    if (!targetPath) return res.status(400).json({ error: '请提供路径' });

    const normalized = normalizePathForLike(targetPath);
    const prefix = withTrailingSlash(targetPath);
    const images = await db('images')
      .where('path', normalized)
      .orWhere('path', 'like', `${prefix}%`)
      .select('id', 'path', 'album_id');
    const imageIds = images.map(image => image.id);
    const albumIds = [...new Set(images.map(image => image.album_id).filter(Boolean))];

    await db.transaction(async trx => {
      if (imageIds.length) {
        await trx('image_tags').whereIn('image_id', imageIds).del();
        await trx('images').whereIn('id', imageIds).del();
      }
      await trx('custom_paths').where({ path: targetPath }).del();
    });

    for (const image of images) {
      const realPath = pathUtils.toAbsolutePath(image.path);
      await imageProcessor.removeDerivedThumbnailsForImage(realPath).catch(() => {});
    }

    for (const albumId of albumIds) {
      const [{ cnt }] = await db('images').where({ album_id: albumId }).count('* as cnt');
      await db('albums').where({ id: albumId }).update({ image_count: cnt });
    }

    res.json({ deletedImages: imageIds.length, deletedRelations: imageIds.length, deletedPath: targetPath });
  } catch (err) { next(err); }
});

module.exports = router;
