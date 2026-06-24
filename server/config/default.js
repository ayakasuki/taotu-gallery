const path = require('path');

module.exports = {
  // 项目根目录
  projectRoot: path.resolve(__dirname, '../..'),

  // 数据目录
  dataDir: path.resolve(__dirname, '../../data'),
  galleryDir: path.resolve(__dirname, '../../data/gallery'),
  uploadsDir: path.resolve(__dirname, '../../data/uploads'),
  backupsDir: path.resolve(__dirname, '../../data/backups'),
  configDir: path.resolve(__dirname, '../../data/config'),

  // 配置文件路径
  tagsFile: path.resolve(__dirname, '../../data/config/tags.json'),
  pathsFile: path.resolve(__dirname, '../../data/config/paths.json'),
  conditionsFile: path.resolve(__dirname, '../../data/config/conditions.json'),
  siteFile: path.resolve(__dirname, '../../data/config/site.json'),

  // 上传限制
  uploadLimits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 100
  },

  // 图片处理
  thumbnails: {
    small: { width: 300, height: 300 },
    medium: { width: 1500, height: 1500 }
  },

  // 标签配置差异阈值（默认 50%）
  tagDiffThreshold: 0.5,

  // 标签延迟执行时间（分钟）
  tagDelayMinutes: 5
};
