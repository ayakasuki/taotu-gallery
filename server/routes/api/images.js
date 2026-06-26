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
const { parseTagIds, assertNoTagFilterConflict } = require('../../utils/tagConflict');

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
    const tagIds = parseTagIds(tags);
    await assertNoTagFilterConflict(tagIds);
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
    const { count, tags, album, orientation, pic, tag_g, sid } = req.query;
    let tagIds = parseTagIds(tags) || [];
    const requestedCount = parseInt(count) || 1;
    const useMedium = pic === 'md';
    const userId = await resolveUserId(req);

    // tag_g 参数：按分组 ID 筛选（支持逗号分隔多值）
    // sid 参数：按子分组 sid 筛选（支持逗号分隔多值）
    // tags 参数：按标签 ID 筛选
    // 三者叠加（OR 逻辑）
    const configService = require('../../services/configService');
    const groupData = await configService.readTagGroups();

    if (tag_g) {
      const groupIds = tag_g.split(',').map(Number);
      for (const gid of groupIds) {
        const group = groupData.groups.find(g => g.id === gid);
        if (group) {
          // 如果没有指定 sid，则取分组内所有标签（含子分组）
          if (!sid) {
            for (const tid of (group.tagIds || [])) tagIds.push(tid);
            for (const sg of group.subgroups || []) {
              for (const tid of (sg.tagIds || [])) tagIds.push(tid);
            }
          } else {
            // 只取分组直属标签
            for (const tid of (group.tagIds || [])) tagIds.push(tid);
          }
        }
      }
    }

    if (sid) {
      const sids = sid.split(',').map(Number);
      for (const sg of (groupData.groups || []).flatMap(g => g.subgroups || [])) {
        if (sids.includes(sg.sid)) {
          for (const tid of (sg.tagIds || [])) tagIds.push(tid);
        }
      }
    }

    // 去重
    tagIds = [...new Set(tagIds)];
    await assertNoTagFilterConflict(tagIds);

    const images = await imageService.getRandomImages({
      count: requestedCount,
      tagIds: tagIds.length > 0 ? tagIds : null,
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
        const ext = path.extname(image.path);
        const baseName = path.basename(image.path, ext);
        const dirName = path.dirname(image.path);
        filePath = path.resolve(__dirname, '../../..', dirName, '.thumbs', `${baseName}_medium${ext}`);
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
