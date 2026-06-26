/**
 * 对外 API - 标签查询
 * 无 token → tags 表 is_public=true + user_tags 表 is_public=true
 * 有 token → 上面 + 自己的 user_tags is_public=false
 */
const express = require('express');
const configService = require('../../services/configService');
const db = require('../../db');
const jwt = require('jsonwebtoken');

const router = express.Router();

const SYSTEM_TAGS = [
  { id: '__untagged', name: 'system_untagged', display_name: '未标签', combinable: true, isSystemTag: true },
  { id: '__tagged', name: 'system_tagged', display_name: '已标签', combinable: true, isSystemTag: true }
];

function resolveUserId(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try { return jwt.verify(authHeader.substring(7), process.env.JWT_SECRET); } catch {}
  }
  return null;
}

router.get('/', async (req, res, next) => {
  try {
    const user = resolveUserId(req);
    const userId = user?.id || null;
    const isAdmin = user?.role === 'admin';

    // 从 tags 表读取
    // 未登录：只看公共标签
    // 普通用户：公共标签（私有系统标签不可见）
    // 管理员：所有标签（含私有系统标签）
    let dbTags;
    if (isAdmin) {
      dbTags = await db('tags').select('*');
    } else {
      dbTags = await db('tags').where(function() {
        this.where({ is_public: true }).orWhereNull('is_public');
      });
    }

    const combinable = [...SYSTEM_TAGS];
    const nonCombinable = [];
    const existingNames = new Set();

    for (const t of dbTags) {
      const tag = {
        id: t.id, name: t.name,
        display_name: t.display_name || t.name,
        combinable: !!t.combinable,
        mutually_exclusive_with: t.mutually_exclusive_with,
        isPublicTag: true
      };
      if (tag.combinable) combinable.push(tag);
      else nonCombinable.push(tag);
      existingNames.add(t.name);
    }

    // 公共 user_tags（所有人可见）
    const publicUserTags = await db('user_tags').where({ is_public: true });
    for (const ut of publicUserTags) {
      if (!existingNames.has(ut.name)) {
        const tag = {
          id: `u${ut.id}`, name: ut.name,
          display_name: ut.display_name || ut.name,
          combinable: !!ut.combinable,
          isUserTag: true, isPublicUserTag: true
        };
        if (tag.combinable) combinable.push(tag);
        else nonCombinable.push(tag);
        existingNames.add(ut.name);
      }
    }

    // 私有 user_tags（仅自己可见）
    if (userId) {
      const privateUserTags = await db('user_tags').where({ user_id: userId, is_public: false });
      for (const ut of privateUserTags) {
        if (!existingNames.has(ut.name)) {
          const tag = {
            id: `u${ut.id}`, name: ut.name,
            display_name: ut.display_name || ut.name,
            combinable: !!ut.combinable,
            isUserTag: true, isPublicUserTag: false
          };
          if (tag.combinable) combinable.push(tag);
          else nonCombinable.push(tag);
          existingNames.add(ut.name);
        }
      }
    }

    res.json({ combinable, nonCombinable, all: [...combinable, ...nonCombinable], systemGroup: { id: '__system', name: '系统分组', system: true, tagIds: SYSTEM_TAGS.map(t => t.id) } });
  } catch (err) { next(err); }
});

router.post('/validate', async (req, res, next) => {
  try {
    const { tagIds } = req.body;
    if (!tagIds || !Array.isArray(tagIds)) return res.status(400).json({ error: '请提供 tagIds 数组' });
    res.json({ valid: true, tagIds });
  } catch (err) { next(err); }
});

module.exports = router;
