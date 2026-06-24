/**
 * 图片查询服务
 * 使用哈希路径对外展示，不暴露本地真实路径
 */
const db = require('../db');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const logger = require('../config/logger');

// 生成 16 位哈希
function generateHash() {
  return crypto.randomBytes(8).toString('hex');
}

// 为图片生成哈希路径: image/2026-06-24/abc123def456.jpg
function generateHashPath(originalFilename) {
  const date = new Date().toISOString().split('T')[0];
  const hash = generateHash();
  const ext = path.extname(originalFilename).toLowerCase() || '.jpg';
  return `image/${date}/${hash}${ext}`;
}

// 获取公开 URL（基于域名配置）
let cachedPublicDomain = null;
let domainCacheTime = 0;
function getPublicBaseUrl() {
  const now = Date.now();
  // 缓存 60 秒
  if (cachedPublicDomain && now - domainCacheTime < 60000) {
    return cachedPublicDomain;
  }
  try {
    const siteConfig = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../data/config/site.json'), 'utf-8'
    ));
    if (siteConfig.publicDomain) {
      cachedPublicDomain = siteConfig.publicDomain.replace(/\/+$/, '');
      domainCacheTime = now;
      return cachedPublicDomain;
    }
  } catch {}
  cachedPublicDomain = `http://localhost:${process.env.PORT || 7067}`;
  domainCacheTime = now;
  return cachedPublicDomain;
}

// 根据哈希路径查找图片
async function getImageByHashPath(hashPath) {
  const normalizedPath = hashPath.startsWith('/') ? hashPath.substring(1) : hashPath;
  return db('images').where({ hash_path: normalizedPath }).first();
}

// 为图片构建对外 URL
function buildImageUrls(image) {
  if (!image.hash_path) {
    // 无 hash_path 时生成一个，不暴露真实路径
    const hashPath = generateHashPath(image.filename || 'unknown.jpg');
    return {
      url: `/image/${hashPath.replace(/^image\//, '')}`,
      thumb_url: `/thumb/${hashPath.replace(/^image\//, '')}?s=thumb`,
      medium_url: `/thumb/${hashPath.replace(/^image\//, '')}?s=medium`
    };
  }
  return {
    url: `/image/${image.hash_path.replace(/^image\//, '')}`,
    thumb_url: `/thumb/${image.hash_path.replace(/^image\//, '')}?s=thumb`,
    medium_url: `/thumb/${image.hash_path.replace(/^image\//, '')}?s=medium`
  };
}

// 查询图片列表
async function getImages(options = {}) {
  const {
    page = 1, limit = 20,
    sort = 'created_at', order = 'desc',
    tagIds, albumId, orientation, search,
    userId, publicOnly = false, ownOnly = false, isAdmin = false, filterUserId = null
  } = options;

  const offset = (page - 1) * limit;
  let query = db('images');

  // 权限过滤
  if (publicOnly) {
    query = query.where({ is_public: true });
  } else if (ownOnly && userId) {
    query = query.where({ uploader_id: userId });
  } else if (filterUserId) {
    query = query.where({ uploader_id: filterUserId });
  } else if (isAdmin) {
    // 管理员默认看所有（不加过滤）
  } else if (userId) {
    query = query.where(function() {
      this.where({ uploader_id: userId }).orWhere({ is_public: true }).orWhereNull('uploader_id');
    });
  } else {
    query = query.where({ is_public: true });
  }

  if (tagIds && tagIds.length > 0) {
    query = query.whereIn('id', function() {
      this.select('image_id').from('image_tags').whereIn('tag_id', tagIds);
    });
  }
  if (albumId) query = query.where({ album_id: albumId });
  if (orientation) query = query.where({ orientation });
  if (search) query = query.where('filename', 'like', `%${search}%`);

  const validSorts = ['created_at', 'filename', 'view_count', 'width', 'height'];
  const sortField = validSorts.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  const images = await query.orderBy(sortField, sortOrder).offset(offset).limit(limit);

  let countQuery = db('images').count('* as count');
  if (publicOnly) {
    countQuery = countQuery.where({ is_public: true });
  } else if (ownOnly && userId) {
    countQuery = countQuery.where({ uploader_id: userId });
  } else if (filterUserId) {
    countQuery = countQuery.where({ uploader_id: filterUserId });
  } else if (isAdmin) {
    // 管理员看所有
  } else if (userId) {
    countQuery = countQuery.where(function() {
      this.where({ uploader_id: userId }).orWhere({ is_public: true }).orWhereNull('uploader_id');
    });
  } else {
    countQuery = countQuery.where({ is_public: true });
  }
  if (tagIds && tagIds.length > 0) {
    countQuery = countQuery.whereIn('id', function() {
      this.select('image_id').from('image_tags').whereIn('tag_id', tagIds);
    });
  }
  if (albumId) countQuery = countQuery.where({ album_id: albumId });
  const [{ count }] = await countQuery;

  for (const image of images) {
    image.tags = await db('image_tags')
      .join('tags', 'image_tags.tag_id', 'tags.id')
      .where('image_tags.image_id', image.id)
      .select('tags.*', 'image_tags.source');
    const urls = buildImageUrls(image);
    Object.assign(image, urls);
  }

  return { images, total: count, page, limit };
}

// 获取单张图片详情
async function getImageById(imageId) {
  const image = await db('images').where({ id: imageId }).first();
  if (!image) return null;

  await db('images').where({ id: imageId }).increment('view_count', 1);

  image.tags = await db('image_tags')
    .join('tags', 'image_tags.tag_id', 'tags.id')
    .where('image_tags.image_id', imageId)
    .select('tags.*', 'image_tags.source', 'image_tags.source_detail');

  // 获取上传者用户名
  if (image.uploader_id) {
    const uploader = await db('users').where({ id: image.uploader_id }).select('username').first();
    image.uploader_name = uploader?.username || '未知';
  } else {
    image.uploader_name = '系统导入';
  }

  const urls = buildImageUrls(image);
  Object.assign(image, urls);

  const baseUrl = getPublicBaseUrl();
  image.embed_codes = generateEmbedCodes(baseUrl, image);

  return image;
}

// 随机获取图片
async function getRandomImages(options = {}) {
  const { count = 1, tagIds, albumId, orientation, userId, publicOnly = false } = options;

  let query = db('images');
  if (publicOnly) {
    query = query.where({ is_public: true });
  } else if (userId) {
    query = query.where(function() {
      this.where({ uploader_id: userId }).orWhere({ is_public: true }).orWhereNull('uploader_id');
    });
  }
  if (tagIds && tagIds.length > 0) {
    query = query.whereIn('id', function() {
      this.select('image_id').from('image_tags').whereIn('tag_id', tagIds);
    });
  }
  if (albumId) query = query.where({ album_id: albumId });
  if (orientation) query = query.where({ orientation });

  const images = await query.orderByRaw('RAND()').limit(count);

  for (const image of images) {
    image.tags = await db('image_tags')
      .join('tags', 'image_tags.tag_id', 'tags.id')
      .where('image_tags.image_id', image.id)
      .select('tags.*', 'image_tags.source');
    const urls = buildImageUrls(image);
    Object.assign(image, urls);
  }

  return images;
}

// 生成嵌入代码（4 格式 × 3 尺寸 = 12 种）
function generateEmbedCodes(baseUrl, image) {
  const thumbW = Math.min(300, image.width || 300);
  const thumbH = Math.round(thumbW * ((image.height || 300) / (image.width || 300)));
  const mediumW = Math.min(800, image.width || 800);
  const mediumH = Math.round(mediumW * ((image.height || 800) / (image.width || 800)));

  const sizes = [
    { name: 'thumb', url: `${baseUrl}${image.thumb_url}`, width: thumbW, height: thumbH },
    { name: 'medium', url: `${baseUrl}${image.medium_url}`, width: mediumW, height: mediumH },
    { name: 'full', url: `${baseUrl}${image.url}`, width: image.width, height: image.height }
  ];

  const codes = {};
  for (const size of sizes) {
    codes[size.name] = {
      source: size.url,
      html: `<img src="${size.url}" alt="${image.filename}" width="${size.width}" height="${size.height}" />`,
      bbcode: `[img]${size.url}[/img]`,
      markdown: `![${image.filename}](${size.url})`
    };
  }

  return codes;
}

// 为已有图片补充哈希路径（迁移用）
async function backfillHashPaths() {
  const images = await db('images').whereNull('hash_path');
  let count = 0;
  for (const image of images) {
    const hashPath = generateHashPath(image.filename);
    await db('images').where({ id: image.id }).update({ hash_path: hashPath });
    count++;
  }
  logger.info(`已为 ${count} 张图片补充哈希路径`);
  return count;
}

module.exports = {
  getImages,
  getImageById,
  getRandomImages,
  getImageByHashPath,
  buildImageUrls,
  generateEmbedCodes,
  generateHashPath,
  backfillHashPaths,
  getPublicBaseUrl
};
