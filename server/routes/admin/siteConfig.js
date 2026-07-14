import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import authMiddleware from '../../middleware/auth.js';
import configService from '../../services/configService.js';
import mailService from '../../services/mailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageInfo = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../package.json'), 'utf8'));

const router = express.Router();

const uploadsDir = path.resolve(__dirname, '../../../data/uploads');
const tmpUploadDir = path.join(uploadsDir, 'tmp');
if (!fs.existsSync(tmpUploadDir)) fs.mkdirSync(tmpUploadDir, { recursive: true });

const defaultBackground = {
  type: 'default',
  value: '/site_bg.png',
  blur: 0,
  overlayTop: 'rgba(255, 255, 255, 0.08)',
  overlayBottom: 'rgba(255, 246, 250, 0.42)'
};

function withDefaultBackground(background = {}) {
  const merged = { ...defaultBackground, ...(background || {}) };
  if (!merged.value) {
    merged.type = 'default';
    merged.value = defaultBackground.value;
  }
  return merged;
}

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
      appVersion: packageInfo.version || '0.0.0',
      legalVersion: siteConfig.legalVersion || packageInfo.version || '0.0.0',
      publicDomain: siteConfig.publicDomain || '',
      recordNumber: siteConfig.recordNumber || '',
      registration: siteConfig.registration || { enabled: false, emailVerification: false, requireReview: false, maxUsers: 0 },
      background: withDefaultBackground(siteConfig.background),
      icon: siteConfig.icon || null,
      logo: null,
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
    const updated = { ...siteConfig, ...req.body, logo: null };
    await configService.writeSiteConfig(updated);
    res.json({ message: '网站配置已更新' });
  } catch (err) { next(err); }
});

// 发送 SMTP 测试邮件
router.post('/test-smtp', authMiddleware, requireAdmin, async (req, res, next) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: '请输入测试收件邮箱' });
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
    siteConfig.logo = null;
    await configService.writeSiteConfig(siteConfig);

    res.json({ url: `/uploads/site_icon${ext}` });
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
    siteConfig.background = {
      ...defaultBackground,
      ...(siteConfig.background || {}),
      type: 'upload',
      value: url
    };
    await configService.writeSiteConfig(siteConfig);

    res.json({ url });
  } catch (err) { next(err); }
});

export default router;
