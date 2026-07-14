/**
 * 管理后台 - 恢复 API
 */
import express from 'express';

import authMiddleware from '../../middleware/auth.js';
import restoreService from '../../services/restoreService.js';
import backupService from '../../services/backupService.js';

const router = express.Router();

// 解析备份包可恢复内容
router.get('/inspect/:filename', authMiddleware, async (req, res, next) => {
  try {
    const result = await restoreService.inspectBackup(req.params.filename);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 从备份恢复
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { filename, options = {} } = req.body;
    if (!filename) {
      return res.status(400).json({ error: '请提供备份文件名' });
    }

    const backupPath = backupService.getSafeBackupPath(filename);
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

export default router;
