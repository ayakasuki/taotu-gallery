/**
 * 相册服务
 * 管理相册的增删改查、封面、统计
 */
import db from '../db/index.js';

import logger from '../config/logger.js';
import imageService from './imageService.js';
import { albumPrivacyUpdates, albumPolicyError, filterHealthyImages, filterAlbumImagesForViewer, isUnsafeImage } from '../utils/albumPrivacy.js';

async function healthyAlbumCover(album) {
  let cover = album.cover_image_id
    ? await filterHealthyImages(db('images').where({ id: album.cover_image_id, album_id: album.id })).first()
    : null;
  if (!cover) cover = await filterHealthyImages(db('images').where({ album_id: album.id })).orderBy('created_at', 'desc').first();
  album.cover_image_id = cover?.id || null;
  if (!cover) return null;
  const { path: localPath, original_path: originalPath, ...safeCover } = cover;
  return { ...safeCover, ...imageService.buildImageUrls(cover) };
}

async function assertHealthyCover(albumId, coverId, database) {
  if (coverId === null) return;
  const cover = await database('images').where({ id: coverId, album_id: albumId }).first();
  if (!cover || isUnsafeImage(cover)) throw albumPolicyError('非法请求：封面必须是当前相册内未标记为不健康的图片');
}

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
  const { page = 1, limit = 20, sort = 'created_at', order = 'desc', tagIds, userId, publicOnly = false, ownOnly = false, isAdmin = false, filterUserId = null, userGalleryOnly = false, search = '', excludePrivateAlbums = false } = options;
  const offset = (page - 1) * limit;

  let query = db('albums');
  const restrictPrivate = builder => {
    if (excludePrivateAlbums || publicOnly || !userId) builder.where({ is_private: false });
    else if (!isAdmin) builder.where(inner => inner.where({ is_private: false }).orWhere({ user_id: userId }));
  };
  restrictPrivate(query);

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
  restrictPrivate(countQuery);
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
    const owner = album.user_id
      ? await db('users').where({ id: album.user_id }).select('username', 'nickname', 'avatar').first()
      : null;
    album.owner_name = owner?.nickname || owner?.username || '系统';
    album.owner_avatar = owner?.avatar || null;

    album.cover_image = await healthyAlbumCover(album);
    album.tags = await db('album_tags')
      .join('tags', 'album_tags.tag_id', 'tags.id')
      .where('album_tags.album_id', album.id)
      .select('tags.*', 'album_tags.source');
    const countViewer = excludePrivateAlbums ? {} : { userId, isAdmin };
    const [{ cnt }] = await filterAlbumImagesForViewer(db('images').where({ album_id: album.id }), countViewer).count('* as cnt');
    album.image_count = cnt;
  }

  return { albums, total: count, page, limit };
}

// 获取单个相册
async function getAlbumById(albumId, viewer = {}) {
  const album = await db('albums').where({ id: albumId }).first();
  if (!album) return null;
  if (album.is_private && (viewer.external || (!viewer.isAdmin && Number(album.user_id) !== Number(viewer.userId)))) {
    throw albumPolicyError('私密相册不允许通过此请求访问', 403);
  }

  const owner = album.user_id
    ? await db('users').where({ id: album.user_id }).select('username', 'nickname', 'avatar').first()
    : null;
  album.owner_name = owner?.nickname || owner?.username || '系统';
  album.owner_avatar = owner?.avatar || null;

  album.cover_image = await healthyAlbumCover(album);

  // 获取图片列表（带 URL）
  album.images = await filterAlbumImagesForViewer(db('images').where({ album_id: albumId }), viewer)
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
  const privacy = albumPrivacyUpdates(data);
  if (data.cover_image_id) throw albumPolicyError('新相册请先添加健康图片后再设置封面');
  const [id] = await db('albums').insert({
    name: normalizedName,
    description: data.description || null,
    cover_image_id: data.cover_image_id || null,
    is_public: data.is_public || false,
    all_picture_public: data.all_picture_public || false,
    hide_from_gallery: data.hide_from_gallery || false,
    user_id: data.user_id || null,
    ...privacy
  });
  logger.info(`相册已创建: ${normalizedName} (ID: ${id})`);
  return getAlbumById(id, { userId: data.user_id });
}

// 更新相册
async function updateAlbum(albumId, data, viewer = {}) {
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
  await db.transaction(async trx => {
    const current = await trx('albums').where({ id: albumId }).forUpdate().first();
    if (!current) throw createAlbumError('相册不存在', 404);
    if (viewer.external && (current.is_private || data.is_private === true || data.is_private === 1)) {
      throw albumPolicyError('私密相册只能在登录后的站内管理', 403);
    }
    Object.assign(updates, albumPrivacyUpdates(data, current));
    if (data.cover_image_id !== undefined) {
      await assertHealthyCover(albumId, data.cover_image_id, trx);
      updates.cover_image_id = data.cover_image_id;
    }
    await trx('albums').where({ id: albumId }).update(updates);
    if (updates.is_private || (updates.is_private === undefined && current.is_private)) {
      await trx('images').where({ album_id: albumId }).update({ is_public: false, updated_at: trx.fn.now() });
    } else if (updates.all_picture_public !== undefined) {
      await trx('images').where({ album_id: albumId }).update({ is_public: updates.all_picture_public, updated_at: trx.fn.now() });
    }
  });
  return getAlbumById(albumId, { userId: album.user_id, ...viewer });
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
async function getRandomAlbums(count = 1, tagIds = null, userId = null, publicOnly = true, excludeIds = []) {
  let query = db('albums').where({ is_private: false });

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

  if (excludeIds.length) query = query.whereNotIn('albums.id', excludeIds);
  const albums = await query.orderByRaw('RAND()').limit(count);

  if (!albums.length) return albums;
  const albumIds = albums.map(album => album.id);
  const fallbackCovers = await filterHealthyImages(db('images').whereIn('album_id', albumIds))
    .select('album_id').min({ image_id: 'id' }).count('* as image_count').groupBy('album_id');
  const fallbackByAlbum = new Map(fallbackCovers.map(cover => [String(cover.album_id), cover.image_id]));
  const countByAlbum = new Map(fallbackCovers.map(cover => [String(cover.album_id), Number(cover.image_count)]));
  const coverIds = [...new Set(albums.flatMap(album => [album.cover_image_id, fallbackByAlbum.get(String(album.id))]).filter(Boolean))];
  const [covers, albumTags] = await Promise.all([
    coverIds.length ? filterHealthyImages(db('images').whereIn('id', coverIds)) : [],
    db('album_tags').join('tags', 'album_tags.tag_id', 'tags.id')
      .whereIn('album_tags.album_id', albumIds)
      .select('tags.*', 'album_tags.album_id as tagged_album_id')
  ]);
  const coversById = new Map(covers.map(cover => [String(cover.id), cover]));
  const tagsByAlbum = new Map();
  for (const { tagged_album_id, ...tag } of albumTags) {
    const key = String(tagged_album_id);
    if (!tagsByAlbum.has(key)) tagsByAlbum.set(key, []);
    tagsByAlbum.get(key).push(tag);
  }
  for (const album of albums) {
    const selectedCover = coversById.get(String(album.cover_image_id));
    const cover = Number(selectedCover?.album_id) === Number(album.id) ? selectedCover : coversById.get(String(fallbackByAlbum.get(String(album.id))));
    album.cover_image = cover ? { ...cover } : null;
    album.cover_image_id = cover?.id || null;
    album.image_count = countByAlbum.get(String(album.id)) || 0;
    if (album.cover_image) {
      const urls = imageService.buildImageUrls(album.cover_image);
      Object.assign(album.cover_image, urls);
      delete album.cover_image.path;
      delete album.cover_image.original_path;
    }

    album.tags = tagsByAlbum.get(String(album.id)) || [];
  }

  return albums;
}

export default {
  getAlbums,
  getAlbumById,
  createAlbum,
  updateAlbum,
  assertAlbumNameAvailable,
  deleteAlbum,
  getRandomAlbums
};
