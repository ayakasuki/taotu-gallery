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
      combinable: combinable !== false
    });
    res.json({ id, name, display_name: display_name || name, combinable: combinable !== false });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '标签名已存在' });
    next(err);
  }
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
