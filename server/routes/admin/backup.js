/**
 * 管理后台 - 备份 API
 */
import express from 'express';

import authMiddleware from '../../middleware/auth.js';
import backupService from '../../services/backupService.js';

const router = express.Router();

// 创建备份
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const options = req.body;
    const result = await backupService.createBackup(options);
    res.json({ message: '备份完成', ...result });
  } catch (err) {
    next(err);
  }
});

// 获取备份列表
router.get('/list', authMiddleware, async (req, res, next) => {
  try {
    const backups = await backupService.getBackupList();
    res.json({ backups });
  } catch (err) {
    next(err);
  }
});

// 删除备份
router.delete('/:filename', authMiddleware, async (req, res, next) => {
  try {
    await backupService.deleteBackup(req.params.filename);
    res.json({ message: '备份已删除' });
  } catch (err) {
    next(err);
  }
});

export default router;
