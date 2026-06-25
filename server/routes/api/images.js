/**
 * 对外 API - 图片查询
 * 支持 JWT 认证（登录用户）和 API Token 认证
 * 未登录用户只能看公共图片
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const imageService = require('../../services/imageService');
const db = require('../../db');

const router = express.Router();

// 尝试从 JWT 或 API Token 获取用户 ID
async function resolveUserId(req) {
  // 优先 JWT
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded.id;
    } catch {
      // 不是 JWT，尝试 API Token
      const tokenRecord = await db('api_tokens').where({ token }).first();
      if (tokenRecord) {
        await db('api_tokens').where({ id: tokenRecord.id }).update({ last_used_at: db.fn.now() });
        return tokenRecord.user_id || null;
      }
    }
  }

  // 尝试 ?tk= 参数
  if (req.query.tk) {
    const tokenRecord = await db('api_tokens').where({ token: req.query.tk }).first();
    if (tokenRecord) {
      await db('api_tokens').where({ id: tokenRecord.id }).update({ last_used_at: db.fn.now() });
      return tokenRecord.user_id || null;
    }
  }

  return null;
}

// 查询图片列表
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, sort, order, tags, album, orientation, search, mine, public: publicOnlyParam, userId: targetUserId } = req.query;
    const tagIds = tags ? tags.split(',').map(id => id.startsWith('u') ? id : Number(id)) : null;
    const userId = await resolveUserId(req);

    let isAdmin = false;
    if (userId) {
      const user = await db('users').where({ id: userId }).first();
      isAdmin = user?.role === 'admin';
    }

    const ownOnly = mine === 'true' && userId;
    const publicOnly = publicOnlyParam === 'true';
    const filterUserId = targetUserId ? parseInt(targetUserId) : null;

    const result = await imageService.getImages({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sort, order, tagIds,
      albumId: album ? parseInt(album) : null,
      orientation, search,
      userId,
      publicOnly,
      ownOnly,
      isAdmin,
      filterUserId
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 随机图片
router.get('/random', async (req, res, next) => {
  try {
    const { count, tags, album, orientation, pic } = req.query;
    const tagIds = tags ? tags.split(',').map(id => id.startsWith('u') ? id : Number(id)) : null;
    const requestedCount = parseInt(count) || 1;
    const useMedium = pic === 'md';
    const userId = await resolveUserId(req);

    const images = await imageService.getRandomImages({
      count: requestedCount,
      tagIds,
      albumId: album ? parseInt(album) : null,
      orientation,
      userId,
      publicOnly: !userId
    });

    if (images.length === 0) {
      return res.status(404).json({ error: '没有符合条件的图片' });
    }

    // count=1 时直接返回图片二进制
    if (requestedCount === 1) {
      const image = images[0];
      let filePath;

      if (useMedium) {
        // 返回中等尺寸图
        const ext = path.extname(image.path);
        const baseName = path.basename(image.path, ext);
        const dirName = path.dirname(image.path);
        filePath = path.resolve(__dirname, '../../..', dirName, '.thumbs', `${baseName}_medium${ext}`);
        // 如果中等图不存在，回退到原图
        if (!fs.existsSync(filePath)) {
          filePath = path.resolve(__dirname, '../../..', image.path);
        }
      } else {
        filePath = path.resolve(__dirname, '../../..', image.path);
      }

      if (fs.existsSync(filePath)) {
        res.set('Content-Type', image.mime_type || 'image/jpeg');
        res.set('Cache-Control', 'no-cache');
        return res.sendFile(filePath);
      }
    }

    res.json({ images });
  } catch (err) {
    next(err);
  }
});

// 单图片详情
router.get('/:id', async (req, res, next) => {
  try {
    const image = await imageService.getImageById(parseInt(req.params.id));
    if (!image) return res.status(404).json({ error: '图片不存在' });
    res.json(image);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
