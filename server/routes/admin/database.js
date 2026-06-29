const express = require('express');
const authMiddleware = require('../../middleware/auth');
const db = require('../../db');

const router = express.Router();

// 数据库连接状态
router.get('/status', authMiddleware, async (req, res, next) => {
  try {
    const [versionResult] = await db.raw('SELECT VERSION() as version');
    const versionRow = Array.isArray(versionResult) ? versionResult[0] : versionResult?.[0];
    const [
      imageCount,
      albumCount,
      publicTagCount,
      userTagCount,
      userCount
    ] = await Promise.all([
      db('images').count('* as count').first(),
      db('albums').count('* as count').first(),
      db('tags').count('* as count').first(),
      db('user_tags').count('* as count').first(),
      db('users').count('* as count').first()
    ]);

    res.json({
      connected: true,
      message: '数据库连接正常',
      type: 'MySQL',
      version: versionRow?.version || '',
      database: process.env.DB_NAME || '',
      host: process.env.DB_HOST || '',
      path: process.env.DB_NAME || '',
      stats: {
        totalImages: Number(imageCount?.count || 0),
        totalAlbums: Number(albumCount?.count || 0),
        totalTags: Number(publicTagCount?.count || 0) + Number(userTagCount?.count || 0),
        totalUsers: Number(userCount?.count || 0)
      }
    });
  } catch (err) {
    next(err);
  }
});

// 数据库配置（只读展示，不含密码）
router.get('/config', authMiddleware, async (req, res) => {
  res.json({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    database: process.env.DB_NAME || 'gallery_index'  // 数据库名保持不变，仅显示用
  });
});

// 数据库日志（占位）
router.get('/logs', authMiddleware, async (req, res) => {
  res.json({ logs: [] });
});

module.exports = router;
