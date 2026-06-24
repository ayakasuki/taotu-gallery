const express = require('express');
const authMiddleware = require('../../middleware/auth');
const configService = require('../../services/configService');
const galleryWatcher = require('../../services/galleryWatcher');

const router = express.Router();

// 获取图库配置
router.get('/config', authMiddleware, async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    const pathsConfig = await configService.readPaths();
    res.json({
      display: siteConfig.display || { mode: 'grid' },
      upload: siteConfig.upload || { showUrlAfterUpload: true },
      customPaths: pathsConfig.customPaths || []
    });
  } catch (err) {
    next(err);
  }
});

// 更新图库配置
router.put('/config', authMiddleware, async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    if (req.body.display) siteConfig.display = req.body.display;
    if (req.body.upload) siteConfig.upload = req.body.upload;
    await configService.writeSiteConfig(siteConfig);

    // 更新自定义路径
    if (req.body.customPaths) {
      await configService.writePaths({ galleryPaths: [], customPaths: req.body.customPaths });
    }

    res.json({ message: '图库配置已更新' });
  } catch (err) {
    next(err);
  }
});

// 立即扫描所有路径
router.post('/scan', authMiddleware, async (req, res, next) => {
  try {
    const result = await galleryWatcher.scanAndIndexAll();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
