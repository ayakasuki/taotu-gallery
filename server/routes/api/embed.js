/**
 * 对外 API - 嵌入 URL
 * 支持图片和相册的多格式嵌入
 */
const express = require('express');
const imageService = require('../../services/imageService');
const albumService = require('../../services/albumService');

const router = express.Router();

// 图片嵌入
// GET /api/embed/image?id=1&format=html&size=thumb
router.get('/image', async (req, res, next) => {
  try {
    const { id, format = 'source', size = 'full', random, tags } = req.query;
    let image;

    if (random !== undefined) {
      const tagIds = tags ? tags.split(',').map(Number) : null;
      const images = await imageService.getRandomImages({ count: 1, tagIds });
      image = images[0];
    } else if (id) {
      image = await imageService.getImageById(parseInt(id));
    }

    if (!image) {
      return res.status(404).json({ error: '图片不存在' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const embedCodes = imageService.generateEmbedCodes(baseUrl, image);
    const sizeCodes = embedCodes[size] || embedCodes.full;
    const embed = sizeCodes[format] || sizeCodes.source;

    // 返回对应格式
    if (format === 'html') {
      res.type('html').send(embed);
    } else if (format === 'bbcode') {
      res.type('text').send(embed);
    } else if (format === 'markdown') {
      res.type('text').send(embed);
    } else {
      // source — 返回图片 URL
      res.json({ url: embed, image });
    }
  } catch (err) {
    next(err);
  }
});

// 相册嵌入
// GET /api/embed/album?id=1&format=html&mode=fixed|random
router.get('/album', async (req, res, next) => {
  try {
    const { id, format = 'source', mode = 'fixed', random, tags } = req.query;
    let album;

    if (random !== undefined) {
      const tagIds = tags ? tags.split(',').map(Number) : null;
      const albums = await albumService.getRandomAlbums(1, tagIds);
      album = albums[0];
    } else if (id) {
      album = await albumService.getAlbumById(parseInt(id));
    }

    if (!album) {
      return res.status(404).json({ error: '相册不存在' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // 相册嵌入：取封面或随机图片
    let image;
    if (mode === 'random' && album.images && album.images.length > 0) {
      const idx = Math.floor(Math.random() * album.images.length);
      image = album.images[idx];
    } else {
      image = album.cover_image || (album.images && album.images[0]);
    }

    if (!image) {
      return res.status(404).json({ error: '相册内无图片' });
    }

    // 生成嵌入代码
    const embedCodes = imageService.generateEmbedCodes(baseUrl, {
      ...image,
      filename: `${album.name} - ${image.filename}`
    });
    const sizeCodes = embedCodes.full;
    const embed = sizeCodes[format] || sizeCodes.source;

    if (format === 'html') {
      res.type('html').send(embed);
    } else if (format === 'bbcode') {
      res.type('text').send(embed);
    } else if (format === 'markdown') {
      res.type('text').send(embed);
    } else {
      res.json({ url: embed, album, image });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
