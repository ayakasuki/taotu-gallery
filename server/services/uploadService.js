/**
 * 上传服务
 * 处理单上传、批量上传、接口上传
 */
import multer from 'multer';

import path from 'path';
import {promises as fs} from 'fs';
import crypto from 'crypto';
import {v4 as uuidv4} from 'uuid';
import db from '../db/index.js';
import config from '../config/index.js';
import imageProcessor from '../utils/imageProcessor.js';
import pathUtils from '../utils/pathUtils.js';
import imageService from './imageService.js';
import logger from '../config/logger.js';
import tagService from './tagService.js';
import conditionTagService from './conditionTagService.js';
import nsfwService from './nsfwService.js';

const DEFAULT_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'ico'];

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function randomString(length = 16) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

function renderNameRule(rule, file, userId, includeExt = false) {
  const now = new Date();
  const ext = path.extname(file.originalname || '').toLowerCase();
  const basename = path.basename(file.originalname || 'image', ext);
  const uniqid = uuidv4();
  const md5 = crypto.createHash('md5').update(`${uniqid}-${file.originalname || ''}-${Date.now()}`).digest('hex');
  const values = {
    yyyy: String(now.getFullYear()),
    yy: String(now.getFullYear()).slice(-2),
    Y: String(now.getFullYear()),
    y: String(now.getFullYear()).slice(-2),
    mm: pad2(now.getMonth() + 1),
    m: pad2(now.getMonth() + 1),
    dd: pad2(now.getDate()),
    d: pad2(now.getDate()),
    timestamp: Math.floor(now.getTime() / 1000),
    uniqid,
    md5,
    'md5-16': md5.slice(0, 16),
    'str-random-16': randomString(16),
    'str-random-10': randomString(10),
    filename: basename,
    uid: userId || 'system'
  };
  const rendered = String(rule || (includeExt ? '{uniqid}' : '{yyyy}-{mm}-{dd}'))
    .replace(/\{([^}]+)\}/g, (_, key) => values[key] ?? '');
  if (includeExt) {
    const safeName = String(rendered || uniqid).replace(/[\\/:\0]/g, '_').trim() || uniqid;
    return `${safeName}${ext}`;
  }
  const safePath = rendered
    .replace(/\\/g, '/')
    .split('/')
    .map(segment => segment.replace(/[:\0]/g, '_').trim())
    .filter(segment => segment && segment !== '.' && segment !== '..')
    .join('/');
  return safePath || `${values.yyyy}-${values.mm}-${values.dd}`;
}

async function getUploadPolicy(req) {
  if (req._taotuUploadPolicy) return req._taotuUploadPolicy;
  const userId = req.user?.id || null;
  const user = userId ? await db('users').where({ id: userId }).first() : null;
  let group = null;
  if (user?.user_group_id) group = await db('user_groups').where({ id: user.user_group_id }).first();
  if (!group) group = await db('user_groups').where({ is_default: true }).first();
  const strategy = group
    ? await db('storage_strategies').where({ user_group_id: group.id }).orderBy('is_system_default', 'asc').orderBy('id', 'desc').first()
    : await db('storage_strategies').where({ is_system_default: true }).first();
  const fallbackStrategy = strategy || await db('storage_strategies').where({ is_system_default: true }).first();
  const strategyConfig = parseJson(fallbackStrategy?.config, {});
  req._taotuUploadPolicy = {
    user,
    group,
    strategy: fallbackStrategy,
    strategyConfig,
    allowedFormats: parseJson(group?.allowed_formats, DEFAULT_FORMATS),
    maxFileSizeBytes: Number(group?.max_file_size_mb || 0) > 0 ? Math.floor(Number(group.max_file_size_mb) * 1024 * 1024) : 0,
    maxFiles: Number(group?.max_concurrent_uploads || 0) > 0 ? Number(group.max_concurrent_uploads) : config.uploadLimits.maxFiles
  };
  return req._taotuUploadPolicy;
}

// Multer 存储配置
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const policy = await getUploadPolicy(req);
      if (policy.strategy && policy.strategy.type !== 'local') {
        return cb(new Error('当前存储策略暂未接入上传流，请先使用本地策略'));
      }
      const basePath = policy.strategyConfig?.basePath || config.uploadsDir;
      const uploadDir = path.resolve(basePath, renderNameRule(policy.group?.path_rule, file, req.user?.id, false));
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      cb(err);
    }
  },
  filename: async (req, file, cb) => {
    // 修复中文文件名编码：浏览器可能用 latin1 传输，需转为 utf8
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    try {
      const policy = await getUploadPolicy(req);
      cb(null, renderNameRule(policy.group?.filename_rule, file, req.user?.id, true));
    } catch (err) {
      cb(err);
    }
  }
});

// 检查用户配额
async function checkUserQuota(userId, fileSize) {
  if (!userId) return { ok: true };

  const user = await db('users').where({ id: userId }).first();
  if (!user || user.role === 'admin') return { ok: true }; // 管理员不受限

  const group = user.user_group_id
    ? await db('user_groups').where({ id: user.user_group_id }).first()
    : await db('user_groups').where({ is_default: true }).first();

  // 检查单文件大小
  const groupLimit = Number(group?.max_file_size_mb || 0) > 0 ? Number(group.max_file_size_mb) * 1024 * 1024 : 0;
  const maxFileSize = user.max_file_size || groupLimit;
  if (maxFileSize > 0 && fileSize > maxFileSize) {
    return { ok: false, error: `文件大小 ${Math.round(fileSize / 1024 / 1024)}MB 超出限制 ${Math.round(maxFileSize / 1024 / 1024)}MB` };
  }

  // 检查存储配额
  const storageLimit = user.storage_limit || 0;
  if (storageLimit > 0) {
    const [{ used }] = await db('images').where({ uploader_id: userId }).sum('size_bytes as used');
    if ((used || 0) + fileSize > storageLimit) {
      return { ok: false, error: `存储空间不足。已用 ${Math.round((used || 0) / 1024 / 1024)}MB，上限 ${Math.round(storageLimit / 1024 / 1024)}MB` };
    }
  }

  const limitMap = [
    ['upload_limit_minute', 60 * 1000, '每分钟'],
    ['upload_limit_hour', 60 * 60 * 1000, '每小时'],
    ['upload_limit_day', 24 * 60 * 60 * 1000, '每天'],
    ['upload_limit_week', 7 * 24 * 60 * 60 * 1000, '每周'],
    ['upload_limit_month', 30 * 24 * 60 * 60 * 1000, '每月']
  ];
  for (const [field, windowMs, label] of limitMap) {
    const limit = Number(group?.[field] || 0);
    if (limit > 0) {
      const [{ count }] = await db('upload_logs')
        .where({ user_id: userId, status: 'success' })
        .where('created_at', '>=', new Date(Date.now() - windowMs))
        .count('* as count');
      if (Number(count || 0) >= limit) return { ok: false, error: `${label}上传数量已达上限 ${limit} 张` };
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
  if (normalized === 'image/x-icon' || normalized === 'image/vnd.microsoft.icon') return 'ico';
  return '';
}

// 文件过滤器
const fileFilter = async (req, file, cb) => {
  try {
    const policy = await getUploadPolicy(req);
    const allowedFormats = normalizeAllowedFormats(policy.allowedFormats);
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

function buildUpload(maxFileSizeBytes, maxFiles = config.uploadLimits.maxFiles) {
  const limits = { files: maxFiles };
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
    const policy = await getUploadPolicy(req);
    const userLimit = Number(policy.user?.max_file_size || 0);
    const effectiveLimit = userLimit > 0 ? userLimit : policy.maxFileSizeBytes;
    return buildUpload(effectiveLimit, policy.maxFiles).array('files', policy.maxFiles)(req, res, next);
  } catch (err) {
    next(err);
  }
}

async function prepareLocalUploadPath(originalname, userId = null) {
  const file = { originalname: originalname || 'image.jpg' };
  const policy = await getUploadPolicy({ user: userId ? { id: userId } : null });
  if (policy.strategy && policy.strategy.type !== 'local') {
    throw new Error('当前存储策略暂未接入上传流，请先使用本地策略');
  }
  const basePath = policy.strategyConfig?.basePath || config.uploadsDir;
  const uploadDir = path.resolve(basePath, renderNameRule(policy.group?.path_rule, file, userId, false));
  await fs.mkdir(uploadDir, { recursive: true });
  return {
    dir: uploadDir,
    filename: renderNameRule(policy.group?.filename_rule, file, userId, true),
    policy
  };
}

// 处理上传后的图片
async function processUploadedFile(file, albumId = null, tags = [], userId = null, isPublic = false, userTagIds = [], uploadSource = 'upload') {
  const relativePath = pathUtils.toRelativePath(file.path);

  // 获取图片元信息
  const meta = await imageProcessor.getImageMeta(file.path);

  // 生成缩略图
  let uploadGroup = null;
  let uploadStrategy = null;
  if (userId) {
    const user = await db('users').where({ id: userId }).first();
    if (user?.user_group_id) uploadGroup = await db('user_groups').where({ id: user.user_group_id }).first();
  }
  if (!uploadGroup) uploadGroup = await db('user_groups').where({ is_default: true }).first();
  if (uploadGroup) {
    uploadStrategy = await db('storage_strategies').where({ user_group_id: uploadGroup.id }).orderBy('is_system_default', 'asc').orderBy('id', 'desc').first();
  }
  if (!uploadStrategy) uploadStrategy = await db('storage_strategies').where({ is_system_default: true }).first();
  await imageProcessor.generateThumbnails(file.path, {
    mediumWidth: uploadGroup?.medium_width,
    mediumHeight: uploadGroup?.medium_height,
    quality: uploadGroup?.image_quality
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
    upload_source: uploadSource,
    storage_strategy_id: uploadStrategy?.id || null,
    nsfw_status: uploadGroup?.image_review_enabled ? null : false,
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

  let nsfwReview = null;
  if (uploadGroup?.image_review_enabled) {
    try {
      nsfwReview = await nsfwService.reviewImage(imageId);
      if (nsfwReview.nsfw) {
        logger.warn(`图片已标记为不健康内容: ${file.originalname} (ID: ${imageId})`);
      }
    } catch (err) {
      logger.warn(`图片合规审核失败: ${file.originalname} - ${err.message}`);
      nsfwReview = { ok: false, error: err.message };
    }
  }

  // 记录上传日志
  await db('upload_logs').insert({
    user_id: userId || null,
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
    medium_url: baseUrl + urls.medium_url,
    storage_strategy_id: uploadStrategy?.id || null,
    storage_strategy_name: uploadStrategy?.name || '默认本地',
    storage_strategy_type: uploadStrategy?.type || 'local',
    nsfw_status: nsfwReview?.nsfw ?? (uploadGroup?.image_review_enabled ? null : false),
    nsfw_review: nsfwReview
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
  prepareLocalUploadPath,
  processUploadedFile,
  processUploadedFiles,
  getUploadLogs,
  checkUserQuota
};
