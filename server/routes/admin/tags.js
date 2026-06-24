/**
 * 管理后台 - 标签管理 API
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const configService = require('../../services/configService');
const tagService = require('../../services/tagService');
const manualTagService = require('../../services/manualTagService');
const conditionTagService = require('../../services/conditionTagService');
const aiTagService = require('../../services/aiTagService');
const tagFileWatcher = require('../../services/tagFileWatcher');

const router = express.Router();

// 获取标签配置
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const tags = await configService.readTags();
    res.json(tags);
  } catch (err) {
    next(err);
  }
});

// 更新标签配置
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const newTags = req.body;
    const result = await tagService.syncTagConfig(newTags);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 立即标签 - 人工标签
router.post('/run/manual', authMiddleware, async (req, res, next) => {
  try {
    const { imageIds, albumIds, tagIds, overwrite } = req.body;

    if (!tagIds || tagIds.length === 0) {
      return res.status(400).json({ error: '请选择要应用的标签' });
    }

    const results = [];

    if (imageIds && imageIds.length > 0) {
      const imgResults = await manualTagService.tagImages(imageIds, tagIds, overwrite);
      results.push(...imgResults);
    }

    if (albumIds && albumIds.length > 0) {
      // 为相册内所有图片打标签
      for (const albumId of albumIds) {
        const albumResults = await manualTagService.tagAlbumImages(albumId, tagIds, overwrite);
        results.push(...albumResults);
      }
    }

    res.json({ message: '人工标签完成', results });
  } catch (err) {
    next(err);
  }
});

// 立即标签 - 条件标签
router.post('/run/condition', authMiddleware, async (req, res, next) => {
  try {
    const { conditionIds, overwrite } = req.body;
    const result = await conditionTagService.tagImagesByConditions(null, conditionIds, overwrite);
    res.json({ message: '条件标签完成', ...result });
  } catch (err) {
    next(err);
  }
});

// 立即标签 - AI 标签（桩）
router.post('/run/ai', authMiddleware, async (req, res, next) => {
  try {
    const { modelIds, overwrite } = req.body;
    const result = await aiTagService.retagAll(modelIds?.[0], overwrite);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 删除所有 AI 标签
router.delete('/ai', authMiddleware, async (req, res, next) => {
  try {
    const count = await aiTagService.deleteAllAiTags();
    res.json({ message: `已删除 ${count} 条 AI 标签` });
  } catch (err) {
    next(err);
  }
});

// 删除所有条件标签
router.delete('/condition', authMiddleware, async (req, res, next) => {
  try {
    const count = await conditionTagService.deleteAllConditionTags();
    res.json({ message: `已删除 ${count} 条条件标签` });
  } catch (err) {
    next(err);
  }
});

// 获取标签同步状态
router.get('/sync-status', authMiddleware, async (req, res) => {
  res.json({ watching: true, message: '标签文件监听中' });
});

// 强制立即同步
router.post('/sync-now', authMiddleware, async (req, res, next) => {
  try {
    const result = await tagFileWatcher.forceSyncNow();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
