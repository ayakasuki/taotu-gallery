/**
 * 内部 API - 相册（前端专用，JWT 认证）
 */
const express = require('express');
const db = require('../../db');
const albumService = require('../../services/albumService');

const router = express.Router();

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = require('jsonwebtoken');
    try { req.user = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET); } catch {}
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
      filterUserId: targetUserId ? parseInt(targetUserId) : null,
      search: search || ''
    });
    res.json(result);
  } catch (err) { next(err); }
});

// 单相册详情
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const album = await albumService.getAlbumById(parseInt(req.params.id));
    if (!album) return res.status(404).json({ error: '相册不存在' });
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

module.exports = router;
