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

const SYSTEM_TAGS = [
  { id: '__untagged', name: 'system_untagged', display_name: '未标签', combinable: true, isSystemTag: true },
  { id: '__tagged', name: 'system_tagged', display_name: '已标签', combinable: true, isSystemTag: true }
];

// 获取标签配置（管理员：公共标签 + 自己的私有标签）
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const db = require('../../db');

    // 从数据库读取所有标签（管理员看全部，含私有）
    const dbTags = await db('tags').select('*');
    const combinable = [...SYSTEM_TAGS];
    const nonCombinable = [];

    for (const t of dbTags) {
      const tag = {
        id: t.id, name: t.name,
        display_name: t.display_name || t.name,
        combinable: !!t.combinable,
        mutually_exclusive_with: t.mutually_exclusive_with,
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
    if (err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || err.code === 'WARN_DATA_TRUNCATED') {
      return res.status(400).json({ error: '互斥标签 ID 需要字符串字段支持，请先执行 npx knex migrate:latest' });
    }
    next(err);
  }
});

// 删除标签（直接从数据库删除）
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    if (String(req.params.id).startsWith('__')) {
      return res.status(400).json({ error: '系统标签不可删除' });
    }
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

    const db = require('../../db');
    const user = await db('users').where({ id: req.user.id }).first();
    if (user?.role !== 'admin') {
      const targetImageIds = [...(imageIds || [])];
      if (albumIds && albumIds.length > 0) {
        const albumImages = await db('images').whereIn('album_id', albumIds).select('id');
        targetImageIds.push(...albumImages.map(img => img.id));
      }

      if (targetImageIds.length === 0) {
        return res.status(400).json({ error: '请选择自己的图片' });
      }

      const ownedCountRow = await db('images')
        .whereIn('id', targetImageIds)
        .andWhere({ uploader_id: req.user.id })
        .count('* as count')
        .first();
      if (Number(ownedCountRow.count) !== new Set(targetImageIds).size) {
        return res.status(403).json({ error: '普通用户只能给自己的图片打标签' });
      }

      const userTagIds = tagIds
        .filter(id => typeof id === 'string' && id.startsWith('u'))
        .map(id => parseInt(id.substring(1)));
      if (userTagIds.length !== tagIds.length) {
        return res.status(403).json({ error: '普通用户只能应用自己的私有标签' });
      }
      const validRows = userTagIds.length > 0
        ? await db('user_tags').where({ user_id: req.user.id }).whereIn('id', userTagIds).select('id')
        : [];
      if (validRows.length !== userTagIds.length) {
        return res.status(403).json({ error: '包含无权使用的私有标签' });
      }
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

// 管理员为图片维护图片所属用户的私有标签
router.post('/run/user-private', authMiddleware, async (req, res, next) => {
  try {
    const { imageIds = [], userId, tagIds = [], overwrite = true } = req.body;
    const db = require('../../db');
    const user = await db('users').where({ id: req.user.id }).first();
    if (user?.role !== 'admin') return res.status(403).json({ error: '仅管理员可操作' });

    const targetUserId = parseInt(userId);
    const uniqueImageIds = [...new Set((imageIds || []).map(id => parseInt(id)).filter(Boolean))];
    if (!targetUserId || uniqueImageIds.length === 0) {
      return res.status(400).json({ error: '请选择图片和用户' });
    }

    const ownedCountRow = await db('images')
      .whereIn('id', uniqueImageIds)
      .andWhere({ uploader_id: targetUserId })
      .count('* as count')
      .first();
    if (Number(ownedCountRow.count) !== uniqueImageIds.length) {
      return res.status(403).json({ error: '只能维护图片所属用户的私有标签' });
    }

    const userTagIds = Array.isArray(tagIds) ? tagIds
      .map(id => typeof id === 'string' && id.startsWith('u') ? parseInt(id.substring(1)) : parseInt(id))
      .filter(Boolean) : [];
    let validTagIds = [];
    if (userTagIds.length > 0) {
      const ownedTags = await db('user_tags')
        .where({ user_id: targetUserId })
        .whereIn('id', [...new Set(userTagIds)])
        .select('id');
      validTagIds = ownedTags.map(tag => tag.id);
      if (validTagIds.length !== new Set(userTagIds).size) {
        return res.status(403).json({ error: '包含不属于该用户的私有标签' });
      }
    }

    if (overwrite) {
      await db('image_tags')
        .whereIn('image_id', uniqueImageIds)
        .andWhere({ tag_user_id: targetUserId })
        .whereNotNull('user_tag_id')
        .del();
    }

    for (const imageId of uniqueImageIds) {
      for (const tagId of validTagIds) {
        await db('image_tags').insert({
          image_id: imageId,
          tag_id: -tagId,
          source: 'manual',
          user_tag_id: tagId,
          tag_user_id: targetUserId
        }).onConflict(['image_id', 'tag_id']).ignore();
      }
    }

    res.json({ message: '用户私有标签已更新', imageCount: uniqueImageIds.length, tagCount: validTagIds.length });
  } catch (err) { next(err); }
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
