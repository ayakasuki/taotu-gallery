const express = require('express');
const authMiddleware = require('../../middleware/auth');
const db = require('../../db');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const logger = require('../../config/logger');

const router = express.Router();

// 用户列表（含存储用量）
router.get('/', authMiddleware, async (req, res) => {
  const users = await db('users')
    .select('id', 'username', 'email', 'role', 'storage_limit', 'max_file_size', 'last_login_at', 'created_at');
  for (const u of users) {
    const [{ used }] = await db('images').where({ uploader_id: u.id }).sum('size_bytes as used');
    u.used_storage = used || 0;
  }
  res.json({ users });
});

// 创建用户
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    const { username, password, email, role, storage_limit, max_file_size } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const [id] = await db('users').insert({
      username, password_hash: passwordHash, email, role: role || 'user',
      storage_limit: storage_limit || 0, max_file_size: max_file_size || 0
    });
    res.json({ id, username, email, role: role || 'user' });
  } catch (err) { next(err); }
});

// 更新用户
router.put('/:id', authMiddleware, async (req, res) => {
  const { email, role, storage_limit, max_file_size } = req.body;
  const updates = {};
  if (email !== undefined) updates.email = email;
  if (role !== undefined) updates.role = role;
  if (storage_limit !== undefined) updates.storage_limit = storage_limit;
  if (max_file_size !== undefined) updates.max_file_size = max_file_size;
  await db('users').where({ id: req.params.id }).update(updates);
  res.json({ message: '用户已更新' });
});

// 删除用户（彻底清理：Token、相册、图片、标签、文件）
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await db('users').where({ id: userId }).first();
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (user.role === 'admin') return res.status(400).json({ error: '不能删除管理员账号' });

    // 1. 删除用户的 API Token
    const tokenCount = await db('api_tokens').where({ user_id: userId }).del();
    logger.info(`删除用户 ${userId} 的 ${tokenCount} 个 Token`);

    // 2. 删除用户的私有标签关联
    const userTagIds = await db('user_tags').where({ user_id: userId }).select('id');
    for (const ut of userTagIds) {
      await db('image_tags').where({ user_tag_id: ut.id }).del();
    }
    const tagCount = await db('user_tags').where({ user_id: userId }).del();
    logger.info(`删除用户 ${userId} 的 ${tagCount} 个私有标签`);

    // 3. 获取用户的所有图片
    const userImages = await db('images').where({ uploader_id: userId }).select('id', 'path');
    const imageIds = userImages.map(img => img.id);

    if (imageIds.length > 0) {
      // 4. 删除图片标签关联
      await db('image_tags').whereIn('image_id', imageIds).del();

      // 5. 删除图片文件（只删除上传的，不删除本地扫描的）
      let deletedFiles = 0;
      for (const img of userImages) {
        if (img.path) {
          const fullPath = path.resolve(config.projectRoot, img.path);
          try {
            await fs.unlink(fullPath);
            // 删除缩略图
            const ext = path.extname(img.path);
            const baseName = path.basename(img.path, ext);
            const dirName = path.dirname(img.path);
            const thumbDir = path.resolve(config.projectRoot, dirName, '.thumbs');
            await fs.unlink(path.join(thumbDir, `${baseName}_thumb${ext}`)).catch(() => {});
            await fs.unlink(path.join(thumbDir, `${baseName}_medium${ext}`)).catch(() => {});
            deletedFiles++;
          } catch {}
        }
      }
      logger.info(`删除用户 ${userId} 的 ${deletedFiles} 个图片文件`);

      // 6. 删除图片数据库记录
      await db('images').whereIn('id', imageIds).del();
      logger.info(`删除用户 ${userId} 的 ${imageIds.length} 条图片记录`);
    }

    // 7. 删除用户的相册标签关联
    const userAlbums = await db('albums').where({ user_id: userId }).select('id');
    const albumIds = userAlbums.map(a => a.id);
    if (albumIds.length > 0) {
      await db('album_tags').whereIn('album_id', albumIds).del();
      await db('albums').whereIn('id', albumIds).del();
      logger.info(`删除用户 ${userId} 的 ${albumIds.length} 个相册`);
    }

    // 8. 删除上传日志
    await db('upload_logs').where({ user_id: userId }).del();

    // 9. 最后删除用户本身
    await db('users').where({ id: userId }).del();
    logger.info(`用户 ${user.username} (ID:${userId}) 已彻底删除`);

    res.json({
      message: `用户 ${user.username} 已彻底删除`,
      cleaned: {
        tokens: tokenCount,
        tags: tagCount,
        images: imageIds.length,
        albums: albumIds.length
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
