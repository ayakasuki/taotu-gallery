/**
 * 内部 API - 当前用户仪表盘摘要
 */
import express from 'express';

import os from 'os';
import db from '../../db/index.js';
import authMiddleware from '../../middleware/auth.js';
import imageService from '../../services/imageService.js';
import configService from '../../services/configService.js';

const router = express.Router();

function toNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

router.get('/overview', authMiddleware, async (req, res, next) => {
  try {
    const user = await db('users')
      .where({ id: req.user.id })
      .select('id', 'username', 'role', 'email', 'avatar', 'storage_limit', 'last_login_at', 'created_at')
      .first();

    if (!user) return res.status(404).json({ error: '用户不存在' });

    const siteConfig = await configService.readSiteConfig();
    const defaultQuota = siteConfig.defaultQuota || {};
    const quotaBytes = toNumber(user.storage_limit) > 0
      ? toNumber(user.storage_limit)
      : toNumber(defaultQuota.storageLimit);

    const [[imageCount], [storage], [privateTagCount], [albumCount], recentUploads] = await Promise.all([
      db('images').where({ uploader_id: user.id }).count('* as count'),
      db('images').where({ uploader_id: user.id }).sum('size_bytes as used'),
      db('user_tags').where({ user_id: user.id }).count('* as count'),
      db('albums').where({ user_id: user.id }).count('* as count'),
      db('images')
        .where({ uploader_id: user.id })
        .select('id', 'filename', 'width', 'height', 'size_bytes', 'hash_path', 'created_at')
        .orderBy('created_at', 'desc')
        .limit(25)
    ]);

    const usedBytes = toNumber(storage.used);
    const normalizedRecent = recentUploads.map((image) => ({
      ...image,
      ...imageService.buildImageUrls(image)
    }));

    res.json({
      user,
      stats: {
        images: toNumber(imageCount.count),
        storage: usedBytes,
        privateTags: toNumber(privateTagCount.count),
        albums: toNumber(albumCount.count),
        quotaBytes,
        availableBytes: quotaBytes > 0 ? Math.max(quotaBytes - usedBytes, 0) : 0,
        storagePercent: quotaBytes > 0 ? Math.min((usedBytes / quotaBytes) * 100, 100) : 0
      },
      recentUploads: normalizedRecent,
      runtime: {
        platform: os.platform()
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
