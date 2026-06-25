/**
 * 条件标签服务
 * 根据路径、分辨率、横竖比等条件自动打标签
 * 条件标签本质：自动将符合条件的图片归类到对应标签
 */
const db = require('../db');
const configService = require('./configService');
const logger = require('../config/logger');

// 条件类型处理器
const conditionHandlers = {
  // 路径正则匹配（路径包含指定文字）
  path_regex: (image, condition) => {
    const pattern = condition.config.pattern;
    if (!pattern) return false;
    return image.path.includes(pattern);
  },

  // 路径排除（路径不含指定文字）
  path_exclude: (image, condition) => {
    const pattern = condition.config.pattern;
    if (!pattern) return true;
    return !image.path.includes(pattern);
  },

  // 分辨率条件（横边或竖边 ≥ 指定像素）
  resolution: (image, condition) => {
    if (!image.width || !image.height) return false;
    const minPixels = condition.config.minPixels || parseInt(condition.config.min) || 1080;
    return image.width >= minPixels || image.height >= minPixels;
  },

  // 横竖图条件
  orientation: (image, condition) => {
    if (!image.orientation) return false;
    return image.orientation === condition.config.type;
  },

  // 横竖比条件（锁定为 1:1，筛选正方形）
  aspect_ratio: (image, condition) => {
    if (!image.width || !image.height) return false;
    const ratio = image.width / image.height;
    const min = condition.config.min || 0.95;
    const max = condition.config.max || 1.05;
    return ratio >= min && ratio <= max;
  },

  // 插件条件（预留，暂不启用）
  plugin: () => false
};

// 对单张图片执行条件标签
async function tagImageByConditions(imageId, conditionIds = null) {
  const image = await db('images').where({ id: imageId }).first();
  if (!image) return [];

  let conditions = await configService.readConditions();
  conditions = conditions.filter(c => c.is_enabled !== false);

  if (conditionIds) {
    conditions = conditions.filter(c => conditionIds.includes(c.id));
  }

  const matchedConditions = [];

  for (const condition of conditions) {
    const handler = conditionHandlers[condition.type];
    if (!handler) continue;

    try {
      if (handler(image, condition)) {
        matchedConditions.push(condition);
      }
    } catch (err) {
      logger.error(`条件标签执行失败: 图片 ${imageId}, 条件 ${condition.name}: ${err.message}`);
    }
  }

  return matchedConditions;
}

// 批量执行条件标签
async function tagImagesByConditions(imageIds = null, conditionIds = null, overwrite = false) {
  // 覆盖式：先删除该条件来源的旧标签
  if (overwrite && conditionIds) {
    for (const condId of conditionIds) {
      await db('image_tags').where({ source: 'condition', source_detail: `condition_${condId}` }).del();
    }
  } else if (overwrite) {
    await db('image_tags').where({ source: 'condition' }).del();
  }

  // 获取要处理的图片
  let images;
  if (imageIds) {
    images = await db('images').whereIn('id', imageIds);
  } else {
    images = await db('images');
  }

  let taggedCount = 0;
  for (const image of images) {
    const matchedConditions = await tagImageByConditions(image.id, conditionIds);
    if (matchedConditions.length > 0) {
      for (const cond of matchedConditions) {
        try {
          // 查找条件对应的标签 ID（在 tags 表中）
          const tagName = `cond_${cond.type}_${cond.name}`;
          const tag = await db('tags').where({ name: tagName }).first();
          if (tag) {
            await db('image_tags').insert({
              image_id: image.id,
              tag_id: tag.id,
              source: 'condition',
              source_detail: `condition_${cond.id}`
            }).onConflict(['image_id', 'tag_id']).ignore();
          }
        } catch (err) {
          // 忽略重复
        }
      }
      taggedCount++;
    }
  }

  logger.info(`条件标签完成: 处理 ${images.length} 张图片, ${taggedCount} 张匹配`);
  return { processed: images.length, tagged: taggedCount };
}

// 删除所有条件标签
async function deleteAllConditionTags() {
  const count = await db('image_tags').where({ source: 'condition' }).del();
  logger.info(`已删除 ${count} 条条件标签`);
  return count;
}

module.exports = {
  tagImageByConditions,
  tagImagesByConditions,
  deleteAllConditionTags,
  conditionHandlers
};
