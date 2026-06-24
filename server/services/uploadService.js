/**
 * 上传服务
 * 处理单上传、批量上传、接口上传
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');
const imageProcessor = require('../utils/imageProcessor');
const pathUtils = require('../utils/pathUtils');
const imageService = require('./imageService');
const logger = require('../config/logger');

// Multer 存储配置
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const today = new Date().toISOString().split('T')[0]; // 2024-01-01
    const uploadDir = path.join(config.uploadsDir, today);
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
  }
};

// Multer 实例
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.uploadLimits.fileSize,
    files: config.uploadLimits.maxFiles
  }
});

// 处理上传后的图片
async function processUploadedFile(file, albumId = null, tags = [], userId = null, isPublic = false) {
  const relativePath = pathUtils.toRelativePath(file.path);

  // 获取图片元信息
  const meta = await imageProcessor.getImageMeta(file.path);

  // 生成缩略图
  await imageProcessor.generateThumbnails(file.path);

  // 生成哈希路径（对外展示用，不暴露本地路径）
  const hashPath = imageService.generateHashPath(file.originalname);

  // 写入数据库
  const [imageId] = await db('images').insert({
    filename: file.originalname,
    path: relativePath,
    hash_path: hashPath,
    original_path: file.path,
    width: meta.width,
    height: meta.height,
    size_bytes: file.size,
    mime_type: file.mimetype,
    avg_color: meta.avg_color,
    orientation: meta.orientation,
    upload_source: 'upload',
    album_id: albumId,
    uploader_id: userId || null,
    is_public: isPublic
  });

  // 写入标签
  if (tags && tags.length > 0) {
    const tagService = require('./tagService');
    await tagService.setImageTags(imageId, tags, 'manual');
  }

  // 立即对新图片执行条件标签
  try {
    const conditionTagService = require('./conditionTagService');
    const matchedConditions = await conditionTagService.tagImageByConditions(imageId);
    if (matchedConditions.length > 0) {
      for (const cond of matchedConditions) {
        await db('image_tags').insert({
          image_id: imageId,
          tag_id: cond.id,
          source: 'condition',
          source_detail: `condition_${cond.id}`
        }).onConflict(['image_id', 'tag_id']).ignore();
      }
      logger.info(`新图片条件标签: ${file.originalname} 匹配 ${matchedConditions.length} 个条件`);
    }
  } catch (condErr) {
    logger.warn(`新图片条件标签执行失败: ${condErr.message}`);
  }

  // 记录上传日志
  await db('upload_logs').insert({
    image_id: imageId,
    source: file.size > 5000000 ? 'batch' : 'single',
    status: 'success',
    result_url: `/gallery/${relativePath}`
  });

  logger.info(`上传成功: ${file.originalname} -> ${hashPath}`);

  const urls = imageService.buildImageUrls({ hash_path: hashPath });

  return {
    id: imageId,
    filename: file.originalname,
    path: relativePath,
    hash_path: hashPath,
    width: meta.width,
    height: meta.height,
    size: file.size,
    url: urls.url
  };
}

// 批量处理上传文件
async function processUploadedFiles(files, albumId = null, tags = [], userId = null, isPublic = false) {
  const results = [];
  for (const file of files) {
    try {
      const result = await processUploadedFile(file, albumId, tags, userId, isPublic);
      results.push({ success: true, ...result });
    } catch (err) {
      logger.error(`上传处理失败: ${file.originalname} - ${err.message}`);
      results.push({ success: false, filename: file.originalname, error: err.message });
    }
  }
  return results;
}

// 获取上传日志
async function getUploadLogs(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const logs = await db('upload_logs')
    .orderBy('created_at', 'desc')
    .offset(offset)
    .limit(limit);
  const [{ count }] = await db('upload_logs').count('* as count');
  return { logs, total: count, page, limit };
}

module.exports = {
  upload,
  processUploadedFile,
  processUploadedFiles,
  getUploadLogs
};
