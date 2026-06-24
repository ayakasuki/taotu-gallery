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

// 校验不可组合标签冲突
function validateNonCombinableConflict(tagIds, allTags) {
  const selectedTags = tagIds.map(id => allTags.find(t => t.id === id)).filter(Boolean);
  const nonCombinable = selectedTags.filter(t => !t.combinable);

  for (let i = 0; i < nonCombinable.length; i++) {
    for (let j = i + 1; j < nonCombinable.length; j++) {
      if (nonCombinable[i].mutually_exclusive_with === nonCombinable[j].id) {
        return {
          valid: false,
          error: `标签 "${nonCombinable[i].name}" 与 "${nonCombinable[j].name}" 互斥，不可同时选择`,
          conflictTags: [nonCombinable[i], nonCombinable[j]]
        };
      }
    }
  }
  return { valid: true };
}

// 为图片设置标签（核心方法）
async function setImageTags(imageId, tagIds, source, sourceDetail = null) {
  const allTags = await getAllTags();

  // 校验互斥
  const validation = validateNonCombinableConflict(tagIds, allTags);
  if (!validation.valid) {
    throw { statusCode: 400, message: validation.error };
  }

  // 如果是覆盖式，先删除该来源的旧标签
  if (source && source !== 'append') {
    await db('image_tags').where({ image_id: imageId, source }).del();
  }

  // 插入新标签
  for (const tagId of tagIds) {
    try {
      await db('image_tags').insert({
        image_id: imageId,
        tag_id: tagId,
        source: source === 'append' ? 'manual' : source,
        source_detail: sourceDetail
      }).onConflict(['image_id', 'tag_id']).ignore();
    } catch (err) {
      // 忽略重复插入
      if (err.code !== 'ER_DUP_ENTRY') throw err;
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
async function syncTagConfig(newTags) {
  const oldTags = await configService.readTags();
  const threshold = config.tagDiffThreshold;

  if (isDiffExcessive(oldTags, newTags, threshold)) {
    logger.warn('标签配置差异过大，需要全部重新标签');
    await configService.writeTags(newTags);
    return { action: 'full-retag', message: '配置差异过大，需全部重新标签' };
  }

  const diff = computeTagDiff(oldTags, newTags);
  logger.info(`标签差异: 新增 ${diff.added.length}, 修改 ${diff.modified.length}, 删除 ${diff.removed.length}`);

  await configService.writeTags(newTags);

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
  setImageTags,
  setAlbumTags,
  deleteTagsBySource,
  getImageTags,
  getAlbumTags,
  syncTagConfig
};
