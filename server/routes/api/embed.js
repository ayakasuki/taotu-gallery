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

async function resolveUserId(req) {
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

// 图片嵌入
router.get('/image', async (req, res, next) => {
  try {
    const { id, format = 'source', size = 'full', random, tags } = req.query;
    const userId = await resolveUserId(req);
    let image;

    if (random !== undefined) {
      const tagIds = parseTagIds(tags);
      await assertNoTagFilterConflict(tagIds);
      const images = await imageService.getRandomImages({ count: 1, tagIds, userId, publicOnly: !userId });
      image = images[0];
    } else if (id) {
      image = await imageService.getImageById(parseInt(id));
      // 权限检查：非公共图片需要验证
      if (image && !image.is_public && !userId) {
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
    const userId = await resolveUserId(req);
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
        if (!userId || (album.user_id !== userId && album.user_id !== null)) {
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
