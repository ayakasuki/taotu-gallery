/**
 * 标签公共/私有转换 API
 * 直接操作数据库，不涉及 JSON 文件
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const db = require('../../db');

const router = express.Router();

async function requireAdmin(req, res) {
  const user = await db('users').where({ id: req.user.id }).first();
  if (user?.role !== 'admin') {
    res.status(403).json({ error: '仅管理员可操作' });
    return false;
  }
  return true;
}

// 切换标签的 is_public
router.post('/toggle', authMiddleware, async (req, res, next) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { tagId, isUserTag, is_public } = req.body;
    if (tagId === undefined) return res.status(400).json({ error: '缺少 tagId' });

    if (isUserTag) {
      const tag = await db('user_tags').where({ id: tagId }).first();
      if (!tag) return res.status(404).json({ error: '标签不存在' });
      const newVal = typeof is_public === 'boolean' ? is_public : !tag.is_public;
      await db('user_tags').where({ id: tagId }).update({ is_public: newVal ? 1 : 0 });
      res.json({ id: `u${tagId}`, is_public: !!newVal });
    } else {
      const tag = await db('tags').where({ id: tagId }).first();
      if (!tag) return res.status(404).json({ error: '标签不存在' });
      const newVal = typeof is_public === 'boolean' ? is_public : !tag.is_public;
      await db('tags').where({ id: tagId }).update({ is_public: newVal ? 1 : 0 });
      res.json({ id: tagId, is_public: !!newVal });
    }
  } catch (err) { next(err); }
});

module.exports = router;
