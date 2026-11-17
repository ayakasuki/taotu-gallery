/**
 * 对外 API - 图片查询
 * 支持 JWT 认证（登录用户）和 API Token 认证
 * 未登录用户只能看公共图片
 */
import express from 'express';

import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import imageService from '../../services/imageService.js';
import imageProcessor from '../../utils/imageProcessor.js';
import db from '../../db/index.js';
import {parseTagIds, assertNoTagFilterConflict} from '../../utils/tagConflict.js';
import configService from '../../services/configService.js';
import { getPermissions } from '../../middleware/apiTokenAccess.js';
import { temporaryImage } from '../../utils/temporaryMedia.js';
import { parseRandomCount, parseRandomExclusions, shouldRedirectRandomImage } from '../../utils/randomRequest.js';
import { MY_TAG_GROUP_ID, isMyTagGroup } from '../../utils/privateTagGroup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 尝试从 JWT 或 API Token 获取用户 ID
async function resolveUser(req) {
  if (req.apiTokenUserId) {
    const user = await db('users').where({ id: req.apiTokenUserId }).select('id', 'username', 'role', 'is_disabled', 'review_status').first();
    return user && !user.is_disabled && user.review_status !== 'pending' ? user : null;
  }
  // 优先 JWT
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await db('users')
        .where({ id: decoded.id })
        .select('id', 'username', 'role', 'is_disabled', 'review_status')
        .first();
      if (!user || user.is_disabled || user.review_status === 'pending') return null;
      return user;
    } catch {
      // 不是 JWT，尝试 API Token
      const tokenRecord = await db('api_tokens').where({ token }).first();
      if (tokenRecord) {
        if (!getPermissions(tokenRecord).includes('images:read') && !getPermissions(tokenRecord).includes('admin:manage')) return null;
        await db('api_tokens').where({ id: tokenRecord.id }).update({ last_used_at: db.fn.now() });
        if (!tokenRecord.user_id) return null;
        const user = await db('users').where({ id: tokenRecord.user_id }).select('id', 'username', 'role', 'is_disabled', 'review_status').first();
        return user && !user.is_disabled && user.review_status !== 'pending' ? user : null;
      }
    }
  }

  // 尝试 ?tk= 参数
  if (req.query.tk) {
    const tokenRecord = await db('api_tokens').where({ token: req.query.tk }).first();
    if (tokenRecord) {
      if (!getPermissions(tokenRecord).includes('images:read') && !getPermissions(tokenRecord).includes('admin:manage')) return null;
      await db('api_tokens').where({ id: tokenRecord.id }).update({ last_used_at: db.fn.now() });
      if (!tokenRecord.user_id) return null;
      const user = await db('users').where({ id: tokenRecord.user_id }).select('id', 'username', 'role', 'is_disabled', 'review_status').first();
      return user && !user.is_disabled && user.review_status !== 'pending' ? user : null;
    }
  }

  return null;
}

// 查询图片列表
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, sort, order, tags, album, orientation, search, mine, public: publicOnlyParam, userId: targetUserId, tag_g, sid } = req.query;
    let tagIds = parseTagIds(tags) || [];
    const user = await resolveUser(req);
    if (req.apiToken && !user) return res.status(403).json({ error: 'Token 所属用户不可用' });
    const userId = user?.id || null;
    const isAdmin = user?.role === 'admin';
    const selectedGroupIds = tag_g ? tag_g.split(',') : [];
    if (selectedGroupIds.some(id => !isMyTagGroup(id) && id !== '__system' && !/^\d+$/.test(id))) return res.status(400).json({ error: 'tag_g 参数无效' });
    if (selectedGroupIds.includes(MY_TAG_GROUP_ID) && !userId) return res.status(401).json({ error: '登录后才能筛选我的标签' });
    if (selectedGroupIds.some(id => /^\d+$/.test(id)) || sid) {
      const groups = await configService.readTagGroups();
      for (const groupId of selectedGroupIds.filter(id => /^\d+$/.test(id))) {
        const group = groups.groups.find(item => Number(item.id) === Number(groupId));
        if (group) {
          tagIds.push(...(group.tagIds || []));
          for (const subgroup of group.subgroups || []) tagIds.push(...(subgroup.tagIds || []));
        }
      }
      if (sid) {
        const selectedSids = sid.split(',').map(Number);
        if (selectedSids.some(id => !Number.isInteger(id))) return res.status(400).json({ error: 'sid 参数无效' });
        for (const subgroup of groups.groups.flatMap(group => group.subgroups || [])) {
          if (selectedSids.includes(subgroup.sid)) tagIds.push(...(subgroup.tagIds || []));
        }
      }
    }
    tagIds = [...new Set(tagIds)];
    await assertNoTagFilterConflict(tagIds);

    const ownOnly = mine === 'true' && userId;
    const publicOnly = publicOnlyParam === 'true';
    const filterUserId = isAdmin && targetUserId ? parseInt(targetUserId) : null;

    const result = await imageService.getImages({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sort, order, tagIds,
      privateTagUserId: selectedGroupIds.includes(MY_TAG_GROUP_ID) ? userId : null,
      albumId: album ? parseInt(album) : null,
      orientation, search,
      userId,
      publicOnly,
      ownOnly,
      isAdmin,
      excludePrivateAlbums: true,
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
    const requestedCount = parseRandomCount(count);
    const excludeIds = parseRandomExclusions(req.query.exclude);
    const useMedium = pic === 'md';
    const simpleUrl = req.query.simple_url === '1';
    if (req.query.simple_url !== undefined && !['0', '1'].includes(req.query.simple_url)) {
      return res.status(400).json({ error: 'simple_url 参数无效' });
    }
    if (req.query.simple_url !== undefined && requestedCount < 2) {
      return res.status(400).json({ error: 'simple_url 仅支持返回数量至少为 2 的随机图片' });
    }
    const user = await resolveUser(req);
    if (req.apiToken && !user) return res.status(403).json({ error: 'Token 所属用户不可用' });
    const userId = user?.id || null;
    const isAdmin = user?.role === 'admin';

    // tag_g 参数：按分组 ID 筛选（支持逗号分隔多值）
    // sid 参数：按子分组 sid 筛选（支持逗号分隔多值）
    // tags 参数：按标签 ID 筛选
    // 三者叠加（OR 逻辑）
    const groupData = await configService.readTagGroups();
    const groupIds = tag_g ? tag_g.split(',') : [];
    if (groupIds.some(id => !isMyTagGroup(id) && id !== '__system' && !/^\d+$/.test(id))) return res.status(400).json({ error: 'tag_g 参数无效' });
    if (groupIds.includes(MY_TAG_GROUP_ID) && !userId) return res.status(401).json({ error: '登录后才能筛选我的标签' });

    if (tag_g) {
      for (const gid of groupIds) {
        if (isMyTagGroup(gid) || gid === '__system') continue;
        const group = groupData.groups.find(g => Number(g.id) === Number(gid));
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
      excludeIds,
      strictAccess: !!req.apiToken,
      includeTags: requestedCount > 1 && !simpleUrl,
      excludePrivateAlbums: true,
      healthyOnly: true,
      privateTagUserId: groupIds.includes(MY_TAG_GROUP_ID) ? userId : null,
      tagIds: tagIds.length > 0 ? tagIds : null,
      albumId: album ? parseInt(album) : null,
      orientation,
      userId,
      isAdmin,
      publicOnly: !userId
    });

    if (images.length === 0) {
      return res.status(404).json({ error: '没有符合条件的图片' });
    }

    if (requestedCount > 1 || shouldRedirectRandomImage(req.query.jump)) {
      const baseUrl = await imageService.getPublicBaseUrl();
      const signed = images.map(image => temporaryImage(image, 'images:random', req.apiToken?.id || 0, process.env.JWT_SECRET, req.apiToken ? 0 : userId || 0));
      res.set('Cache-Control', 'private, no-store');
      if (requestedCount === 1) {
        return res.redirect(302, baseUrl + (useMedium ? signed[0].medium_url : signed[0].url));
      }
      if (simpleUrl) return res.json({ images: signed });
      const requestOrigin = `${req.protocol}://${req.get('host')}`;
      return res.json({ images: signed.map((item, index) => ({
          id: item.id,
          filename: item.filename,
          tags: (images[index].tags || [])
            .filter(tag => tag.source === 'user'
              ? tag.is_public === true || tag.is_public === 1 || (userId && Number(tag.user_id) === Number(userId))
              : isAdmin || tag.is_public !== false && tag.is_public !== 0)
            .map(tag => ({
              id: tag.source === 'user' ? `u${tag.id}` : tag.id,
              name: tag.name,
              display_name: tag.display_name || tag.name
            })),
          url: new URL(item.url, requestOrigin).href,
          ...(!useMedium ? { thumb_url: new URL(item.thumb_url, requestOrigin).href } : {}),
          medium_url: new URL(item.medium_url, requestOrigin).href
      })) });
    }

    // count=1 时直接返回图片二进制
    if (requestedCount === 1) {
      const image = images[0];
      let filePath;

      if (useMedium) {
        const realPath = path.resolve(__dirname, '../../..', image.path);
        filePath = imageProcessor.getExistingThumbnailPath(realPath, 'medium').find(candidate => fs.existsSync(candidate)) || realPath;
        if (filePath === realPath && fs.existsSync(realPath)) {
          await imageProcessor.generateDerivedThumbnails(realPath).catch(() => {});
          filePath = imageProcessor.getExistingThumbnailPath(realPath, 'medium').find(candidate => fs.existsSync(candidate)) || realPath;
        }
      } else {
        filePath = path.resolve(__dirname, '../../..', image.path);
      }

      if (fs.existsSync(filePath)) {
        const originalPath = path.resolve(__dirname, '../../..', image.path);
        res.set('Content-Type', filePath === originalPath ? (image.mime_type || 'image/jpeg') : 'image/jpeg');
        res.set('Cache-Control', 'private, no-store, max-age=0');
        return res.sendFile(filePath);
      }
      return res.status(404).json({ error: '图片文件不存在' });
    }

  } catch (err) {
    next(err);
  }
});

// 单图片详情
router.get('/:id', async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    const userId = user?.id || null;
    const isAdmin = user?.role === 'admin';
    const image = await imageService.getImageById(parseInt(req.params.id));
    if (!image) return res.status(404).json({ error: '图片不存在' });
    let isPublicAlbum = false;
    if (image.album_id) {
      const album = await db('albums').where({ id: image.album_id }).select('is_public', 'is_private').first();
      if (album?.is_private) return res.status(403).json({ error: '私密相册图片不允许通过对外接口访问' });
      isPublicAlbum = album?.is_public === true || album?.is_public === 1;
    }
    if (!isAdmin && image.uploader_id !== userId && !isPublicAlbum && !image.is_public) {
      return res.status(403).json({ error: '无权访问此图片' });
    }
    if (!isAdmin && (image.nsfw_status === true || image.nsfw_status === 1)) {
      return res.status(403).json({ error: '图片已标记为不健康内容' });
    }
    res.json(image);
  } catch (err) {
    next(err);
  }
});

export default router;
