const express = require('express');
const authMiddleware = require('../../middleware/auth');
const configService = require('../../services/configService');
const galleryWatcher = require('../../services/galleryWatcher');

const router = express.Router();

const normalizeDisplayMode = (mode) => mode === 'waterfall' ? 'waterfall' : 'grid';

// 获取图库配置
router.get('/config', authMiddleware, async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    const pathsConfig = await configService.readPaths();
    res.json({
      display: { ...(siteConfig.display || {}), mode: normalizeDisplayMode(siteConfig.display?.mode) },
      upload: siteConfig.upload || { showUrlAfterUpload: true },
      customPaths: pathsConfig.customPaths || []
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
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 扫描指定路径（支持指定相册和标签）
router.post('/scan-path', authMiddleware, async (req, res, next) => {
  try {
    const { path: targetPath, recursive, albumId, albumName, tagIds, newTags } = req.body;
    if (!targetPath) return res.status(400).json({ error: '请提供路径' });

    const db = require('../../db');
    let finalAlbumId = albumId || null;

    // 如果指定了新相册名，创建相册
    if (!finalAlbumId && albumName) {
      const existing = await db('albums').where({ name: albumName }).first();
      if (existing) {
        finalAlbumId = existing.id;
      } else {
        const [id] = await db('albums').insert({
          name: albumName,
          user_id: req.user.id,
          is_public: false
        });
        finalAlbumId = id;
      }
    }

    const result = await galleryWatcher.scanSinglePath({
      targetPath,
      recursive: recursive !== false,
      albumId: finalAlbumId,
      tagIds: tagIds || [],
      newTags: newTags || [],
      userId: req.user.id
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
      tagIds: tagIds || [],
      newTagNames: newTags || []
    };
    if (existingIndex >= 0) existingPaths[existingIndex] = { ...existingPaths[existingIndex], ...savedPath };
    else existingPaths.push(savedPath);
    await configService.writePaths({ galleryPaths: [], customPaths: existingPaths });

    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
