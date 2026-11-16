/**
 * 管理后台 - 相册管理（权限隔离）
 */
import express from 'express';

import authMiddleware from '../../middleware/auth.js';
import albumService from '../../services/albumService.js';
import db from '../../db/index.js';

const router = express.Router();

// 获取相册列表
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { page, limit, sort, order, tags, mine, public: publicOnly, userId: targetUserId, userGallery, search } = req.query;
    const tagIds = tags ? tags.split(',').map(Number) : null;
    const user = await db('users').where({ id: req.user.id }).first();
    const isAdmin = user?.role === 'admin';

    const result = await albumService.getAlbums({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sort, order, tagIds,
      userId: req.user.id,
      publicOnly: publicOnly === 'true',
      ownOnly: mine === 'true' || !isAdmin,
      isAdmin,
      excludePrivateAlbums: !!req.apiToken,
      filterUserId: isAdmin && targetUserId ? parseInt(targetUserId) : null,
      userGalleryOnly: isAdmin && userGallery === 'true',
      search: search || ''
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 创建相册
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    if (req.apiToken && req.body.is_private) return res.status(403).json({ error: '私密相册只能在登录后的站内管理' });
    const album = await albumService.createAlbum({
      ...req.body,
      user_id: req.user.id
    });
    res.json(album);
  } catch (err) {
    next(err);
  }
});

// 更新相册（仅所有者或管理员）
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const album = await db('albums').where({ id: req.params.id }).first();
    if (!album) return res.status(404).json({ error: '相册不存在' });
    if (req.apiToken && (album.is_private || req.body.is_private)) return res.status(403).json({ error: '私密相册只能在登录后的站内管理' });

    const user = await db('users').where({ id: req.user.id }).first();
    if (user.role !== 'admin' && album.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权修改此相册' });
    }

    const updated = await albumService.updateAlbum(parseInt(req.params.id), req.body, { userId: req.user.id, isAdmin: user.role === 'admin', external: !!req.apiToken });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// 批量更新相册内图片公开状态（仅所有者或管理员）
router.put('/:id/images-public', authMiddleware, async (req, res, next) => {
  try {
    const album = await db('albums').where({ id: req.params.id }).first();
    if (!album) return res.status(404).json({ error: '相册不存在' });

    const user = await db('users').where({ id: req.user.id }).first();
    if (user.role !== 'admin' && album.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权修改此相册' });
    }

    const isPublic = req.body?.is_public === true;
    const count = await db.transaction(async trx => {
      const current = await trx('albums').where({ id: album.id }).forUpdate().first();
      if (current.is_private && req.apiToken) {
        const error = new Error('私密相册只能在登录后的站内管理');
        error.statusCode = 403;
        throw error;
      }
      if (current.is_private && isPublic) {
        const error = new Error('非法请求：私密相册不能公开图片');
        error.statusCode = 400;
        throw error;
      }
      const updated = await trx('images')
        .where({ album_id: album.id })
        .update({ is_public: isPublic ? 1 : 0, updated_at: trx.fn.now() });
      await trx('albums')
        .where({ id: album.id })
        .update({ all_picture_public: isPublic ? 1 : 0, updated_at: trx.fn.now() });
      return updated;
    });

    res.json({ album_id: album.id, is_public: isPublic, all_picture_public: isPublic, updated: count });
  } catch (err) {
    next(err);
  }
});

// 删除相册（仅所有者或管理员）
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const album = await db('albums').where({ id: req.params.id }).first();
    if (!album) return res.status(404).json({ error: '相册不存在' });
    if (req.apiToken && album.is_private) return res.status(403).json({ error: '私密相册只能在登录后的站内管理' });

    const user = await db('users').where({ id: req.user.id }).first();
    if (user.role !== 'admin' && album.user_id !== req.user.id) {
      return res.status(403).json({ error: '无权删除此相册' });
    }

    await albumService.deleteAlbum(parseInt(req.params.id));
    res.json({ message: '相册已删除' });
  } catch (err) {
    next(err);
  }
});

export default router;
