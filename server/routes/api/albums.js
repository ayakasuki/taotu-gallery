/**
 * 对外 API - 相册查询（严格权限隔离）
 * 无 token → 只返回公共相册
 * 有 token → 返回自己的 + 公共的
 * 不能看到别人的私有相册
 */
import express from 'express';

import albumService from '../../services/albumService.js';
import db from '../../db/index.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

async function resolveUserAsync(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
      const user = await db('users').where({ id: decoded.id }).select('id', 'role', 'is_disabled', 'review_status').first();
      if (user && !user.is_disabled && user.review_status !== 'pending') return user;
    } catch {}
  }
  if (req.query.tk) {
    const tokenRecord = await db('api_tokens').where({ token: req.query.tk }).first();
    if (tokenRecord?.user_id) {
      const user = await db('users').where({ id: tokenRecord.user_id }).select('id', 'role', 'is_disabled', 'review_status').first();
      if (user && !user.is_disabled && user.review_status !== 'pending') return user;
    }
  }
  return null;
}

// 相册列表
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, sort, order, tags } = req.query;
    const tagIds = tags ? tags.split(',').map(Number) : null;
    const user = await resolveUserAsync(req);
    const userId = user?.id || null;

    // 无 token → 只返回公共相册
    // 有 token → 返回自己的 + 公共的
    const result = await albumService.getAlbums({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sort, order, tagIds,
      userId,
      publicOnly: !userId
    });
    res.json(result);
  } catch (err) { next(err); }
});

// 随机相册
router.get('/random', async (req, res, next) => {
  try {
    const { count, tags } = req.query;
    const tagIds = tags ? tags.split(',').map(Number) : null;
    const user = await resolveUserAsync(req);
    const userId = user?.id || null;

    // 无 token → 只返回公共相册
    const albums = await albumService.getRandomAlbums(parseInt(count) || 1, tagIds, userId, !userId);
    res.json({ albums });
  } catch (err) { next(err); }
});

// 单相册详情
router.get('/:id', async (req, res, next) => {
  try {
    const user = await resolveUserAsync(req);
    const userId = user?.id || null;
    const isAdmin = user?.role === 'admin';
    const album = await albumService.getAlbumById(parseInt(req.params.id));
    if (!album) return res.status(404).json({ error: '相册不存在' });

    // 权限检查：非公共相册必须是所有者或管理员
    if (!album.is_public) {
      if (!isAdmin && (!userId || (album.user_id !== userId && album.user_id !== null))) {
        return res.status(403).json({ error: '无权访问此相册' });
      }
    }

    res.json(album);
  } catch (err) { next(err); }
});

export default router;
