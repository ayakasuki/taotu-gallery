/**
 * 对外 API - 相册查询（支持权限隔离）
 */
const express = require('express');
const albumService = require('../../services/albumService');
const db = require('../../db');

const router = express.Router();

// 尝试获取用户 ID
async function resolveUserId(req) {
  const jwt = require('jsonwebtoken');
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded.id;
    } catch {}
  }
  if (req.query.tk) {
    const tokenRecord = await db('api_tokens').where({ token: req.query.tk }).first();
    if (tokenRecord) return tokenRecord.user_id;
  }
  return null;
}

// 相册列表
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, sort, order, tags, mine, public: publicOnlyParam, userId: targetUserId } = req.query;
    const tagIds = tags ? tags.split(',').map(Number) : null;
    const userId = await resolveUserId(req);

    const ownOnly = mine === 'true' && userId;
    const publicOnly = publicOnlyParam === 'true';

    const result = await albumService.getAlbums({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sort, order, tagIds,
      userId,
      publicOnly,
      ownOnly
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 随机相册
router.get('/random', async (req, res, next) => {
  try {
    const { count, tags } = req.query;
    const tagIds = tags ? tags.split(',').map(Number) : null;
    const albums = await albumService.getRandomAlbums(parseInt(count) || 1, tagIds);
    res.json({ albums });
  } catch (err) {
    next(err);
  }
});

// 单相册详情
router.get('/:id', async (req, res, next) => {
  try {
    const album = await albumService.getAlbumById(parseInt(req.params.id));
    if (!album) return res.status(404).json({ error: '相册不存在' });
    res.json(album);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
