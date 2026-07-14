/**
 * 管理后台 - 标签管理 API
 */
import express from 'express';

import authMiddleware from '../../middleware/auth.js';
import configService from '../../services/configService.js';
import tagService from '../../services/tagService.js';
import manualTagService from '../../services/manualTagService.js';
import conditionTagService from '../../services/conditionTagService.js';
import aiTagService from '../../services/aiTagService.js';
import tagFileWatcher from '../../services/tagFileWatcher.js';
import logger from '../../config/logger.js';
import db from '../../db/index.js';

const router = express.Router();

const SYSTEM_TAGS = [
  { id: '__untagged', name: 'system_untagged', display_name: '未标签', combinable: true, isSystemTag: true },
  { id: '__tagged', name: 'system_tagged', display_name: '已标签', combinable: true, isSystemTag: true }
];

async function requireAdmin(req, res) {
  const user = await db('users').where({ id: req.user.id }).first();
  if (user?.role !== 'admin') {
    res.status(403).json({ error: '仅管理员可操作' });
    return null;
  }
  return user;
}

function normalizeTagName(name) {
  return String(name || '').trim();
}

function normalizeNewTagNames(names) {
  if (!Array.isArray(names)) return [];
  const seen = new Set();
  const result = [];
  for (const rawName of names) {
    const name = normalizeTagName(rawName);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

async function ensureUserPrivateTags(db, userId, names = []) {
  const normalizedNames = normalizeNewTagNames(names);
  if (!userId || normalizedNames.length === 0) return [];

  const ids = [];
  for (const name of normalizedNames) {
    const existing = await db('user_tags')
      .where({ user_id: userId })
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first();
    if (existing) {
      ids.push(`u${existing.id}`);
      continue;
    }

    const [id] = await db('user_tags').insert({
      user_id: userId,
      name,
      display_name: name,
      combinable: true,
      is_public: false,
      mutually_exclusive_with: null
    });
    ids.push(`u${id}`);
  }
  return ids;
}

async function ensurePlatformTags(db, names = []) {
  const normalizedNames = normalizeNewTagNames(names);
  if (normalizedNames.length === 0) return [];

  const ids = [];
  for (const name of normalizedNames) {
    const existing = await db('tags')
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first();
    if (existing) {
      ids.push(existing.id);
      continue;
    }

    const [id] = await db('tags').insert({
      name,
      display_name: name,
      combinable: true,
      mutually_exclusive_with: null,
      tag_type: 'manual',
      is_public: true
    });
    ids.push(id);
  }
  return ids;
}

function normalizePlatformTagIds(ids = []) {
  const result = [];
  for (const rawId of ids) {
    if (typeof rawId === 'string' && rawId.startsWith('u')) return null;
    const id = Number.parseInt(rawId, 10);
    if (!Number.isInteger(id) || id <= 0) return null;
    if (!result.includes(id)) result.push(id);
  }
  return result;
}

// 获取标签配置（管理员：公共标签 + 自己的私有标签）
router.get('/', authMiddleware, async (req, res, next) => {
  try {
      const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

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
        mutually_exclusive_with: ut.mutually_exclusive_with,
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

// 创建单个公共平台标签（图片编辑弹窗回车创建使用）
router.post('/create', authMiddleware, async (req, res, next) => {
  try {
      const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const name = normalizeTagName(req.body.name);
    if (!name) return res.status(400).json({ error: '标签名不能为空' });

    const existing = await db('tags')
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first();
    if (existing) {
      return res.status(409).json({ error: `公共标签名「${name}」已存在，请换一个名称` });
    }

    const [id] = await db('tags').insert({
      name,
      display_name: req.body.display_name || name,
      combinable: req.body.combinable !== false,
      mutually_exclusive_with: null,
      tag_type: 'manual',
      is_public: true
    });
    const saved = await db('tags').where({ id }).first();
    res.json({
      id: saved.id,
      name: saved.name,
      display_name: saved.display_name || saved.name,
      combinable: !!saved.combinable,
      mutually_exclusive_with: saved.mutually_exclusive_with,
      is_public: !!saved.is_public,
      isPublicTag: true
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '公共标签名已存在，请换一个名称' });
    next(err);
  }
});

// 更新标签配置
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;
    const newTags = req.body;
    const result = await tagService.syncTagConfig(newTags, { userId: req.user.id });
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
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;
    if (String(req.params.id).startsWith('__')) {
      return res.status(400).json({ error: '系统标签不可删除' });
    }
    const tagId = parseInt(req.params.id);

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
    const { imageIds, albumIds, tagIds = [], newTagNames = [], overwrite } = req.body;
      const rawTagIds = Array.isArray(tagIds) ? tagIds : [];
    const targetImageIds = [...(imageIds || [])];
    if (albumIds && albumIds.length > 0) {
      const albumImages = await db('images').whereIn('album_id', albumIds).select('id');
      targetImageIds.push(...albumImages.map(img => img.id));
    }
    if (targetImageIds.length === 0) {
      return res.status(400).json({ error: '请选择图片' });
    }

    const user = await db('users').where({ id: req.user.id }).first();
    if (user?.role !== 'admin') {
      const ownedCountRow = await db('images')
        .whereIn('id', targetImageIds)
        .andWhere({ uploader_id: req.user.id })
        .count('* as count')
        .first();
      if (Number(ownedCountRow.count) !== new Set(targetImageIds).size) {
        return res.status(403).json({ error: '普通用户只能给自己的图片打标签' });
      }
    }

    if (rawTagIds.length === 0 && normalizeNewTagNames(newTagNames).length === 0) {
      return res.status(400).json({ error: '请选择要应用的标签' });
    }

    let finalTagIds = [];
    let createdTagIds = [];

    if (user?.role !== 'admin') {
      const userTagIds = rawTagIds
        .filter(id => typeof id === 'string' && id.startsWith('u'))
        .map(id => parseInt(id.substring(1)));
      if (userTagIds.length !== rawTagIds.length) {
        return res.status(403).json({ error: '普通用户只能应用自己的私有标签' });
      }
      const validRows = userTagIds.length > 0
        ? await db('user_tags').where({ user_id: req.user.id }).whereIn('id', userTagIds).select('id')
        : [];
      if (validRows.length !== userTagIds.length) {
        return res.status(403).json({ error: '包含无权使用的私有标签' });
      }
      createdTagIds = await ensureUserPrivateTags(db, req.user.id, newTagNames);
      finalTagIds = [...rawTagIds, ...createdTagIds];
    } else {
      const platformTagIds = normalizePlatformTagIds(rawTagIds);
      if (platformTagIds === null) {
        return res.status(400).json({ error: '人工标签只能应用平台标签，请勿混入用户私有标签' });
      }
      if (platformTagIds.length > 0) {
        const existingRows = await db('tags').whereIn('id', platformTagIds).select('id');
        if (existingRows.length !== platformTagIds.length) {
          return res.status(400).json({ error: '包含不存在的平台标签' });
        }
      }
      createdTagIds = await ensurePlatformTags(db, newTagNames);
      finalTagIds = [...platformTagIds, ...createdTagIds];
    }

    const results = [];

    if (imageIds && imageIds.length > 0) {
      const imgResults = await manualTagService.tagImages(imageIds, finalTagIds, overwrite, req.user.id);
      results.push(...imgResults);
    }

    if (albumIds && albumIds.length > 0) {
      for (const albumId of albumIds) {
        const albumResults = await manualTagService.tagAlbumImages(albumId, finalTagIds, overwrite, req.user.id);
        results.push(...albumResults);
      }
    }

    res.json({ message: '人工标签完成', results, createdTagIds });
  } catch (err) {
    next(err);
  }
});

// 管理员为图片维护图片所属用户的私有标签
router.post('/run/user-private', authMiddleware, async (req, res, next) => {
  try {
    const { imageIds = [], userId, tagIds = [], newTagNames = [], overwrite = true } = req.body;
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

    const rawTagIds = Array.isArray(tagIds) ? tagIds : [];
    const userTagIds = rawTagIds
      .map(id => typeof id === 'string' && id.startsWith('u') ? parseInt(id.substring(1)) : parseInt(id))
      .filter(Boolean);
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
    const createdTagIds = await ensureUserPrivateTags(db, targetUserId, newTagNames);
    validTagIds = [
      ...validTagIds,
      ...createdTagIds.map(id => parseInt(String(id).replace(/^u/, ''), 10)).filter(Boolean)
    ];

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
    const { conditionIds, overwrite, force } = req.body;
    const shouldForce = force === true || overwrite === true;
    const result = await conditionTagService.tagImagesByConditions(null, conditionIds, shouldForce, { force: shouldForce });
    res.json({ message: result.message || '条件标签完成', ...result });
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

export default router;
