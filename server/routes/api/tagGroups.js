/**
 * 对外 API - 标签分组（公开，带权限过滤）
 */
const express = require('express');
const configService = require('../../services/configService');
const db = require('../../db');
const jwt = require('jsonwebtoken');

const router = express.Router();

function resolveUser(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try { return jwt.verify(authHeader.substring(7), process.env.JWT_SECRET); } catch {}
  }
  return null;
}

// 获取分组（过滤私有标签）
router.get('/', async (req, res, next) => {
  try {
    const user = resolveUser(req);
    const userId = user?.id || null;
    const isAdmin = user?.role === 'admin';
    const groupData = await configService.readTagGroups();
    const systemGroup = {
      id: '__system',
      name: '系统分组',
      system: true,
      tagIds: ['__untagged', '__tagged'],
      subgroups: []
    };

    // 获取可见标签 ID 集合
    let visibleTagIds;
    if (isAdmin) {
      // 管理员：所有系统标签 + 所有用户标签
      const allSystemTags = await db('tags').select('id');
      const allUserTags = await db('user_tags').select('id');
      visibleTagIds = new Set([
        ...allSystemTags.map(t => t.id),
        ...allUserTags.map(t => t.id)
      ]);
    } else if (userId) {
      // 普通用户：公共系统标签 + 自己的所有用户标签
      const publicSystemTags = await db('tags').where(function() {
        this.where({ is_public: true }).orWhereNull('is_public');
      }).select('id');
      const myUserTags = await db('user_tags').where({ user_id: userId }).select('id');
      visibleTagIds = new Set([
        ...publicSystemTags.map(t => t.id),
        ...myUserTags.map(t => t.id)
      ]);
    } else {
      // 未登录：只看公共系统标签 + 公共用户标签
      const publicTags = await db('tags').where(function() {
        this.where({ is_public: true }).orWhereNull('is_public');
      }).select('id');
      const publicUserTags = await db('user_tags').where({ is_public: true }).select('id');
      visibleTagIds = new Set([
        ...publicTags.map(t => t.id),
        ...publicUserTags.map(t => t.id)
      ]);
    }

    // 过滤分组中的标签
    const filterTagIds = (tagIds) => {
      return (tagIds || []).filter(id => visibleTagIds.has(id));
    };

    const filteredGroups = groupData.groups.map(group => ({
      ...group,
      tagIds: filterTagIds(group.tagIds),
      subgroups: (group.subgroups || []).map(sg => ({
        ...sg,
        tagIds: filterTagIds(sg.tagIds)
      }))
    }));

    res.json({ groups: [systemGroup, ...filteredGroups] });
  } catch (err) { next(err); }
});

module.exports = router;
