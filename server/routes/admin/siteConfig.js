const express = require('express');
const authMiddleware = require('../../middleware/auth');
const configService = require('../../services/configService');

const router = express.Router();

// 公开站点信息（无需登录，用于前端标题、注册判断等）
router.get('/public', async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    res.json({
      siteName: siteConfig.siteName || '桃图智库',
      publicDomain: siteConfig.publicDomain || '',
      registration: siteConfig.registration || { enabled: false }
    });
  } catch (err) {
    next(err);
  }
});

// 获取完整网站配置（需登录）
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    res.json(siteConfig);
  } catch (err) {
    next(err);
  }
});

// 更新网站配置（需登录）
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
