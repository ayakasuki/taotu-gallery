/**
 * 管理后台 - 云同步 API（WebDAV）
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const cloudSyncService = require('../../services/cloudSyncService');

const router = express.Router();

// 获取 WebDAV 配置
router.get('/config', authMiddleware, async (req, res, next) => {
  try {
    const config = await cloudSyncService.getWebDAVConfig();
    // 隐藏密码
    res.json({ ...config, password: config.password ? '******' : '' });
  } catch (err) {
    next(err);
  }
});

// 更新 WebDAV 配置
router.put('/config', authMiddleware, async (req, res, next) => {
  try {
    await cloudSyncService.saveWebDAVConfig(req.body);
    res.json({ message: 'WebDAV 配置已保存' });
  } catch (err) {
    next(err);
  }
});

// 获取最近同步状态
router.get('/status', authMiddleware, async (req, res, next) => {
  try {
    const status = await cloudSyncService.getSyncStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// 获取最近同步日志
router.get('/logs', authMiddleware, async (req, res, next) => {
  try {
    const logs = await cloudSyncService.getSyncLogs();
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

// 测试连接
router.post('/test', authMiddleware, async (req, res, next) => {
  try {
    const result = await cloudSyncService.testConnection();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 触发同步
router.post('/run', authMiddleware, async (req, res, next) => {
  try {
    const result = await cloudSyncService.sync();
    res.json({ message: '同步完成', ...result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
