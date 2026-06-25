/**
 * 标签公共/私有转换 API
 * 直接操作数据库，不涉及 JSON 文件
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const db = require('../../db');

const router = express.Router();

// 切换标签的 is_public
router.post('/toggle', authMiddleware, async (req, res, next) => {
  try {
    const { tagId, isUserTag } = req.body;
    if (tagId === undefined) return res.status(400).json({ error: '缺少 tagId' });

    if (isUserTag) {
      const tag = await db('user_tags').where({ id: tagId }).first();
      if (!tag) return res.status(404).json({ error: '标签不存在' });
      const newVal = tag.is_public ? 0 : 1;
      await db('user_tags').where({ id: tagId }).update({ is_public: newVal });
      res.json({ id: `u${tagId}`, is_public: !!newVal });
    } else {
      const tag = await db('tags').where({ id: tagId }).first();
      if (!tag) return res.status(404).json({ error: '标签不存在' });
      const newVal = tag.is_public ? 0 : 1;
      await db('tags').where({ id: tagId }).update({ is_public: newVal });
      res.json({ id: tagId, is_public: !!newVal });
    }
  } catch (err) { next(err); }
});

module.exports = router;
