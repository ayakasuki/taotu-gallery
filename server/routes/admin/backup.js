/**
 * 管理后台 - 备份 API
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const backupService = require('../../services/backupService');

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

module.exports = router;
