/**
 * 上传服务
 * 处理单上传、批量上传、接口上传
 */
import multer from 'multer';

import path from 'path';
import {promises as fs} from 'fs';
import {v4 as uuidv4} from 'uuid';
import db from '../db/index.js';
import config from '../config/index.js';
import imageProcessor from '../utils/imageProcessor.js';
import pathUtils from '../utils/pathUtils.js';
import imageService from './imageService.js';
import logger from '../config/logger.js';
import configService from './configService.js';
import tagService from './tagService.js';
import conditionTagService from './conditionTagService.js';

// Multer 存储配置
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const today = new Date().toISOString().split('T')[0];
    const uploadDir = path.join(config.uploadsDir, today);
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 修复中文文件名编码：浏览器可能用 latin1 传输，需转为 utf8
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

// 检查用户配额
async function checkUserQuota(userId, fileSize) {
  if (!userId) return { ok: true };

  const user = await db('users').where({ id: userId }).first();
  if (!user || user.role === 'admin') return { ok: true }; // 管理员不受限

  const siteConfig = await configService.readSiteConfig();
  const defaultQuota = siteConfig.defaultQuota || {};

  // 检查单文件大小
  const maxFileSize = user.max_file_size || (defaultQuota.maxFileSize || 0) * 1024 * 1024;
  if (maxFileSize > 0 && fileSize > maxFileSize) {
    return { ok: false, error: `文件大小 ${Math.round(fileSize / 1024 / 1024)}MB 超出限制 ${Math.round(maxFileSize / 1024 / 1024)}MB` };
  }

  // 检查存储配额
  const storageLimit = user.storage_limit || (defaultQuota.storageLimit || 0);
  if (storageLimit > 0) {
    const [{ used }] = await db('images').where({ uploader_id: userId }).sum('size_bytes as used');
    if ((used || 0) + fileSize > storageLimit) {
      return { ok: false, error: `存储空间不足。已用 ${Math.round((used || 0) / 1024 / 1024)}MB，上限 ${Math.round(storageLimit / 1024 / 1024)}MB` };
    }
  }

  return { ok: true };
}

function normalizeAllowedFormats(formats) {
  const allowed = Array.isArray(formats) ? formats : ['jpg', 'png', 'webp', 'gif'];
  return new Set(allowed.map(format => String(format || '').toLowerCase().replace('jpeg', 'jpg')));
}

function mimetypeToFormat(mimetype) {
  const normalized = String(mimetype || '').toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/gif') return 'gif';
  if (normalized === 'image/bmp') return 'bmp';
  return '';
}

// 文件过滤器
const fileFilter = async (req, file, cb) => {
  try {
      const siteConfig = await configService.readSiteConfig();
    const allowedFormats = normalizeAllowedFormats(siteConfig.imageProcessing?.formats);
    const currentFormat = mimetypeToFormat(file.mimetype);
    if (allowedFormats.has(currentFormat)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
    }
  } catch (err) {
    cb(err, false);
  }
};

function buildUpload(maxFileSizeBytes) {
  const limits = { files: config.uploadLimits.maxFiles };
  const maxFileSize = Number(maxFileSizeBytes);
  if (Number.isFinite(maxFileSize) && maxFileSize > 0) {
    limits.fileSize = maxFileSize;
  } else if (maxFileSizeBytes === undefined) {
    limits.fileSize = config.uploadLimits.fileSize;
  }
  return multer({ storage, fileFilter, limits });
}

// Multer 实例：保留旧入口，普通上传路由使用下面的动态入口读取站点配置。
const upload = buildUpload();

async function uploadFiles(req, res, next) {
  try {
      const siteConfig = await configService.readSiteConfig();
    const user = req.user?.id ? await db('users').where({ id: req.user.id }).first() : null;
    const userLimit = Number(user?.max_file_size || 0);
    const defaultLimit = Number(siteConfig.defaultQuota?.maxFileSize || 0) * 1024 * 1024;
    const effectiveLimit = user?.role === 'admin' ? 0 : (userLimit > 0 ? userLimit : defaultLimit);
    return buildUpload(effectiveLimit).array('files', config.uploadLimits.maxFiles)(req, res, next);
  } catch (err) {
    next(err);
  }
}

// 处理上传后的图片
async function processUploadedFile(file, albumId = null, tags = [], userId = null, isPublic = false, userTagIds = []) {
  const relativePath = pathUtils.toRelativePath(file.path);

  // 获取图片元信息
  const meta = await imageProcessor.getImageMeta(file.path);

  // 生成缩略图
  const siteConfig = await configService.readSiteConfig();
  const mediumOpts = siteConfig.mediumSize || {};
  const processingOpts = siteConfig.imageProcessing || {};
  await imageProcessor.generateThumbnails(file.path, {
    mediumWidth: mediumOpts.width,
    mediumHeight: mediumOpts.height,
    quality: processingOpts.quality
  });

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

  // 写入公共标签
  if (tags && tags.length > 0) {
    await tagService.setImageTags(imageId, tags, 'manual');
  }

  // 写入用户私有标签
  if (userTagIds && userTagIds.length > 0) {
    for (const userTagId of userTagIds) {
      try {
        await db('image_tags').insert({
          image_id: imageId,
          tag_id: -userTagId,
          source: 'manual',
          user_tag_id: userTagId,
          tag_user_id: userId
        }).onConflict(['image_id', 'tag_id']).ignore();
      } catch (err) {
        logger.warn(`用户标签写入失败: ${err.message}`);
      }
    }
  }

  // 立即对新图片执行条件标签
  try {
    const matchedConditions = await conditionTagService.tagImageByConditions(imageId);
    if (matchedConditions.length > 0) {
      for (const cond of matchedConditions) {
        await conditionTagService.insertConditionTag(imageId, cond);
      }
      logger.info(`新图片条件标签: ${file.originalname} 匹配 ${matchedConditions.length} 个条件`);
    }
  } catch (condErr) {
    logger.warn(`新图片条件标签执行失败: ${condErr.message}`);
  }

  // 自动设置相册封面（如果相册没有封面）
  if (albumId) {
    try {
      const album = await db('albums').where({ id: albumId }).first();
      if (album && !album.cover_image_id) {
        await db('albums').where({ id: albumId }).update({ cover_image_id: imageId });
        logger.info(`自动设置相册 ${albumId} 封面: 图片 ${imageId}`);
      }
    } catch (err) {
      logger.warn(`自动设置封面失败: ${err.message}`);
    }
  }

  // 记录上传日志
  // 自动设置相册封面（如果相册没有封面）
  if (albumId) {
    try {
      const album = await db('albums').where({ id: albumId }).first();
      if (album && !album.cover_image_id) {
        await db('albums').where({ id: albumId }).update({ cover_image_id: imageId });
        logger.info(`自动设置相册 ${albumId} 封面: 图片 ${imageId}`);
      }
    } catch (err) {
      logger.warn(`自动设置封面失败: ${err.message}`);
    }
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
  const baseUrl = await imageService.getPublicBaseUrl();

  return {
    id: imageId,
    filename: file.originalname,
    path: relativePath,
    hash_path: hashPath,
    width: meta.width,
    height: meta.height,
    size: file.size,
    url: urls.url,
    source_url: baseUrl + urls.url,
    thumb_url: baseUrl + urls.thumb_url,
    medium_url: baseUrl + urls.medium_url
  };
}

// 批量处理上传文件
async function processUploadedFiles(files, albumId = null, tags = [], userId = null, isPublic = false, userTagIds = []) {
  const results = [];
  for (const file of files) {
    try {
      const result = await processUploadedFile(file, albumId, tags, userId, isPublic, userTagIds);
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

export default {
  upload,
  uploadFiles,
  processUploadedFile,
  processUploadedFiles,
  getUploadLogs,
  checkUserQuota
};
