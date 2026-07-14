require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./config/logger');
const db = require('./db');

const app = express();

// 基础中间件
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) }
}));

// 上传资源静态文件服务（站点 Logo、背景、用户头像等）
const uploadsStaticDir = path.resolve(__dirname, '../data/uploads');
if (!fs.existsSync(uploadsStaticDir)) fs.mkdirSync(uploadsStaticDir, { recursive: true });
app.use('/uploads', express.static(uploadsStaticDir));

function isHashImageAssetPath(reqPath) {
  return /^\/\d{4}-\d{2}-\d{2}\/[^/]+\.[A-Za-z0-9]+$/.test(reqPath);
}

function parseCookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((cookies, item) => {
    const index = item.indexOf('=');
    if (index <= 0) return cookies;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    if (!key) return cookies;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
    return cookies;
  }, {});
}

async function resolveMediaUser(req) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';
  const cookies = parseCookies(req);
  const jwtToken = bearerToken || req.query.auth || cookies.taotu_token;

  if (jwtToken) {
    try {
      const decoded = jwt.verify(String(jwtToken), process.env.JWT_SECRET);
      const user = await db('users')
        .where({ id: decoded.id })
        .select('id', 'username', 'role', 'is_disabled', 'review_status')
        .first();
      if (user && !user.is_disabled && user.review_status !== 'pending') return user;
    } catch {}
  }

  if (req.query.tk) {
    const tokenRecord = await db('api_tokens').where({ token: req.query.tk }).first();
    if (tokenRecord?.user_id) {
      await db('api_tokens').where({ id: tokenRecord.id }).update({ last_used_at: db.fn.now() });
      const user = await db('users')
        .where({ id: tokenRecord.user_id })
        .select('id', 'username', 'role', 'is_disabled', 'review_status')
        .first();
      if (user && !user.is_disabled && user.review_status !== 'pending') return user;
    }
  }

  return null;
}

async function canAccessImageAsset(req, record) {
  if (!record) return false;
  if (record.is_public === true || record.is_public === 1) return true;

  if (record.album_id) {
    const album = await db('albums').where({ id: record.album_id }).select('is_public').first();
    if (album?.is_public === true || album?.is_public === 1) return true;
  }

  const user = await resolveMediaUser(req);
  if (!user) return false;
  if (user.role === 'admin') return true;
  return record.uploader_id === user.id;
}

// 图片静态文件服务（哈希路径映射）
const imageService = require('./services/imageService');
const imageProcessor = require('./utils/imageProcessor');
app.use('/image', async (req, res, next) => {
  try {
    if (!isHashImageAssetPath(req.path)) return next();

    // 从哈希路径解析真实文件: /image/2026-06-24/abc123.jpg → 查找数据库
    const hashPath = 'image' + req.path; // 拼接完整 hash_path: image/2026-06-24/abc123.jpg
    const record = await imageService.getImageByHashPath(hashPath);
    if (record) {
      if (!(await canAccessImageAsset(req, record))) {
        return res.status(403).json({ error: '无权访问此图片' });
      }
      const realPath = path.resolve(__dirname, '..', record.path);
      if (fs.existsSync(realPath)) {
        if (!(record.is_public === true || record.is_public === 1)) {
          res.set('Cache-Control', 'private, no-cache, no-store, max-age=0');
        }
        return res.sendFile(realPath);
      }
    }
    res.status(404).json({ error: '图片不存在' });
  } catch (err) {
    next(err);
  }
});

// 缩略图静态文件
app.use('/thumb', async (req, res, next) => {
  try {
    const hashPath = 'image' + req.path;
    const size = req.query.s || 'thumb';
    const record = await imageService.getImageByHashPath(hashPath);
    if (record) {
      if (!(await canAccessImageAsset(req, record))) {
        return res.status(403).json({ error: '无权访问此图片' });
      }
      const realPath = path.resolve(__dirname, '..', record.path);
      if (!(record.is_public === true || record.is_public === 1)) {
        res.set('Cache-Control', 'private, no-cache, no-store, max-age=0');
      }
      for (const candidate of imageProcessor.getExistingThumbnailPath(realPath, size)) {
        if (fs.existsSync(candidate)) {
          return res.sendFile(candidate);
        }
      }
      if (fs.existsSync(realPath)) {
        await imageProcessor.generateDerivedThumbnails(realPath).catch(err => {
          logger.warn(`请求时生成缩略图失败: ${realPath} - ${err.message}`);
        });
        for (const candidate of imageProcessor.getExistingThumbnailPath(realPath, size)) {
          if (fs.existsSync(candidate)) {
            return res.sendFile(candidate);
          }
        }
        return res.sendFile(realPath);
      }
    }
    res.status(404).json({ error: '图片不存在' });
  } catch (err) {
    next(err);
  }
});

// 公开图库配置（前端首页默认展示使用，不含敏感配置）
app.get('/api/gallery/config', async (req, res, next) => {
  try {
    const configService = require('./services/configService');
    const siteConfig = await configService.readSiteConfig();
    const mode = siteConfig.display?.mode === 'waterfall' ? 'waterfall' : 'grid';
    res.json({ display: { mode }, upload: siteConfig.upload || { showUrlAfterUpload: true } });
  } catch (err) {
    next(err);
  }
});

// 公开联系信息（帮助中心使用，仅返回最早管理员邮箱）
app.get('/api/public/contact', async (req, res, next) => {
  try {
    const db = require('./db');
    const admin = await db('users')
      .where({ role: 'admin' })
      .orderBy('id', 'asc')
      .select('id', 'email')
      .first();
    const email = admin?.email || 'admin@example.com';
    const isDefaultEmail = !admin?.email || String(admin.email).trim().toLowerCase() === 'admin@example.com';
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json({ adminId: admin?.id || null, email, isDefaultEmail });
  } catch (err) {
    next(err);
  }
});

// API 调用日志（对外 API）
const apiLogger = require('./middleware/apiLogger');
const authMiddleware = require('./middleware/auth');
const requireAdmin = require('./middleware/requireAdmin');

// 内部 API（前端专用，不对外暴露）
app.use('/api/internal/images', require('./routes/internal/images'));
app.use('/api/internal/albums', require('./routes/internal/albums'));
app.use('/api/internal/dashboard', require('./routes/internal/dashboard'));

// 对外 API
app.use('/api/tags', apiLogger, require('./routes/api/tags'));
app.use('/api/tag-groups', require('./routes/api/tagGroups'));
app.use('/api/user-tags', require('./routes/api/userTags'));
app.use('/api/images', apiLogger, require('./routes/api/images'));
app.use('/api/albums', apiLogger, require('./routes/api/albums'));
app.use('/api/embed', apiLogger, require('./routes/api/embed'));
app.use('/api/upload', require('./routes/api/upload'));
app.use('/api/upload/url', require('./routes/api/urlUpload'));
app.use('/api/announcements', require('./routes/api/announcements'));

// 管理 API 路由
app.use('/api/admin/auth', require('./routes/admin/auth'));
app.use('/api/admin/tags', authMiddleware, requireAdmin, require('./routes/admin/tags'));
app.use('/api/admin/tag-convert', authMiddleware, requireAdmin, require('./routes/admin/tagConvert'));
app.use('/api/admin/tag-groups', authMiddleware, requireAdmin, require('./routes/admin/tagGroups'));
app.use('/api/admin/albums', require('./routes/admin/albums'));
app.use('/api/admin/images', require('./routes/admin/images'));
app.use('/api/admin/models', authMiddleware, requireAdmin, require('./routes/admin/models'));
app.use('/api/admin/conditions', authMiddleware, requireAdmin, require('./routes/admin/conditions'));
app.use('/api/admin/database', authMiddleware, requireAdmin, require('./routes/admin/database'));
app.use('/api/admin/gallery', authMiddleware, requireAdmin, require('./routes/admin/gallery'));
app.use('/api/admin/api', require('./routes/admin/api'));
app.use('/api/admin/site-config', require('./routes/admin/siteConfig'));
app.use('/api/admin/announcements', require('./routes/admin/announcements'));
app.use('/api/admin/users', authMiddleware, requireAdmin, require('./routes/admin/users'));
app.use('/api/admin/stats', authMiddleware, requireAdmin, require('./routes/admin/stats'));
app.use('/api/admin/backup', authMiddleware, requireAdmin, require('./routes/admin/backup'));
app.use('/api/admin/restore', authMiddleware, requireAdmin, require('./routes/admin/restore'));
app.use('/api/admin/cloud-sync', authMiddleware, requireAdmin, require('./routes/admin/cloudSync'));

// 前端静态文件服务（Nuxt generate 输出）
const clientDist = fs.existsSync(path.resolve(__dirname, '../client/.output/public'))
  ? path.resolve(__dirname, '../client/.output/public')
  : path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA 回退：非 API 路由全部返回 index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const indexPath = path.join(clientDist, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
  logger.info('前端静态文件已加载');
} else {
  logger.warn('前端未构建，运行 cd client && npx nuxt generate');
}

// 启动监听服务
const tagFileWatcher = require('./services/tagFileWatcher');
const galleryWatcher = require('./services/galleryWatcher');

setTimeout(() => {
  tagFileWatcher.startWatching();
  galleryWatcher.startWatching();
}, 2000);

// 全局错误处理
app.use(errorHandler);

module.exports = app;
