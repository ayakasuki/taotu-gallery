/**
 * 条件标签服务
 * 根据路径、分辨率、横竖比等条件自动打标签
 * 条件标签本质：自动将符合条件的图片归类到对应标签
 */
import db from '../db/index.js';

import configService from './configService.js';
import logger from '../config/logger.js';
import {calculateOrientation, checkResolution, normalizeResolutionLevel} from '../utils/imageProcessor.js';

function parseConditionConfig(condition) {
  if (!condition.config) return {};
  if (typeof condition.config === 'object') return condition.config;
  try { return JSON.parse(condition.config); } catch { return {}; }
}

function normalizeCondition(condition) {
  return { ...condition, config: parseConditionConfig(condition) };
}

function splitPatternList(pattern) {
  return String(pattern || '')
    .split(/[,，]/)
    .map(part => part.trim())
    .filter(Boolean);
}

function resolveConditionTagName(condition) {
  return `cond_${condition.type}_${condition.name}`;
}

function normalizeConditionIds(conditionIds) {
  if (!conditionIds) return null;
  const ids = (Array.isArray(conditionIds) ? conditionIds : [conditionIds])
    .map(id => parseInt(id, 10))
    .filter(Number.isInteger);
  return ids.length ? ids : null;
}

async function loadEnabledConditions(conditionIds = null) {
  let conditions = await configService.readConditions();
  conditions = conditions.map(normalizeCondition).filter(c => c.is_enabled !== false);
  const ids = normalizeConditionIds(conditionIds);
  if (ids) {
    conditions = conditions.filter(c => ids.includes(Number(c.id)));
  }
  return conditions;
}

async function getConditionTag(condition) {
  if (condition.tag_id) {
    const byId = await db('tags').where({ id: condition.tag_id }).first();
    if (byId) return byId;
  }
  return db('tags').where({ name: resolveConditionTagName(condition) }).first();
}

async function insertConditionTag(imageId, condition, resolvedTag = null) {
  const tag = resolvedTag || (await getConditionTag(condition));
  if (!tag) return false;
  await db('image_tags').insert({
    image_id: imageId,
    tag_id: tag.id,
    source: 'condition',
    source_detail: `condition_${condition.id}`
  }).onConflict(['image_id', 'tag_id']).ignore();
  return true;
}

function matchesCondition(image, condition) {
  const handler = conditionHandlers[condition.type];
  if (!handler) return false;
  return handler(image, condition);
}

function applyConditionSqlFilter(query, condition) {
  const config = condition.config || {};

  if (condition.type === 'path_regex') {
    const patterns = splitPatternList(config.pattern);
    if (!patterns.length) return query.whereRaw('1 = 0');
    return query.where(function applyPathInclude() {
      for (const pattern of patterns) {
        this.orWhere('images.path', 'like', `%${pattern}%`);
      }
    });
  }

  if (condition.type === 'path_exclude') {
    const patterns = splitPatternList(config.pattern);
    for (const pattern of patterns) {
      query.where('images.path', 'not like', `%${pattern}%`);
    }
    return query;
  }

  if (condition.type === 'orientation') {
    query.whereNotNull('images.width').whereNotNull('images.height');
    if (config.type === 'landscape') return query.whereRaw('images.width > images.height * 1.1');
    if (config.type === 'portrait') return query.whereRaw('images.height > images.width * 1.1');
    if (config.type === 'square') {
      return query
        .whereRaw('images.width >= images.height * 0.9')
        .whereRaw('images.width <= images.height * 1.1');
    }
    return query.whereRaw('1 = 0');
  }

  if (condition.type === 'aspect_ratio') {
    return query
      .whereNotNull('images.width')
      .whereNotNull('images.height')
      .whereRaw('images.width >= images.height * 0.9')
      .whereRaw('images.width <= images.height * 1.1');
  }

  if (condition.type === 'resolution') {
    const level = normalizeResolutionLevel(config.level || config.min || config.minPixels || '1080p');
    query.whereNotNull('images.width').whereNotNull('images.height');
    if (level === 'below1080p') {
      return query.whereRaw('LEAST(images.width, images.height) < ?', [1080]).whereRaw('GREATEST(images.width, images.height) <= ?', [2560]);
    }
    if (level === '1080p') {
      return query.whereRaw('LEAST(images.width, images.height) >= ?', [1080]).whereRaw('GREATEST(images.width, images.height) <= ?', [2560]);
    }
    if (level === '2k') {
      return query.whereRaw('GREATEST(images.width, images.height) > ?', [2560]).whereRaw('GREATEST(images.width, images.height) <= ?', [3840]);
    }
    if (level === '4k') {
      return query.whereRaw('GREATEST(images.width, images.height) > ?', [3840]);
    }
    return query.whereRaw('LEAST(images.width, images.height) > 0').whereRaw('GREATEST(images.width, images.height) > 0');
  }

  return query.whereRaw('1 = 0');
}

// 条件类型处理器
const conditionHandlers = {
  // 路径正则匹配（路径包含指定文字）
  path_regex: (image, condition) => {
    const patterns = splitPatternList(condition.config.pattern);
    if (!patterns.length) return false;
    return patterns.some(pattern => image.path.includes(pattern));
  },

  // 路径排除（路径不含指定文字）
  path_exclude: (image, condition) => {
    const patterns = splitPatternList(condition.config.pattern);
    if (!patterns.length) return true;
    return !patterns.some(pattern => image.path.includes(pattern));
  },

  // 分辨率条件（按 1080p / 2K / 4K+ 档位互斥匹配）
  resolution: (image, condition) => {
    if (!image.width || !image.height) return false;
    const level = condition.config.level || condition.config.min || condition.config.minPixels || '1080p';
    return checkResolution(image.width, image.height, level);
  },

  // 横竖正方图条件：按像素重新计算，0.9-1.1 视为正方图，三者严格互斥
  orientation: (image, condition) => {
    if (!image.width || !image.height) return false;
    return calculateOrientation(image.width, image.height) === condition.config.type;
  },

  // 横竖比条件（锁定为 1:1，按 0.9-1.1 筛选正方形）
  aspect_ratio: (image, condition) => {
    if (!image.width || !image.height) return false;
    return calculateOrientation(image.width, image.height) === 'square';
  },

  // 插件条件（预留，暂不启用）
  plugin: () => false
};

// 对单张图片执行条件标签
async function tagImageByConditions(imageId, conditionIds = null) {
  const image = await db('images').where({ id: imageId }).first();
  if (!image) return [];

  const conditions = await loadEnabledConditions(conditionIds);

  const matchedConditions = [];

  for (const condition of conditions) {
    try {
      if (matchesCondition(image, condition)) {
        matchedConditions.push(condition);
      }
    } catch (err) {
      logger.error(`条件标签执行失败: 图片 ${imageId}, 条件 ${condition.name}: ${err.message}`);
    }
  }

  return matchedConditions;
}

// 批量执行条件标签
async function tagImagesByConditions(imageIds = null, conditionIds = null, overwrite = false, options = {}) {
  const force = overwrite || options.force === true;
  const conditions = await loadEnabledConditions(conditionIds);
  if (conditions.length === 0) {
    return { processed: 0, tagged: 0, skipped: 0, message: '没有启用的条件标签' };
  }

  // 覆盖式：先删除该条件来源的旧标签
  const selectedConditionIds = normalizeConditionIds(conditionIds);
  if (force && selectedConditionIds) {
    for (const condId of selectedConditionIds) {
      await db('image_tags').where({ source: 'condition', source_detail: `condition_${condId}` }).del();
    }
  } else if (force) {
    await db('image_tags').where({ source: 'condition' }).del();
  }

  const createBaseImageQuery = () => {
    const query = db('images');
    if (imageIds) query.whereIn('images.id', imageIds);
    return query;
  };

  function countFromQuery(query) {
    return query.countDistinct({ count: 'images.id' }).first();
  }

  let processedCount = 0;
  let taggedCount = 0;
  let skippedCount = 0;
  const taggedImageIds = new Set();

  for (const condition of conditions) {
    if (!conditionHandlers[condition.type] || condition.type === 'plugin') {
      logger.warn(`条件标签类型暂不支持增量执行: ${condition.type} (${condition.name})`);
      continue;
    }

    const conditionTag = await getConditionTag(condition);
    if (!conditionTag) {
      logger.warn(`条件标签缺少关联标签: ${condition.name} (${condition.id})`);
      continue;
    }

    const matchedTotal = Number((await countFromQuery(applyConditionSqlFilter(createBaseImageQuery(), condition)))?.count || 0);
    let query = applyConditionSqlFilter(createBaseImageQuery(), condition);
    if (!force) {
      query = query
        .leftJoin('image_tags as existing_condition_tag', function joinExistingConditionTag() {
          this.on('existing_condition_tag.image_id', '=', 'images.id')
            .andOn('existing_condition_tag.tag_id', '=', db.raw('?', [conditionTag.id]))
            .andOn('existing_condition_tag.source', '=', db.raw('?', ['condition']));
        })
        .whereNull('existing_condition_tag.id')
        .select('images.*')
        .orderBy('images.id', 'asc');
    } else {
      query = query.select('images.*').orderBy('images.id', 'asc');
    }

    const candidates = await query;
    skippedCount += force ? 0 : Math.max(0, matchedTotal - candidates.length);
    processedCount += candidates.length;

    for (const image of candidates) {
      try {
        if (!matchesCondition(image, condition)) continue;
        const inserted = await insertConditionTag(image.id, condition, conditionTag);
        if (inserted) {
          taggedImageIds.add(image.id);
          taggedCount++;
        }
      } catch (err) {
        logger.error(`条件标签执行失败: 图片 ${image.id}, 条件 ${condition.name}: ${err.message}`);
      }
    }
  }

  const message = processedCount === 0
    ? '条件标签现无符合需要标签的图片'
    : `条件标签完成: 处理 ${processedCount} 张候选图片, 新增 ${taggedCount} 条标签`;
  logger.info(`${message}, 涉及 ${taggedImageIds.size} 张图片`);
  return { processed: processedCount, tagged: taggedCount, taggedImages: taggedImageIds.size, skipped: skippedCount, message };
}

// 删除所有条件标签
async function deleteAllConditionTags() {
  const count = await db('image_tags').where({ source: 'condition' }).del();
  logger.info(`已删除 ${count} 条条件标签`);
  return count;
}

export default {
  tagImageByConditions,
  tagImagesByConditions,
  deleteAllConditionTags,
  conditionHandlers,
  insertConditionTag,
  calculateOrientation,
  checkResolution
};
