/**
 * 人工标签服务
 * 支持为单个/多个图片或相册手动打标签
 */
const db = require('../db');
const tagService = require('./tagService');
const logger = require('../config/logger');

// 为单个图片打标签
async function tagImage(imageId, tagIds, overwrite = false, userId = null) {
  const image = await db('images').where({ id: imageId }).first();
  if (!image) throw { statusCode: 404, message: '图片不存在' };

  const source = overwrite ? 'manual' : 'append';
  await tagService.setImageTags(imageId, tagIds, source, null, userId);
  logger.info(`人工标签: 图片 ${imageId}, 标签 [${tagIds}], 覆盖=${overwrite}`);
  return { success: true, imageId, tagIds };
}

// 为多个图片批量打标签
async function tagImages(imageIds, tagIds, overwrite = false, userId = null) {
  const results = [];
  for (const imageId of imageIds) {
    try {
      const result = await tagImage(imageId, tagIds, overwrite, userId);
      results.push(result);
    } catch (err) {
      results.push({ success: false, imageId, error: err.message });
    }
  }
  return results;
}

// 为相册内所有图片打标签
async function tagAlbumImages(albumId, tagIds, overwrite = false, userId = null) {
  const images = await db('images').where({ album_id: albumId }).select('id');
  const imageIds = images.map(img => img.id);
  return await tagImages(imageIds, tagIds, overwrite, userId);
}

module.exports = {
  tagImage,
  tagImages,
  tagAlbumImages
};
