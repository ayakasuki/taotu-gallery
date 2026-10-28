/**
 * 内部 API - 图片（前端专用，JWT 认证）
 * 返回完整数据，不对外暴露
 */
import express from 'express';
import { createHash } from 'node:crypto';

import jwt from 'jsonwebtoken';
import authMiddleware from '../../middleware/auth.js';
import db from '../../db/index.js';
import imageService from '../../services/imageService.js';
import {parseTagIds, assertNoTagFilterConflict} from '../../utils/tagConflict.js';

const router = express.Router();

// 可选认证（公共图库不需要登录，但登录后可看自己的）
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

// 图片列表（内部用，返回完整数据）
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { page, limit, sort, order, tags, album, orientation, search, mine, public: publicOnly, userId: targetUserId, userGallery, gallery } = req.query;
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
      excludeHiddenFromGallery: gallery === 'true',
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

router.get('/favorites', optionalAuth, async (req, res, next) => {
  if (!req.user?.id) return res.status(401).json({ error: '登录后查看收藏图库' });
  try {
    const tagIds = parseTagIds(req.query.tags);
    await assertNoTagFilterConflict(tagIds);
    const result = await imageService.getImages({
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 30,
      sort: req.query.sort || 'created_at',
      order: req.query.order,
      userId: req.user.id,
      isAdmin: req.user.role === 'admin',
      favoriteUserId: req.user.id,
      tagIds,
      internal: true,
      excludeHiddenFromGallery: true
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/uploader/:userId', optionalAuth, async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.params.userId })
      .select('id', 'username', 'nickname', 'avatar').first();
    if (!user) return res.status(404).json({ error: '用户不存在' });
    let favoritesQuery = db('image_favorites as f')
      .join('images as i', 'i.id', 'f.image_id')
      .where('f.user_id', user.id)
      .where(builder => builder.whereNull('i.nsfw_status').orWhere('i.nsfw_status', false).orWhere('i.nsfw_status', 0))
      .select('i.id', 'i.filename', 'i.hash_path', 'i.width', 'i.height', 'f.created_at as favorited_at')
      .orderBy('f.created_at', 'desc')
      .limit(6);
    if (req.user?.role !== 'admin') {
      favoritesQuery = favoritesQuery.andWhere(builder => builder
        .where('i.uploader_id', user.id)
        .orWhere('i.is_public', true)
        .orWhereIn('i.album_id', db('albums').select('id').where({ is_public: true })));
    }
    const favorites = await favoritesQuery;
    res.json({
      user: { id: user.id, username: user.username, nickname: user.nickname || user.username, avatar: user.avatar },
      favorites: favorites.map(image => ({ ...image, ...imageService.buildImageUrls(image) }))
    });
  } catch (err) { next(err); }
});

router.post('/:id/like', optionalAuth, async (req, res, next) => {
  try {
    const image = await db('images').where({ id: req.params.id }).first();
    if (!image) return res.status(404).json({ error: '图片不存在' });
    if (req.user?.role !== 'admin' && image.uploader_id !== req.user?.id && !image.is_public) {
      const album = image.album_id ? await db('albums').where({ id: image.album_id }).select('is_public').first() : null;
      if (!album?.is_public) return res.status(403).json({ error: '无权对该图片点赞' });
    }
    if (image.nsfw_status === true || image.nsfw_status === 1) return res.status(403).json({ error: '不健康图片不可点赞' });
    let liked;
    if (req.user?.id) {
      const existing = await db('image_likes').where({ image_id: image.id, user_id: req.user.id }).first();
      if (existing) await db('image_likes').where({ id: existing.id }).del();
      else await db('image_likes').insert({ image_id: image.id, user_id: req.user.id });
      liked = !existing;
    } else {
      const visitorToken = String(req.body?.visitor_token || '');
      if (!/^[a-f0-9]{32,128}$/i.test(visitorToken)) return res.status(400).json({ error: '访客点赞标识无效' });
      const visitorHash = createHash('sha256').update(visitorToken).digest('hex');
      const existing = await db('image_guest_likes').where({ image_id: image.id, visitor_hash: visitorHash }).first();
      if (existing) await db('image_guest_likes').where({ id: existing.id }).del();
      else await db('image_guest_likes').insert({ image_id: image.id, visitor_hash: visitorHash });
      liked = !existing;
    }
    const [userCount, guestCount] = await Promise.all([
      db('image_likes').where({ image_id: image.id }).count('* as count').first(),
      db('image_guest_likes').where({ image_id: image.id }).count('* as count').first()
    ]);
    res.json({ liked, like_count: Number(userCount?.count || 0) + Number(guestCount?.count || 0) });
  } catch (err) { next(err); }
});

router.post('/:id/favorite', authMiddleware, async (req, res, next) => {
  try {
    const image = await db('images').where({ id: req.params.id }).first();
    if (!image) return res.status(404).json({ error: '图片不存在' });
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && image.uploader_id !== req.user.id && !image.is_public) {
      const album = image.album_id ? await db('albums').where({ id: image.album_id }).select('is_public').first() : null;
      if (!album?.is_public) return res.status(403).json({ error: '只能收藏自己的图片或公共图片' });
    }
    if (!isAdmin && (image.nsfw_status === true || image.nsfw_status === 1)) return res.status(403).json({ error: '不健康图片不可收藏' });
    const existing = await db('image_favorites').where({ image_id: image.id, user_id: req.user.id }).first();
    if (existing) await db('image_favorites').where({ id: existing.id }).del();
    else await db('image_favorites').insert({ image_id: image.id, user_id: req.user.id });
    const count = await db('image_favorites').where({ image_id: image.id }).count('* as count').first();
    res.json({ favorited: !existing, favorite_count: Number(count?.count || 0) });
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
    if (!isAdmin && (image.nsfw_status === true || image.nsfw_status === 1)) {
      return res.status(403).json({ error: '图片已标记为不健康内容' });
    }
    if (req.user?.id) {
      const [liked, favorited] = await Promise.all([
        db('image_likes').where({ image_id: image.id, user_id: req.user.id }).first(),
        db('image_favorites').where({ image_id: image.id, user_id: req.user.id }).first()
      ]);
      image.liked_by_me = !!liked;
      image.favorited_by_me = !!favorited;
    } else {
      image.liked_by_me = false;
      image.favorited_by_me = false;
    }
    res.json(image);
  } catch (err) { next(err); }
});

export default router;
