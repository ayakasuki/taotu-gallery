/**
 * 用户私有标签管理 API
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const db = require('../../db');

const router = express.Router();

function parseMutualIds(value, { requireUserPrefix = false } = {}) {
  if (value === null || value === undefined || value === '') return [];
  const values = Array.isArray(value) ? value : String(value).split(/[,，.。\s]+/);
  return values
    .map(part => String(part).trim())
    .filter(Boolean)
    .map(part => {
      if (/^u\d+$/i.test(part)) return parseInt(part.slice(1));
      if (requireUserPrefix) {
        const err = new Error('互斥私有标签必须使用 u 前缀 ID');
        err.statusCode = 400;
        throw err;
      }
      return /^\d+$/.test(part) ? parseInt(part) : null;
    })
    .filter(Number.isInteger);
}

function stringifyIds(ids) {
  const unique = [...new Set(ids.filter(Number.isInteger))].sort((a, b) => a - b);
  return unique.length > 0 ? unique.map(id => `u${id}`).join(',') : null;
}

async function syncOwnedMutualGroup(userId, sourceId, mutualIds, sourceCombinable = true) {
  const ownedRows = await db('user_tags').where({ user_id: userId }).select('id', 'combinable', 'mutually_exclusive_with');
  const ownedIds = new Set(ownedRows.map(row => row.id));
  if (!ownedIds.has(sourceId)) {
    const err = new Error('标签不存在');
    err.statusCode = 404;
    throw err;
  }

  const validTargetIds = [...new Set(mutualIds)].filter(id => id !== sourceId && ownedIds.has(id));
  if (validTargetIds.length !== [...new Set(mutualIds)].filter(id => id !== sourceId).length) {
    const err = new Error('只能选择自己的私有标签作为互斥标签');
    err.statusCode = 403;
    throw err;
  }

  const ownedById = new Map(ownedRows.map(row => [row.id, row]));
  const byId = new Map(ownedRows.map(row => [row.id, new Set(parseMutualIds(row.mutually_exclusive_with).filter(id => ownedIds.has(id) && id !== row.id))]));
  byId.set(sourceId, new Set(validTargetIds));

  for (const [id, ids] of byId.entries()) {
    ids.delete(sourceId);
    if (validTargetIds.length > 0 && validTargetIds.includes(id)) ids.add(sourceId);
  }

  const adjacency = new Map([...ownedIds].map(id => [id, new Set()]));
  for (const [id, ids] of byId.entries()) {
    for (const targetId of ids) {
      if (!ownedIds.has(targetId)) continue;
      adjacency.get(id).add(targetId);
      adjacency.get(targetId).add(id);
    }
  }

  const visited = new Set();
  for (const id of ownedIds) {
    if (visited.has(id)) continue;
    const stack = [id];
    const component = [];
    visited.add(id);
    while (stack.length > 0) {
      const current = stack.pop();
      component.push(current);
      for (const next of adjacency.get(current) || []) {
        if (visited.has(next)) continue;
        visited.add(next);
        stack.push(next);
      }
    }
    for (const memberId of component) {
      const nextIds = component.filter(id => id !== memberId);
      await db('user_tags').where({ id: memberId, user_id: userId }).update({
        combinable: nextIds.length > 0 ? false : (memberId === sourceId ? sourceCombinable !== false : !!ownedById.get(memberId)?.combinable),
        mutually_exclusive_with: stringifyIds(nextIds)
      });
    }
  }
}

// 获取当前用户的私有标签
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const tags = await db('user_tags').where({ user_id: req.user.id });
    res.json({ tags });
  } catch (err) { next(err); }
});

// 创建私有标签
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { name, display_name, combinable, mutually_exclusive_with } = req.body;
    if (!name) return res.status(400).json({ error: '标签名不能为空' });

    const [id] = await db('user_tags').insert({
      user_id: req.user.id,
      name,
      display_name: display_name || name,
      combinable: combinable !== false,
      is_public: false,
      mutually_exclusive_with: null
    });
    const mutualIds = parseMutualIds(mutually_exclusive_with, { requireUserPrefix: true });
    if (mutualIds.length > 0) await syncOwnedMutualGroup(req.user.id, id, mutualIds, combinable !== false);
    const saved = await db('user_tags').where({ id, user_id: req.user.id }).first();
    res.json({ id, name, display_name: display_name || name, combinable: !!saved.combinable, mutually_exclusive_with: saved.mutually_exclusive_with });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '标签名已存在' });
    next(err);
  }
});

// 批量管理当前用户图片上的私有标签
router.post('/apply', authMiddleware, async (req, res, next) => {
  try {
    const { imageIds, tagIds = [], mode = 'add' } = req.body;
    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: '请选择图片' });
    }

    const uniqueImageIds = [...new Set(imageIds.map(id => parseInt(id)).filter(Boolean))];
    const rawTagIds = Array.isArray(tagIds) ? tagIds : [];
    const userTagIds = rawTagIds
      .map(id => typeof id === 'string' && id.startsWith('u') ? parseInt(id.substring(1)) : parseInt(id))
      .filter(Boolean);

    const ownedCountRow = await db('images')
      .whereIn('id', uniqueImageIds)
      .andWhere({ uploader_id: req.user.id })
      .count('* as count')
      .first();
    if (Number(ownedCountRow.count) !== uniqueImageIds.length) {
      return res.status(403).json({ error: '只能管理自己的图片' });
    }

    let validTagIds = [];
    if (userTagIds.length > 0) {
      const ownedTags = await db('user_tags')
        .where({ user_id: req.user.id })
        .whereIn('id', [...new Set(userTagIds)])
        .select('id');
      validTagIds = ownedTags.map(tag => tag.id);
      if (validTagIds.length !== new Set(userTagIds).size) {
        return res.status(403).json({ error: '包含无权使用的私有标签' });
      }
    }

    if ((mode === 'add' || mode === 'remove') && validTagIds.length === 0) {
      return res.status(400).json({ error: '请选择私有标签' });
    }

    if (mode === 'replace' || mode === 'clear') {
      await db('image_tags')
        .whereIn('image_id', uniqueImageIds)
        .andWhere({ tag_user_id: req.user.id })
        .whereNotNull('user_tag_id')
        .del();
    }

    if (mode === 'remove') {
      await db('image_tags')
        .whereIn('image_id', uniqueImageIds)
        .whereIn('user_tag_id', validTagIds)
        .andWhere({ tag_user_id: req.user.id })
        .del();
    }

    if (mode === 'add' || mode === 'replace') {
      for (const imageId of uniqueImageIds) {
        for (const tagId of validTagIds) {
          await db('image_tags').insert({
            image_id: imageId,
            tag_id: -tagId,
            source: 'manual',
            user_tag_id: tagId,
            tag_user_id: req.user.id
          }).onConflict(['image_id', 'tag_id']).ignore();
        }
      }
    }

    res.json({ message: '私有标签已更新', imageCount: uniqueImageIds.length, tagCount: validTagIds.length, mode });
  } catch (err) { next(err); }
});

// 更新私有标签
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const tag = await db('user_tags').where({ id: req.params.id, user_id: req.user.id }).first();
    if (!tag) return res.status(404).json({ error: '标签不存在' });

    await db('user_tags').where({ id: req.params.id }).update({
      display_name: req.body.display_name || tag.display_name,
      combinable: req.body.combinable !== undefined ? req.body.combinable : tag.combinable
    });
    await syncOwnedMutualGroup(req.user.id, parseInt(req.params.id), parseMutualIds(req.body.mutually_exclusive_with, { requireUserPrefix: true }), req.body.combinable !== undefined ? req.body.combinable : tag.combinable);
    res.json({ message: '已更新' });
  } catch (err) { next(err); }
});

// 删除私有标签（用户删自己的，管理员可删任意）
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.id }).first();
    const tag = await db('user_tags').where({ id: req.params.id }).first();
    if (!tag) return res.status(404).json({ error: '标签不存在' });

    // 权限检查：管理员或标签所有者
    if (user.role !== 'admin' && tag.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权删除此标签' });
    }

    // 删除关联的 image_tags 记录
    await db('image_tags').where({ user_tag_id: req.params.id }).del();

    const ownerRows = await db('user_tags').where({ user_id: tag.user_id }).select('id', 'combinable', 'mutually_exclusive_with');
    for (const row of ownerRows) {
      if (row.id === tag.id) continue;
      const nextIds = parseMutualIds(row.mutually_exclusive_with).filter(id => id !== tag.id);
      await db('user_tags').where({ id: row.id }).update({
        mutually_exclusive_with: stringifyIds(nextIds),
        combinable: nextIds.length > 0 ? false : !!row.combinable
      });
    }

    await db('user_tags').where({ id: req.params.id }).del();
    res.json({ message: '已删除' });
  } catch (err) { next(err); }
});

module.exports = router;
