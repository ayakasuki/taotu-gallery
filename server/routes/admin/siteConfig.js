const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../../middleware/auth');
const configService = require('../../services/configService');

const router = express.Router();

const uploadsDir = path.resolve(__dirname, '../../../data/uploads');
const tmpUploadDir = path.join(uploadsDir, 'tmp');
if (!fs.existsSync(tmpUploadDir)) fs.mkdirSync(tmpUploadDir, { recursive: true });

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

// 公开站点信息（无需登录）
router.get('/public', async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    res.json({
      siteName: siteConfig.siteName || '桃图智库',
      publicDomain: siteConfig.publicDomain || '',
      recordNumber: siteConfig.recordNumber || '',
      registration: siteConfig.registration || { enabled: false, emailVerification: false },
      background: siteConfig.background || { type: 'none', value: '' },
      icon: siteConfig.icon || null,
      logo: siteConfig.logo || null,
      mediumSize: siteConfig.mediumSize || { width: 1500, height: 1500 }
    });
  } catch (err) { next(err); }
});

// 获取完整网站配置（需登录）
router.get('/', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    res.json(siteConfig);
  } catch (err) { next(err); }
});

// 更新网站配置
router.put('/', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    const updated = { ...siteConfig, ...req.body };
    await configService.writeSiteConfig(updated);
    res.json({ message: '网站配置已更新' });
  } catch (err) { next(err); }
});

// 发送 SMTP 测试邮件
router.post('/test-smtp', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: '请输入测试收件邮箱' });
    const mailService = require('../../services/mailService');
    await mailService.testSmtp(to);
    res.json({ message: '测试邮件已发送' });
  } catch (err) { next(err); }
});

// 上传网站图标
router.post('/upload-icon', authMiddleware, requireAdmin, multer({ dest: tmpUploadDir }).single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择文件' });
    const ext = path.extname(req.file.originalname) || '.ico';
    const destPath = path.join(uploadsDir, `site_icon${ext}`);
    fs.renameSync(req.file.path, destPath);

    const siteConfig = await configService.readSiteConfig();
    siteConfig.icon = `/uploads/site_icon${ext}`;
    await configService.writeSiteConfig(siteConfig);

    res.json({ url: `/uploads/site_icon${ext}` });
  } catch (err) { next(err); }
});

// 上传网站 Logo
router.post('/upload-logo', authMiddleware, requireAdmin, multer({ dest: tmpUploadDir }).single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择文件' });
    const ext = path.extname(req.file.originalname) || '.png';
    const destPath = path.join(uploadsDir, `site_logo${ext}`);
    fs.renameSync(req.file.path, destPath);

    const siteConfig = await configService.readSiteConfig();
    siteConfig.logo = `/uploads/site_logo${ext}`;
    await configService.writeSiteConfig(siteConfig);

    res.json({ url: `/uploads/site_logo${ext}` });
  } catch (err) { next(err); }
});

// 上传背景图
router.post('/upload-bg', authMiddleware, requireAdmin, multer({ dest: tmpUploadDir }).single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择文件' });
    const ext = path.extname(req.file.originalname);
    const destPath = path.join(uploadsDir, `site_bg${ext}`);
    fs.renameSync(req.file.path, destPath);

    const url = `/uploads/site_bg${ext}`;
    const siteConfig = await configService.readSiteConfig();
    siteConfig.background = { type: 'upload', value: url };
    await configService.writeSiteConfig(siteConfig);

    res.json({ url });
  } catch (err) { next(err); }
});

module.exports = router;
