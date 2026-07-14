/**
 * 模型管理服务
 * 当前为桩实现，models 表 is_enabled 默认 FALSE
 */
import db from '../db/index.js';

import logger from '../config/logger.js';

// 获取所有模型
async function getAllModels() {
  return db('models').select('*');
}

// 获取单个模型
async function getModelById(id) {
  return db('models').where({ id }).first();
}

// 创建模型（桩，不实际启用）
async function createModel(modelData) {
  const [id] = await db('models').insert({
    ...modelData,
    is_enabled: false, // 强制不启用
    status: 'idle'
  });
  logger.info(`模型记录已创建（桩）: ${modelData.name}`);
  return getModelById(id);
}

// 更新模型
async function updateModel(id, modelData) {
  await db('models').where({ id }).update({
    ...modelData,
    updated_at: db.fn.now()
  });
  return getModelById(id);
}

// 删除模型
async function deleteModel(id) {
  return db('models').where({ id }).del();
}

export default {
  getAllModels,
  getModelById,
  createModel,
  updateModel,
  deleteModel
};
