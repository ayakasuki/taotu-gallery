/**
 * 标签核心服务
 * 管理标签的读取、写入、同步和重建
 */
const db = require('../db');
const configService = require('./configService');
const { computeTagDiff, isDiffExcessive } = require('../utils/tagDiff');
const config = require('../config');
const logger = require('../config/logger');

// 获取所有标签（合并可组合和不可组合）
async function getAllTags() {
  const tags = await configService.readTags();
  return [...(tags.combinable || []), ...(tags.nonCombinable || [])];
}

// 根据 ID 获取标签
async function getTagById(tagId) {
  const allTags = await getAllTags();
  return allTags.find(t => t.id === tagId);
}

// 根据名称获取标签
async function getTagByName(name) {
  const allTags = await getAllTags();
  return allTags.find(t => t.name === name);
}

function parseMutualIds(value) {
  if (value === null || value === undefined || value === '') return [];
  const values = Array.isArray(value) ? value : String(value).split(/[,，.。\s]+/);
  return values
    .map(part => String(part).trim())
    .filter(Boolean)
    .map(part => /^u\d+$/i.test(part) ? 'u' + parseInt(part.slice(1)) : (/^\d+$/.test(part) ? parseInt(part) : null))
    .filter(id => id !== null);
}

function createTagError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeTagName(name) {
  return String(name || '').trim();
}

function assertNoDuplicatePublicTagNames(tagsPayload) {
  const publicTags = [...(tagsPayload.combinable || []), ...(tagsPayload.nonCombinable || [])]
    .filter(tag => tag && !tag.isSystemTag && !tag.isUserTag && !tag.isPublicUserTag);
  const seen = new Map();

  for (const tag of publicTags) {
    const name = normalizeTagName(tag.name);
    if (!name) throw createTagError('公共标签名不能为空');

    const key = name.toLowerCase();
    const previous = seen.get(key);
    if (previous && String(previous.id) !== String(tag.id)) {
      throw createTagError(`公共标签名「${name}」已存在，请换一个名称`, 409);
    }
    seen.set(key, tag);
  }
}

// 校验不可组合标签冲突
function validateNonCombinableConflict(tagIds, allTags) {
  const selectedTags = tagIds.map(id => allTags.find(t => t.id === id)).filter(Boolean);
  const selectedIds = new Set(selectedTags.map(tag => tag.id));
  const nonCombinable = selectedTags.filter(t => !t.combinable);

  for (const tag of nonCombinable) {
    const conflictId = parseMutualIds(tag.mutually_exclusive_with).find(id => selectedIds.has(id));
    if (conflictId) {
      const conflictTag = selectedTags.find(t => t.id === conflictId);
      return {
        valid: false,
        error: "标签 \"" + tag.name + "\" 与 \"" + (conflictTag?.name || conflictId) + "\" 互斥，不可同时选择",
        conflictTags: [tag, conflictTag].filter(Boolean)
      };
    }
  }
  return { valid: true };
}

// 为图片设置标签（核心方法）
async function setImageTags(imageId, tagIds, source, sourceDetail = null, userId = null) {
  // 分离公共标签和用户标签
  const publicTagIds = tagIds.filter(id => typeof id === 'number' || (typeof id === 'string' && !String(id).startsWith('u')));
  const userTagIds = tagIds.filter(id => typeof id === 'string' && String(id).startsWith('u')).map(id => parseInt(String(id).substring(1)));

  // 如果是覆盖式，先删除该来源的旧标签。人工标签里公共标签和用户私有标签分开维护，避免管理员保存公共标签时误删用户私有标签。
  if (source && source !== 'append') {
    if (source === 'manual') {
      if (publicTagIds.length > 0 || userTagIds.length === 0) {
        await db('image_tags')
          .where({ image_id: imageId, source })
          .whereNull('user_tag_id')
          .del();
      }
      if (userTagIds.length > 0 && userId) {
        await db('image_tags')
          .where({ image_id: imageId, source, tag_user_id: userId })
          .whereNotNull('user_tag_id')
          .del();
      }
    } else {
      await db('image_tags').where({ image_id: imageId, source }).del();
    }
  }

  // 插入公共标签
  for (const tagId of publicTagIds) {
    try {
      await db('image_tags').insert({
        image_id: imageId,
        tag_id: tagId,
        source: source === 'append' ? 'manual' : source,
        source_detail: sourceDetail
      }).onConflict(['image_id', 'tag_id']).ignore();
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
    }
  }

  // 插入用户标签
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

// 为相册设置标签
async function setAlbumTags(albumId, tagIds, source, sourceDetail = null) {
  const allTags = await getAllTags();

  const validation = validateNonCombinableConflict(tagIds, allTags);
  if (!validation.valid) {
    throw { statusCode: 400, message: validation.error };
  }

  if (source && source !== 'append') {
    await db('album_tags').where({ album_id: albumId, source }).del();
  }

  for (const tagId of tagIds) {
    try {
      await db('album_tags').insert({
        album_id: albumId,
        tag_id: tagId,
        source: source === 'append' ? 'manual' : source,
        source_detail: sourceDetail
      }).onConflict(['album_id', 'tag_id']).ignore();
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
    }
  }
}

// 删除指定来源的所有标签
async function deleteTagsBySource(source, sourceDetail = null) {
  const query = db('image_tags').where({ source });
  if (sourceDetail) query.andWhere({ source_detail: sourceDetail });
  const count = await query.del();
  logger.info(`已删除 ${count} 条 ${source} 来源的图片标签`);
  return count;
}

// 获取图片的所有标签
async function getImageTags(imageId) {
  return db('image_tags')
    .join('tags', 'image_tags.tag_id', 'tags.id')
    .where('image_tags.image_id', imageId)
    .select('tags.*', 'image_tags.source', 'image_tags.source_detail');
}

// 获取相册的所有标签
async function getAlbumTags(albumId) {
  return db('album_tags')
    .join('tags', 'album_tags.tag_id', 'tags.id')
    .where('album_tags.album_id', albumId)
    .select('tags.*', 'album_tags.source', 'album_tags.source_detail');
}

// 同步标签配置（对比差异，执行部分或全部重标签）
async function syncTagConfig(newTags, options = {}) {
  assertNoDuplicatePublicTagNames(newTags);
  const oldTags = await configService.readTags();
  const threshold = config.tagDiffThreshold;

  if (isDiffExcessive(oldTags, newTags, threshold)) {
    logger.warn('标签配置差异过大，需要全部重新标签');
    await configService.writeTags(newTags, options);
    return { action: 'full-retag', message: '配置差异过大，需全部重新标签' };
  }

  const diff = computeTagDiff(oldTags, newTags);
  logger.info(`标签差异: 新增 ${diff.added.length}, 修改 ${diff.modified.length}, 删除 ${diff.removed.length}`);

  await configService.writeTags(newTags, options);

  if (diff.added.length > 0 || diff.modified.length > 0) {
    return {
      action: 'partial-retag',
      diff,
      message: `部分标签变更，需对 ${diff.added.length + diff.modified.length} 个标签重新标签`
    };
  }

  return { action: 'none', message: '标签配置无变化' };
}

module.exports = {
  getAllTags,
  getTagById,
  getTagByName,
  validateNonCombinableConflict,
  parseMutualIds,
  setImageTags,
  setAlbumTags,
  deleteTagsBySource,
  getImageTags,
  getAlbumTags,
  syncTagConfig
};
