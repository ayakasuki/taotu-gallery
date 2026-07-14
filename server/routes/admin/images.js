/**
 * 管理后台 - 图片管理 API
 */
import express from 'express';

import authMiddleware from '../../middleware/auth.js';
import db from '../../db/index.js';
import {promises as fs} from 'fs';
import path from 'path';
import config from '../../config/index.js';
import logger from '../../config/logger.js';
import imageProcessor from '../../utils/imageProcessor.js';

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

    const { is_public, album_id } = req.body;
    const updates = {};
    if (is_public !== undefined) updates.is_public = is_public;
    if (album_id !== undefined) updates.album_id = album_id;

    await db('images').where({ id: req.params.id }).update(updates);
    res.json({ message: '已更新' });
  } catch (err) {
    next(err);
  }
});

// 删除图片（仅所有者或管理员可删除）
// 自定义路径扫描的图片只删数据库记录，不删本地文件
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const image = await db('images').where({ id: req.params.id }).first();
    if (!image) return res.status(404).json({ error: '图片不存在' });

    // 权限检查：管理员或图片所有者
    const user = await db('users').where({ id: req.user.id }).first();
    if (user.role !== 'admin' && image.uploader_id !== req.user.id) {
      return res.status(403).json({ error: '无权删除此图片' });
    }

    // 删除标签关联
    await db('image_tags').where({ image_id: image.id }).del();

    // 只有上传的图片才删除本地文件，自定义路径扫描的不删
    const shouldDeleteFile = image.upload_source === 'upload' || image.upload_source === 'api';
    if (shouldDeleteFile) {
      const fullPath = path.resolve(config.projectRoot, image.path);
      try {
        await fs.unlink(fullPath);
        for (const thumbPath of imageProcessor.getExistingThumbnailPath(fullPath, 'thumb')) await fs.unlink(thumbPath).catch(() => {});
        for (const mediumPath of imageProcessor.getExistingThumbnailPath(fullPath, 'medium')) await fs.unlink(mediumPath).catch(() => {});
        await imageProcessor.removeDerivedThumbnailsForImage(fullPath).catch(() => {});
      } catch (err) {
        logger.warn(`删除文件失败: ${err.message}`);
      }
    }

    // 删除数据库记录
    await db('images').where({ id: image.id }).del();

    logger.info(`图片已删除: ${image.filename} (ID: ${image.id}, 来源: ${image.upload_source}, 删文件: ${shouldDeleteFile})`);
    res.json({ message: '图片已删除' });
  } catch (err) {
    next(err);
  }
});

export default router;
