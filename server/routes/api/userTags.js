/**
 * 用户私有标签管理 API
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const db = require('../../db');

const router = express.Router();

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
    const { name, display_name, combinable } = req.body;
    if (!name) return res.status(400).json({ error: '标签名不能为空' });

    const [id] = await db('user_tags').insert({
      user_id: req.user.id,
      name,
      display_name: display_name || name,
      combinable: combinable !== false,
      is_public: false
    });
    res.json({ id, name, display_name: display_name || name, combinable: combinable !== false });
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

    await db('user_tags').where({ id: req.params.id }).del();
    res.json({ message: '已删除' });
  } catch (err) { next(err); }
});

module.exports = router;
