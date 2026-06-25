/**
 * 标签公共/私有转换
 * 核心：只改 is_public 字段，ID 永远不变
 * - tags 表的标签：直接改 tags.is_public
 * - user_tags 表的标签：直接改 user_tags.is_public
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const configService = require('../../services/configService');
const db = require('../../db');

const router = express.Router();

// 切换 tags 表中标签的 is_public
router.post('/toggle', authMiddleware, async (req, res, next) => {
  try {
    const { tagId, isUserTag } = req.body;
    if (tagId === undefined) return res.status(400).json({ error: '缺少 tagId' });

    if (isUserTag) {
      // user_tags 表
      const tag = await db('user_tags').where({ id: tagId }).first();
      if (!tag) return res.status(404).json({ error: '标签不存在' });
      await db('user_tags').where({ id: tagId }).update({ is_public: !tag.is_public });
      res.json({ id: `u${tagId}`, is_public: !tag.is_public });
    } else {
      // tags 表
      const tag = await db('tags').where({ id: tagId }).first();
      if (!tag) return res.status(404).json({ error: '标签不存在' });
      const newVal = tag.is_public ? 0 : 1;
      await db('tags').where({ id: tagId }).update({ is_public: newVal });
      // 同步 tags.json（保持一致）
      const publicTags = await configService.readTags();
      const allTags = [...(publicTags.combinable || []), ...(publicTags.nonCombinable || [])];
      const t = allTags.find(t => t.id === tagId);
      if (t) t.is_public = !!newVal;
      await configService.writeTags(publicTags);
      res.json({ id: tagId, is_public: !!newVal });
    }
  } catch (err) { next(err); }
});

module.exports = router;
