/**
 * 对外 API - 标签查询
 * 无 token → tags 表 is_public=true + user_tags 表 is_public=true
 * 有 token → 上面 + 自己的 user_tags is_public=false
 */
import express from 'express';

import configService from '../../services/configService.js';
import db from '../../db/index.js';
import jwt from 'jsonwebtoken';
import { MY_TAG_GROUP_ID } from '../../utils/privateTagGroup.js';

const router = express.Router();

const SYSTEM_TAGS = [
  { id: '__untagged', name: 'system_untagged', display_name: '未标签', combinable: true, isSystemTag: true },
  { id: '__tagged', name: 'system_tagged', display_name: '已标签', combinable: true, isSystemTag: true }
];

async function resolveUser(req) {
  if (req.apiTokenUserId) {
    const user = await db('users').where({ id: req.apiTokenUserId }).select('id', 'role', 'is_disabled', 'review_status').first();
    return user && !user.is_disabled && user.review_status !== 'pending' ? user : null;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
      const user = await db('users').where({ id: decoded.id }).select('id', 'role', 'is_disabled', 'review_status').first();
      if (user && !user.is_disabled && user.review_status !== 'pending') return user;
    } catch {}
  }
  return null;
}

router.get('/', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (req.apiToken && !user) return res.status(403).json({ error: 'Token 所属用户不可用' });
    const userId = user?.id || null;
    const isAdmin = user?.role === 'admin';
    const groupParam = req.query.tag_g;
    const sidParam = req.query.sid;
    const groupIds = typeof groupParam === 'string' ? groupParam.split(',') : [];
    const sidValues = typeof sidParam === 'string' ? sidParam.split(',') : [];
    if (groupParam !== undefined && (!groupIds.length || groupIds.some(id => !/^(?:\d+|__system|__my_tags__|my_tags)$/.test(id)))) {
      return res.status(400).json({ error: 'tag_g 参数无效' });
    }
    if (sidParam !== undefined && (!sidValues.length || sidValues.some(id => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))))) {
      return res.status(400).json({ error: 'sid 参数无效' });
    }
    if (groupIds.some(id => id === MY_TAG_GROUP_ID || id === 'my_tags') && !userId) {
      return res.status(401).json({ error: '登录后才能筛选我的标签' });
    }
    let groupTagIds = null;
    if (groupIds.length || sidValues.length) {
      groupTagIds = new Set();
      const { groups } = await configService.readTagGroups();
      for (const groupId of groupIds) {
        if (groupId === MY_TAG_GROUP_ID || groupId === 'my_tags') {
          const ownTags = await db('user_tags').where({ user_id: userId, is_public: false }).select('id');
          for (const tag of ownTags) groupTagIds.add(`u${tag.id}`);
        } else if (groupId === '__system') {
          for (const tag of SYSTEM_TAGS) groupTagIds.add(tag.id);
        } else {
          const group = groups.find(item => String(item.id) === groupId);
          if (!group) return res.status(400).json({ error: '标签分组不存在' });
          for (const tagId of group.tagIds || []) groupTagIds.add(String(tagId));
          for (const subgroup of group.subgroups || []) {
            for (const tagId of subgroup.tagIds || []) groupTagIds.add(String(tagId));
          }
        }
      }
      const subgroups = groups.flatMap(group => group.subgroups || []);
      for (const sid of sidValues) {
        const subgroup = subgroups.find(item => Number(item.sid) === Number(sid));
        if (!subgroup) return res.status(400).json({ error: '子分组不存在' });
        for (const tagId of subgroup.tagIds || []) groupTagIds.add(String(tagId));
      }
    }

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
      if (groupTagIds ? groupTagIds.has(`u${ut.id}`) : !existingNames.has(ut.name)) {
        const tag = {
          id: `u${ut.id}`, name: ut.name,
          display_name: ut.display_name || ut.name,
          combinable: !!ut.combinable,
          mutually_exclusive_with: ut.mutually_exclusive_with,
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
          const tag = {
            id: `u${ut.id}`, name: ut.name,
            display_name: ut.display_name || ut.name,
            combinable: !!ut.combinable,
            mutually_exclusive_with: ut.mutually_exclusive_with,
            isUserTag: true, isPublicUserTag: false
          };
          if (tag.combinable) combinable.push(tag);
          else nonCombinable.push(tag);
      }
    }

    const visibleCombinable = groupTagIds ? combinable.filter(tag => groupTagIds.has(String(tag.id))) : combinable;
    const visibleNonCombinable = groupTagIds ? nonCombinable.filter(tag => groupTagIds.has(String(tag.id))) : nonCombinable;
    res.set('Cache-Control', 'private, no-store');
    res.json({ combinable: visibleCombinable, nonCombinable: visibleNonCombinable, all: [...visibleCombinable, ...visibleNonCombinable], systemGroup: { id: '__system', name: '系统分组', system: true, tagIds: SYSTEM_TAGS.map(t => t.id) } });
  } catch (err) { next(err); }
});

router.post('/validate', async (req, res, next) => {
  try {
    const { tagIds } = req.body;
    if (!tagIds || !Array.isArray(tagIds)) return res.status(400).json({ error: '请提供 tagIds 数组' });
    res.json({ valid: true, tagIds });
  } catch (err) { next(err); }
});

export default router;
