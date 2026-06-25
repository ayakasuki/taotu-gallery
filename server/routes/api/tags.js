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

function resolveUserId(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try { return jwt.verify(authHeader.substring(7), process.env.JWT_SECRET).id; } catch {}
  }
  return null;
}

router.get('/', async (req, res, next) => {
  try {
    const userId = resolveUserId(req);

    // 从 tags 表读取（按 is_public 过滤）
    let dbTags;
    if (userId) {
      dbTags = await db('tags').where(function() {
        this.where({ is_public: true }).orWhereNull('is_public');
      });
    } else {
      dbTags = await db('tags').where(function() {
        this.where({ is_public: true }).orWhereNull('is_public');
      });
    }

    const combinable = [];
    const nonCombinable = [];
    const existingNames = new Set();

    for (const t of dbTags) {
      const tag = {
        id: t.id, name: t.name,
        display_name: t.display_name || t.name,
        combinable: !!t.combinable,
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

    res.json({ combinable, nonCombinable, all: [...combinable, ...nonCombinable] });
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
