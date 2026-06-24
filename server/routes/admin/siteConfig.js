const express = require('express');
const authMiddleware = require('../../middleware/auth');
const configService = require('../../services/configService');

const router = express.Router();

// 获取网站配置
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    res.json(siteConfig);
  } catch (err) {
    next(err);
  }
});

// 更新网站配置
router.put('/', authMiddleware, async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    const updated = { ...siteConfig, ...req.body };
    await configService.writeSiteConfig(updated);
    res.json({ message: '网站配置已更新' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
