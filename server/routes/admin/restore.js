/**
 * 管理后台 - 恢复 API
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const restoreService = require('../../services/restoreService');
const path = require('path');
const config = require('../../config');

const router = express.Router();

// 从备份恢复
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { filename, options = {} } = req.body;
    if (!filename) {
      return res.status(400).json({ error: '请提供备份文件名' });
    }

    const backupPath = path.join(config.backupsDir, filename);
    const result = await restoreService.restoreFromBackup(backupPath, options);
    res.json({ message: '恢复完成', ...result });
  } catch (err) {
    next(err);
  }
});

// 验证恢复后路径可读性
router.post('/verify', authMiddleware, async (req, res, next) => {
  try {
    const result = await restoreService.verifyRestoredPaths();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 路径规范化（独立操作）
router.post('/normalize-paths', authMiddleware, async (req, res, next) => {
  try {
    const result = await restoreService.normalizeAllImagePaths();
    res.json({ message: '路径规范化完成', ...result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
