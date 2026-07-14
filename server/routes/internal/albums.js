/**
 * 内部 API - 相册（前端专用，JWT 认证）
 */
import express from 'express';

import jwt from 'jsonwebtoken';
import db from '../../db/index.js';
import albumService from '../../services/albumService.js';

const router = express.Router();

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
      const user = await db('users')
        .where({ id: decoded.id })
        .select('id', 'username', 'role', 'is_disabled', 'review_status')
        .first();
      if (user && !user.is_disabled && user.review_status !== 'pending') {
        req.user = { ...decoded, id: user.id, username: user.username, role: user.role };
      }
    } catch {}
  }
  next();
}

// 相册列表
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { page, limit, sort, order, tags, mine, public: publicOnly, userId: targetUserId, search } = req.query;
    const tagIds = tags ? tags.split(',').map(Number) : null;
    const userId = req.user?.id || null;
    const isAdmin = req.user?.role === 'admin';

    const result = await albumService.getAlbums({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sort, order, tagIds, userId,
      publicOnly: publicOnly === 'true',
      ownOnly: mine === 'true' && userId,
      isAdmin,
      filterUserId: isAdmin && targetUserId ? parseInt(targetUserId) : null,
      search: search || ''
    });
    res.json(result);
  } catch (err) { next(err); }
});

// 单相册详情
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const album = await albumService.getAlbumById(parseInt(req.params.id));
    if (!album) return res.status(404).json({ error: '相册不存在' });
    if (!isAdmin && !album.is_public && (!req.user?.id || album.user_id !== req.user.id)) {
      return res.status(403).json({ error: '无权访问此相册' });
    }
    res.json(album);
  } catch (err) { next(err); }
});

// 随机相册
router.get('/random', optionalAuth, async (req, res, next) => {
  try {
    const { count, tags } = req.query;
    const tagIds = tags ? tags.split(',').map(Number) : null;
    const userId = req.user?.id || null;
    const albums = await albumService.getRandomAlbums(parseInt(count) || 1, tagIds, userId, !userId);
    res.json({ albums });
  } catch (err) { next(err); }
});

export default router;
