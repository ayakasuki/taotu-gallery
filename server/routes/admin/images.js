/**
 * 管理后台 - 图片管理 API
 */
import express from 'express';

import authMiddleware from '../../middleware/auth.js';
import db from '../../db/index.js';
import storageDeleteService from '../../services/storageDeleteService.js';

const router = express.Router();

// 更新图片属性（如 is_public，仅所有者或管理员）
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const image = await db('images').where({ id: req.params.id }).first();
    if (!image) return res.status(404).json({ error: '图片不存在' });

    const user = await db('users').where({ id: req.user.id }).first();
    if (user.role !== 'admin' && image.uploader_id !== req.user.id) {
      return res.status(403).json({ error: '无权修改此图片' });
    }

    const { is_public, album_id, nsfw_status } = req.body;
    const updates = {};
    const currentAlbum = image.album_id ? await db('albums').where({ id: image.album_id }).first() : null;
    if (req.apiToken && currentAlbum?.is_private) return res.status(403).json({ error: '私密相册图片只能在登录后的站内管理' });
    const targetAlbum = album_id ? await db('albums').where({ id: album_id }).first() : album_id === null ? null : currentAlbum;
    if (album_id && (!targetAlbum || (user.role !== 'admin' && Number(targetAlbum.user_id) !== Number(req.user.id)))) {
      return res.status(403).json({ error: '无权移入此相册' });
    }
    if (req.apiToken && targetAlbum?.is_private) return res.status(403).json({ error: '私密相册图片只能在登录后的站内管理' });
    if (targetAlbum?.is_private && is_public !== undefined && ![false, 0].includes(is_public)) {
      return res.status(400).json({ error: '非法请求：私密相册图片不能公开' });
    }
    if (is_public !== undefined) updates.is_public = is_public;
    if (album_id !== undefined) updates.album_id = album_id;
    if (targetAlbum?.is_private) updates.is_public = false;

    if (nsfw_status !== undefined) {
      if (user.role !== 'admin') return res.status(403).json({ error: '只有管理员可以手动审查健康内容' });
      const allowedValues = [null, true, false, 0, 1, '0', '1', 'safe', 'unsafe', 'none'];
      if (!allowedValues.includes(nsfw_status)) {
        return res.status(400).json({ error: '健康内容状态无效' });
      }

      const normalizedStatus = nsfw_status === null || nsfw_status === 'none'
        ? null
        : ['unsafe', true, 1, '1'].includes(nsfw_status);
      updates.nsfw_status = normalizedStatus;
      if (normalizedStatus === null) {
        updates.nsfw_checked_at = null;
        updates.nsfw_engine = null;
        updates.nsfw_manual_marked = false;
        updates.nsfw_detail = JSON.stringify({ queued: true, reason: 'admin_manual_review_pending' });
      } else {
        updates.nsfw_checked_at = db.fn.now();
        updates.nsfw_engine = 'manual';
        updates.nsfw_manual_marked = true;
        updates.nsfw_detail = JSON.stringify({ manual: true, reason: 'admin_manual_review' });
      }
    }

    await db.transaction(async trx => {
      if (targetAlbum) {
        const lockedAlbum = await trx('albums').where({ id: targetAlbum.id }).forUpdate().first();
        if (lockedAlbum?.is_private) {
          if (req.apiToken) {
            const error = new Error('私密相册图片只能在登录后的站内管理');
            error.statusCode = 403;
            throw error;
          }
          if (is_public !== undefined && ![false, 0].includes(is_public)) {
            const error = new Error('非法请求：私密相册图片不能公开');
            error.statusCode = 400;
            throw error;
          }
          updates.is_public = false;
        }
      }
      await trx('images').where({ id: req.params.id }).update(updates);
      if (updates.nsfw_status === true || album_id !== undefined) {
        await trx('albums').where({ cover_image_id: image.id }).update({ cover_image_id: null });
      }
    });
    res.json({ message: '已更新' });
  } catch (err) {
    next(err);
  }
});

// 删除图片（仅所有者或管理员可删除）
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const image = await db('images').where({ id: req.params.id }).first();
    if (!image) return res.status(404).json({ error: '图片不存在' });

    // 权限检查：管理员或图片所有者
    const user = await db('users').where({ id: req.user.id }).first();
    if (user.role !== 'admin' && image.uploader_id !== req.user.id) {
      return res.status(403).json({ error: '无权删除此图片' });
    }
    if (req.apiToken && image.album_id) {
      const album = await db('albums').where({ id: image.album_id }).first();
      if (album?.is_private) return res.status(403).json({ error: '私密相册图片只能在登录后的站内管理' });
    }

    const deleted = await storageDeleteService.deleteImageRecord(image);
    res.json({ message: '图片已删除', deleted });
  } catch (err) {
    next(err);
  }
});

export default router;
