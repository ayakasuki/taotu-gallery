/**
 * 对外 API - 嵌入（严格权限隔离）
 * 无 token → 只能嵌入公共图片/相册
 * 有 token → 可嵌入自己的 + 公共的
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const imageService = require('../../services/imageService');
const albumService = require('../../services/albumService');
const db = require('../../db');
const jwt = require('jsonwebtoken');
const { parseTagIds, assertNoTagFilterConflict } = require('../../utils/tagConflict');

const router = express.Router();

async function resolveUser(req) {
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

// 图片嵌入
router.get('/image', async (req, res, next) => {
  try {
    const { id, format = 'source', size = 'full', random, tags } = req.query;
    const user = await resolveUser(req);
    const userId = user?.id || null;
    const isAdmin = user?.role === 'admin';
    let image;

    if (random !== undefined) {
      const tagIds = parseTagIds(tags);
      await assertNoTagFilterConflict(tagIds);
      const images = await imageService.getRandomImages({ count: 1, tagIds, userId, isAdmin, publicOnly: !userId });
      image = images[0];
    } else if (id) {
      image = await imageService.getImageById(parseInt(id));
      let isPublicAlbum = false;
      if (image?.album_id) {
        const album = await db('albums').where({ id: image.album_id }).select('is_public').first();
        isPublicAlbum = album?.is_public === true || album?.is_public === 1;
      }
      if (image && !isAdmin && image.uploader_id !== userId && !isPublicAlbum && !image.is_public && image.uploader_id !== null) {
        return res.status(403).json({ error: '无权访问此图片' });
      }
    }

    if (!image) return res.status(404).json({ error: '图片不存在' });

    const baseUrl = await imageService.getPublicBaseUrl();
    const embedCodes = imageService.generateEmbedCodes(baseUrl, image);
    const sizeCodes = embedCodes[size] || embedCodes.full;
    const embed = sizeCodes[format] || sizeCodes.source;

    if (format === 'html') res.type('html').send(embed);
    else if (format === 'bbcode') res.type('text').send(embed);
    else if (format === 'markdown') res.type('text').send(embed);
    else res.json({ url: embed, image });
  } catch (err) { next(err); }
});

// 相册嵌入
router.get('/album', async (req, res, next) => {
  try {
    const { id, format = 'source', mode = 'fixed', random, tags } = req.query;
    const user = await resolveUser(req);
    const userId = user?.id || null;
    const isAdmin = user?.role === 'admin';
    let album;

    if (random !== undefined) {
      const tagIds = parseTagIds(tags);
      await assertNoTagFilterConflict(tagIds);
      const albums = await albumService.getRandomAlbums(1, tagIds, userId, !userId);
      album = albums[0];
    } else if (id) {
      album = await albumService.getAlbumById(parseInt(id));
      // 权限检查
      if (album && !album.is_public) {
        if (!isAdmin && (!userId || (album.user_id !== userId && album.user_id !== null))) {
          return res.status(403).json({ error: '无权访问此相册' });
        }
      }
    }

    if (!album) return res.status(404).json({ error: '相册不存在' });

    const baseUrl = await imageService.getPublicBaseUrl();
    let image;
    if (mode === 'random' && album.images && album.images.length > 0) {
      image = album.images[Math.floor(Math.random() * album.images.length)];
    } else {
      image = album.cover_image || (album.images && album.images[0]);
    }

    if (!image) return res.status(404).json({ error: '相册内无图片' });

    const embedCodes = imageService.generateEmbedCodes(baseUrl, {
      ...image,
      filename: `${album.name} - ${image.filename}`
    });
    const sizeCodes = embedCodes.full;
    const embed = sizeCodes[format] || sizeCodes.source;

    if (format === 'html') res.type('html').send(embed);
    else if (format === 'bbcode') res.type('text').send(embed);
    else if (format === 'markdown') res.type('text').send(embed);
    else res.json({ url: embed, album, image });
  } catch (err) { next(err); }
});

module.exports = router;
