/**
 * 相册服务
 * 管理相册的增删改查、封面、统计
 */
const db = require('../db');
const logger = require('../config/logger');

// 获取相册列表
async function getAlbums(options = {}) {
  const { page = 1, limit = 20, sort = 'created_at', order = 'desc', tagIds, userId, publicOnly = false, ownOnly = false } = options;
  const offset = (page - 1) * limit;

  let query = db('albums');

  // 权限过滤
  if (publicOnly) {
    query = query.where({ is_public: true });
  } else if (ownOnly && userId) {
    query = query.where({ user_id: userId });
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

  const validSorts = ['created_at', 'name', 'image_count'];
  const sortField = validSorts.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  const albums = await query.orderBy(sortField, sortOrder).offset(offset).limit(limit);

  let countQuery = db('albums').count('* as count');
  if (publicOnly) {
    countQuery = countQuery.where({ is_public: true });
  } else if (ownOnly && userId) {
    countQuery = countQuery.where({ user_id: userId });
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
  const [{ count }] = await countQuery;

  for (const album of albums) {
    const imageService = require('./imageService');
    if (album.cover_image_id) {
      album.cover_image = await db('images').where({ id: album.cover_image_id }).first();
    } else {
      album.cover_image = await db('images').where({ album_id: album.id }).first();
    }
    if (album.cover_image) {
      const urls = imageService.buildImageUrls(album.cover_image);
      Object.assign(album.cover_image, urls);
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

  // 获取封面
  if (album.cover_image_id) {
    album.cover_image = await db('images').where({ id: album.cover_image_id }).first();
    if (album.cover_image) {
      const urls = imageService.buildImageUrls(album.cover_image);
      Object.assign(album.cover_image, urls);
    }
  }

  // 获取图片列表（带 URL）
  album.images = await db('images')
    .where({ album_id: albumId })
    .orderBy('created_at', 'desc');

  for (const image of album.images) {
    const urls = imageService.buildImageUrls(image);
    Object.assign(image, urls);
  }

  album.image_count = album.images.length;
  return album;
}

// 创建相册
async function createAlbum(data) {
  const [id] = await db('albums').insert({
    name: data.name,
    description: data.description || null,
    cover_image_id: data.cover_image_id || null,
    is_public: data.is_public || false,
    user_id: data.user_id || null
  });
  logger.info(`相册已创建: ${data.name} (ID: ${id})`);
  return getAlbumById(id);
}

// 更新相册
async function updateAlbum(albumId, data) {
  const updates = { updated_at: db.fn.now() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.cover_image_id !== undefined) updates.cover_image_id = data.cover_image_id;
  if (data.is_public !== undefined) updates.is_public = data.is_public;

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
  deleteAlbum,
  getRandomAlbums
};
