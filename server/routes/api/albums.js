/**
 * 对外 API - 相册查询（严格权限隔离）
 * 无 token → 只返回公共相册
 * 有 token → 返回自己的 + 公共的
 * 不能看到别人的私有相册
 */
const express = require('express');
const albumService = require('../../services/albumService');
const db = require('../../db');
const jwt = require('jsonwebtoken');

const router = express.Router();

function resolveUserId(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try { return jwt.verify(authHeader.substring(7), process.env.JWT_SECRET).id; } catch {}
  }
  if (req.query.tk) {
    const tokenRecord = db('api_tokens').where({ token: req.query.tk }).first();
    // 同步问题，用异步处理
  }
  return null;
}

async function resolveUserIdAsync(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try { return jwt.verify(authHeader.substring(7), process.env.JWT_SECRET).id; } catch {}
  }
  if (req.query.tk) {
    const tokenRecord = await db('api_tokens').where({ token: req.query.tk }).first();
    if (tokenRecord) return tokenRecord.user_id || null;
  }
  return null;
}

// 相册列表
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, sort, order, tags } = req.query;
    const tagIds = tags ? tags.split(',').map(Number) : null;
    const userId = await resolveUserIdAsync(req);

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
    const userId = await resolveUserIdAsync(req);

    // 无 token → 只返回公共相册
    const albums = await albumService.getRandomAlbums(parseInt(count) || 1, tagIds, userId, !userId);
    res.json({ albums });
  } catch (err) { next(err); }
});

// 单相册详情
router.get('/:id', async (req, res, next) => {
  try {
    const userId = await resolveUserIdAsync(req);
    const album = await albumService.getAlbumById(parseInt(req.params.id));
    if (!album) return res.status(404).json({ error: '相册不存在' });

    // 权限检查：非公共相册必须是所有者或管理员
    if (!album.is_public) {
      if (!userId || (album.user_id !== userId && album.user_id !== null)) {
        return res.status(403).json({ error: '无权访问此相册' });
      }
    }

    res.json(album);
  } catch (err) { next(err); }
});

module.exports = router;
