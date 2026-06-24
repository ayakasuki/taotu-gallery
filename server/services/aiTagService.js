/**
 * AI 标签服务（桩实现）
 * 暂不启用，预留接口供未来接入远程多模态视觉大模型（如硅基流动）
 */
const logger = require('../config/logger');

const AI_NOT_ENABLED = { success: false, reason: 'AI_NOT_ENABLED', message: 'AI 标签功能暂未启用，计划接入远程视觉大模型' };

// 单张图片 AI 标签
async function tagImage(imageId, modelId) {
  logger.info(`AI 标签请求（桩）: 图片 ${imageId}, 模型 ${modelId}`);
  return AI_NOT_ENABLED;
}

// 批量 AI 标签
async function tagBatch(imageIds, modelId) {
  logger.info(`AI 批量标签请求（桩）: ${imageIds.length} 张图片, 模型 ${modelId}`);
  return AI_NOT_ENABLED;
}

// 全部重标签
async function retagAll(modelId, overwrite = false) {
  logger.info(`AI 全部重标签请求（桩）: 模型 ${modelId}, 覆盖=${overwrite}`);
  return AI_NOT_ENABLED;
}

// 删除所有 AI 标签
async function deleteAllAiTags() {
  const db = require('../db');
  const count = await db('image_tags').where({ source: 'ai' }).del();
  logger.info(`已删除 ${count} 条 AI 标签`);
  return count;
}

// 获取模型状态
async function getModelStatus(modelId) {
  return {
    enabled: false,
    status: 'disabled',
    message: 'AI 标签功能暂未启用'
  };
}

module.exports = {
  tagImage,
  tagBatch,
  retagAll,
  deleteAllAiTags,
  getModelStatus
};
