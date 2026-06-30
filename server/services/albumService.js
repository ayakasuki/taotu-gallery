/**
 * 相册服务
 * 管理相册的增删改查、封面、统计
 */
const db = require('../db');
const logger = require('../config/logger');

function normalizeAlbumName(name) {
  return String(name || '').trim();
}

function scopedAlbumQuery(userId, name) {
  const query = db('albums').whereRaw('LOWER(name) = LOWER(?)', [name]);
  return userId ? query.andWhere({ user_id: userId }) : query.whereNull('user_id');
}

function createAlbumError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function assertAlbumNameAvailable({ name, userId = null, excludeId = null }) {
  const normalizedName = normalizeAlbumName(name);
  if (!normalizedName) throw createAlbumError('相册名称不能为空');

  const query = scopedAlbumQuery(userId, normalizedName);
  if (excludeId) query.whereNot({ id: excludeId });
  const existing = await query.first();
  if (existing) throw createAlbumError(`相册名「${normalizedName}」已存在，请换一个名称`, 409);
  return normalizedName;
}

// 获取相册列表
async function getAlbums(options = {}) {
  const { page = 1, limit = 20, sort = 'created_at', order = 'desc', tagIds, userId, publicOnly = false, ownOnly = false, isAdmin = false, filterUserId = null, userGalleryOnly = false, search = '' } = options;
  const offset = (page - 1) * limit;

  let query = db('albums');

  // 权限过滤
  if (filterUserId) {
    query = query.where({ user_id: filterUserId });
  } else if (userGalleryOnly) {
    query = query.whereNotNull('user_id');
  } else if (publicOnly) {
    query = query.where({ is_public: true });
  } else if (ownOnly && userId) {
    query = query.where({ user_id: userId });
  } else if (isAdmin) {
    // 管理员可管理全部相册
  } else if (userId) {
    query = query.where(function() {
      this.where({ user_id: userId }).orWhere({ is_public: true }).orWhereNull('user_id');
    });
  } else {
    query = query.where({ is_public: true });
  }

  if (tagIds && tagIds.length > 0) {
    query = query.whereIn('id', function() {
      this.select('album_id').from('album_tags').whereIn('tag_id', tagIds);
    });
  }

  if (search && search.trim()) {
    const keyword = `%${search.trim()}%`;
    query = query.where(function() {
      this.where('name', 'like', keyword).orWhere('description', 'like', keyword);
    });
  }

  const validSorts = ['created_at', 'name', 'image_count'];
  const sortField = validSorts.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  const albums = await query.orderBy(sortField, sortOrder).offset(offset).limit(limit);

  let countQuery = db('albums').count('* as count');
  if (filterUserId) {
    countQuery = countQuery.where({ user_id: filterUserId });
  } else if (userGalleryOnly) {
    countQuery = countQuery.whereNotNull('user_id');
  } else if (publicOnly) {
    countQuery = countQuery.where({ is_public: true });
  } else if (ownOnly && userId) {
    countQuery = countQuery.where({ user_id: userId });
  } else if (isAdmin) {
    // 管理员统计全部相册
  } else if (userId) {
    countQuery = countQuery.where(function() {
      this.where({ user_id: userId }).orWhere({ is_public: true }).orWhereNull('user_id');
    });
  } else {
    countQuery = countQuery.where({ is_public: true });
  }
  if (tagIds && tagIds.length > 0) {
    countQuery = countQuery.whereIn('id', function() {
      this.select('album_id').from('album_tags').whereIn('tag_id', tagIds);
    });
  }
  if (search && search.trim()) {
    const keyword = `%${search.trim()}%`;
    countQuery = countQuery.where(function() {
      this.where('name', 'like', keyword).orWhere('description', 'like', keyword);
    });
  }
  const [{ count }] = await countQuery;

  for (const album of albums) {
    const imageService = require('./imageService');
    const owner = album.user_id
      ? await db('users').where({ id: album.user_id }).select('username', 'avatar').first()
      : null;
    album.owner_name = owner?.username || '系统';
    album.owner_avatar = owner?.avatar || null;

    if (album.cover_image_id) {
      album.cover_image = await db('images').where({ id: album.cover_image_id }).first();
    } else {
      album.cover_image = await db('images').where({ album_id: album.id }).first();
    }
    if (album.cover_image) {
      const urls = imageService.buildImageUrls(album.cover_image);
      Object.assign(album.cover_image, urls);
      delete album.cover_image.path;
      delete album.cover_image.original_path;
    }
    album.tags = await db('album_tags')
      .join('tags', 'album_tags.tag_id', 'tags.id')
      .where('album_tags.album_id', album.id)
      .select('tags.*', 'album_tags.source');
    const [{ cnt }] = await db('images').where({ album_id: album.id }).count('* as cnt');
    album.image_count = cnt;
  }

  return { albums, total: count, page, limit };
}

// 获取单个相册
async function getAlbumById(albumId) {
  const album = await db('albums').where({ id: albumId }).first();
  if (!album) return null;

  const imageService = require('./imageService');
  const owner = album.user_id
    ? await db('users').where({ id: album.user_id }).select('username', 'avatar').first()
    : null;
  album.owner_name = owner?.username || '系统';
  album.owner_avatar = owner?.avatar || null;

  // 获取封面：优先使用手动/系统写入的封面，缺失时回退到相册内最新图片
  if (album.cover_image_id) {
    album.cover_image = await db('images').where({ id: album.cover_image_id }).first();
  }
  if (!album.cover_image) {
    album.cover_image = await db('images')
      .where({ album_id: albumId })
      .orderBy('created_at', 'desc')
      .first();
  }
  if (album.cover_image) {
    const urls = imageService.buildImageUrls(album.cover_image);
    Object.assign(album.cover_image, urls);
    delete album.cover_image.path;
    delete album.cover_image.original_path;
  }

  // 获取图片列表（带 URL）
  album.images = await db('images')
    .where({ album_id: albumId })
    .orderBy('created_at', 'desc');

  for (const image of album.images) {
    const urls = imageService.buildImageUrls(image);
    Object.assign(image, urls);
    delete image.path;
    delete image.original_path;
  }

  album.image_count = album.images.length;
  return album;
}

// 创建相册
async function createAlbum(data) {
  const normalizedName = await assertAlbumNameAvailable({ name: data.name, userId: data.user_id || null });
  const [id] = await db('albums').insert({
    name: normalizedName,
    description: data.description || null,
    cover_image_id: data.cover_image_id || null,
    is_public: data.is_public || false,
    all_picture_public: data.all_picture_public || false,
    user_id: data.user_id || null
  });
  logger.info(`相册已创建: ${normalizedName} (ID: ${id})`);
  return getAlbumById(id);
}

// 更新相册
async function updateAlbum(albumId, data) {
  const album = await db('albums').where({ id: albumId }).first();
  if (!album) throw createAlbumError('相册不存在', 404);

  const updates = { updated_at: db.fn.now() };
  if (data.name !== undefined) {
    updates.name = await assertAlbumNameAvailable({
      name: data.name,
      userId: album.user_id || null,
      excludeId: albumId
    });
  }
  if (data.description !== undefined) updates.description = data.description;
  if (data.cover_image_id !== undefined) updates.cover_image_id = data.cover_image_id;
  if (data.is_public !== undefined) updates.is_public = data.is_public;
  if (data.all_picture_public !== undefined) updates.all_picture_public = data.all_picture_public;

  await db('albums').where({ id: albumId }).update(updates);
  return getAlbumById(albumId);
}

// 删除相册（不删除图片，仅解除关联）
async function deleteAlbum(albumId) {
  // 解除图片关联
  await db('images').where({ album_id: albumId }).update({ album_id: null });
  // 删除相册标签
  await db('album_tags').where({ album_id: albumId }).del();
  // 删除相册
  await db('albums').where({ id: albumId }).del();
  logger.info(`相册已删除: ${albumId}`);
}

// 随机获取相册
async function getRandomAlbums(count = 1, tagIds = null, userId = null, publicOnly = true) {
  let query = db('albums');

  // 权限过滤
  if (publicOnly) {
    query = query.where({ is_public: true });
  } else if (userId) {
    query = query.where(function() {
      this.where({ user_id: userId }).orWhere({ is_public: true });
    });
  }

  if (tagIds && tagIds.length > 0) {
    query = query.whereIn('id', function() {
      this.select('album_id').from('album_tags').whereIn('tag_id', tagIds);
    });
  }

  const albums = await query.orderByRaw('RAND()').limit(count);

  const imageService = require('./imageService');
  for (const album of albums) {
    album.cover_image = album.cover_image_id
      ? await db('images').where({ id: album.cover_image_id }).first()
      : await db('images').where({ album_id: album.id }).first();
    if (album.cover_image) {
      const urls = imageService.buildImageUrls(album.cover_image);
      Object.assign(album.cover_image, urls);
      delete album.cover_image.path;
      delete album.cover_image.original_path;
    }

    album.tags = await db('album_tags')
      .join('tags', 'album_tags.tag_id', 'tags.id')
      .where('album_tags.album_id', album.id)
      .select('tags.*');
  }

  return albums;
}

module.exports = {
  getAlbums,
  getAlbumById,
  createAlbum,
  updateAlbum,
  assertAlbumNameAvailable,
  deleteAlbum,
  getRandomAlbums
};
