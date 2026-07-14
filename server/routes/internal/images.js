/**
 * 内部 API - 图片（前端专用，JWT 认证）
 * 返回完整数据，不对外暴露
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const db = require('../../db');
const imageService = require('../../services/imageService');
const { parseTagIds, assertNoTagFilterConflict } = require('../../utils/tagConflict');

const router = express.Router();

// 可选认证（公共图库不需要登录，但登录后可看自己的）
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = require('jsonwebtoken');
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

// 图片列表（内部用，返回完整数据）
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { page, limit, sort, order, tags, album, orientation, search, mine, public: publicOnly, userId: targetUserId, userGallery } = req.query;
    const tagIds = parseTagIds(tags);
    await assertNoTagFilterConflict(tagIds);
    const userId = req.user?.id || null;
    const isAdmin = req.user?.role === 'admin';

    const result = await imageService.getImages({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sort, order, tagIds,
      albumId: album ? parseInt(album) : null,
      orientation, search,
      userId,
      publicOnly: publicOnly === 'true',
      ownOnly: mine === 'true' && userId,
      isAdmin,
      filterUserId: isAdmin && targetUserId ? parseInt(targetUserId) : null,
      userGalleryOnly: isAdmin && userGallery === 'true',
      internal: true
    });
    res.json(result);
  } catch (err) { next(err); }
});

// 随机图片（内部用）
router.get('/random', optionalAuth, async (req, res, next) => {
  try {
    const { count, tags, album, orientation } = req.query;
    const tagIds = parseTagIds(tags);
    await assertNoTagFilterConflict(tagIds);
    const userId = req.user?.id || null;
    const images = await imageService.getRandomImages({
      count: parseInt(count) || 1, tagIds,
      albumId: album ? parseInt(album) : null,
      orientation, userId, isAdmin: req.user?.role === 'admin',
      publicOnly: !userId,
      internal: true
    });
    res.json({ images });
  } catch (err) { next(err); }
});

// 单图片详情
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const image = await imageService.getImageById(parseInt(req.params.id), true);
    if (!image) return res.status(404).json({ error: '图片不存在' });
    const isAdmin = req.user?.role === 'admin';
    const isOwner = req.user?.id && image.uploader_id === req.user.id;
    let isPublicAlbum = false;
    if (image.album_id) {
      const album = await db('albums').where({ id: image.album_id }).select('is_public').first();
      isPublicAlbum = album?.is_public === true || album?.is_public === 1;
    }
    if (!isAdmin && !isOwner && !isPublicAlbum && !image.is_public && image.uploader_id !== null) {
      return res.status(403).json({ error: '无权访问此图片' });
    }
    res.json(image);
  } catch (err) { next(err); }
});

module.exports = router;
