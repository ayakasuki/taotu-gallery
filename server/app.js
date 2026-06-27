require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./config/logger');

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

// 图片静态文件服务（哈希路径映射）
const imageService = require('./services/imageService');
app.use('/image', async (req, res, next) => {
  try {
    if (!isHashImageAssetPath(req.path)) return next();

    // 从哈希路径解析真实文件: /image/2026-06-24/abc123.jpg → 查找数据库
    const hashPath = 'image' + req.path; // 拼接完整 hash_path: image/2026-06-24/abc123.jpg
    const record = await imageService.getImageByHashPath(hashPath);
    if (record) {
      const realPath = path.resolve(__dirname, '..', record.path);
      if (fs.existsSync(realPath)) {
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
      const ext = path.extname(record.path);
      const baseName = path.basename(record.path, ext);
      const dirName = path.dirname(record.path);
      const thumbPath = path.resolve(__dirname, '..', dirName, '.thumbs', `${baseName}_${size}${ext}`);
      if (fs.existsSync(thumbPath)) {
        return res.sendFile(thumbPath);
      }
      const realPath = path.resolve(__dirname, '..', record.path);
      if (fs.existsSync(realPath)) {
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

// API 调用日志（对外 API）
const apiLogger = require('./middleware/apiLogger');

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

// 管理 API 路由
app.use('/api/admin/auth', require('./routes/admin/auth'));
app.use('/api/admin/tags', require('./routes/admin/tags'));
app.use('/api/admin/tag-convert', require('./routes/admin/tagConvert'));
app.use('/api/admin/tag-groups', require('./routes/admin/tagGroups'));
app.use('/api/admin/albums', require('./routes/admin/albums'));
app.use('/api/admin/images', require('./routes/admin/images'));
app.use('/api/admin/models', require('./routes/admin/models'));
app.use('/api/admin/conditions', require('./routes/admin/conditions'));
app.use('/api/admin/database', require('./routes/admin/database'));
app.use('/api/admin/gallery', require('./routes/admin/gallery'));
app.use('/api/admin/api', require('./routes/admin/api'));
app.use('/api/admin/site-config', require('./routes/admin/siteConfig'));
app.use('/api/admin/users', require('./routes/admin/users'));
app.use('/api/admin/stats', require('./routes/admin/stats'));
app.use('/api/admin/backup', require('./routes/admin/backup'));
app.use('/api/admin/restore', require('./routes/admin/restore'));
app.use('/api/admin/cloud-sync', require('./routes/admin/cloudSync'));

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
