const express = require('express');
const authMiddleware = require('../../middleware/auth');
const db = require('../../db');

const router = express.Router();

// 数据库连接状态
router.get('/status', authMiddleware, async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ connected: true, message: '数据库连接正常' });
  } catch (err) {
    res.json({ connected: false, message: err.message });
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
