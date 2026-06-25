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
const logger = require('../../config/logger');

const router = express.Router();

// 获取标签配置（管理员：公共标签 + 自己的私有标签）
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const db = require('../../db');

    // 从数据库读取所有标签（管理员看全部，含私有）
    const dbTags = await db('tags').select('*');
    const combinable = [];
    const nonCombinable = [];

    for (const t of dbTags) {
      const tag = {
        id: t.id, name: t.name,
        display_name: t.display_name || t.name,
        combinable: !!t.combinable,
        is_public: !!t.is_public,
        isPublicTag: true
      };
      if (tag.combinable) combinable.push(tag);
      else nonCombinable.push(tag);
    }

    // 只包含当前用户自己的 user_tags
    const userTags = await db('user_tags').where({ user_id: req.user.id });
    for (const ut of userTags) {
      const tag = {
        id: `u${ut.id}`, name: ut.name,
        display_name: ut.display_name || ut.name,
        combinable: !!ut.combinable,
        is_public: !!ut.is_public,
        isUserTag: true
      };
      if (tag.combinable) combinable.push(tag);
      else nonCombinable.push(tag);
    }

    res.json({ combinable, nonCombinable });
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

// 删除标签（直接从数据库删除）
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const tagId = parseInt(req.params.id);
    const db = require('../../db');

    // 删除关联的 image_tags
    await db('image_tags').where({ tag_id: tagId }).del();

    // 删除标签
    await db('tags').where({ id: tagId }).del();

    logger.info(`标签已删除: ID ${tagId}`);
    res.json({ message: '标签已删除' });
  } catch (err) { next(err); }
});

// 立即标签 - 人工标签
router.post('/run/manual', authMiddleware, async (req, res, next) => {
  try {
    const { imageIds, albumIds, tagIds, overwrite } = req.body;

    if (!tagIds) {
      return res.status(400).json({ error: '请选择要应用的标签' });
    }

    const results = [];

    if (imageIds && imageIds.length > 0) {
      const imgResults = await manualTagService.tagImages(imageIds, tagIds, overwrite, req.user.id);
      results.push(...imgResults);
    }

    if (albumIds && albumIds.length > 0) {
      for (const albumId of albumIds) {
        const albumResults = await manualTagService.tagAlbumImages(albumId, tagIds, overwrite, req.user.id);
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
