/**
 * 管理后台 - 条件标签 CRUD（数据库模式）
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const configService = require('../../services/configService');
const db = require('../../db');
const logger = require('../../config/logger');

const router = express.Router();

// 获取条件标签列表
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const conditions = await db('conditions').select('*');
    res.json({ conditions });
  } catch (err) { next(err); }
});

// 添加条件标签
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { name, type, config: condConfig, is_enabled } = req.body;
    if (!name || !type) return res.status(400).json({ error: '名称和类型必填' });

    // 计算新 ID
    const maxRow = await db('conditions').max('id as maxId').first();
    const newCondId = (maxRow?.maxId || 0) + 1;

    // 写入 conditions 表
    const [id] = await db('conditions').insert({
      id: newCondId,
      name,
      type,
      config: JSON.stringify(condConfig || {}),
      is_enabled: is_enabled !== false,
      is_public: false
    });

    // 同步创建对应标签到 tags 表
    const maxTagRow = await db('tags').max('id as maxId').first();
    const newTagId = (maxTagRow?.maxId || 0) + 1;

    await db('tags').insert({
      id: newTagId,
      name: `cond_${type}_${name}`,
      display_name: name,
      combinable: true,
      is_public: false,
      tag_type: 'condition'
    });

    // 更新 conditions 的 tag_id（如果有这个列的话）
    try {
      await db('conditions').where({ id }).update({ tag_id: newTagId });
    } catch {}

    logger.info(`条件标签已创建: ${name} (${type})`);
    res.json({ id, name, type, config: condConfig, is_enabled, tag_id: newTagId });
  } catch (err) { next(err); }
});

// 更新条件标签
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const condId = parseInt(req.params.id);
    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.config !== undefined) updates.config = JSON.stringify(req.body.config);
    if (req.body.is_enabled !== undefined) updates.is_enabled = req.body.is_enabled;
    if (req.body.is_public !== undefined) updates.is_public = req.body.is_public;

    await db('conditions').where({ id: condId }).update(updates);

    // 同步更新关联的标签
    const cond = await db('conditions').where({ id: condId }).first();
    if (cond && req.body.name) {
      try {
        await db('tags').where({ name: `like`, display_name: cond.name }).update({ display_name: req.body.name });
      } catch {}
    }

    res.json({ message: '已更新' });
  } catch (err) { next(err); }
});

// 删除条件标签
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const condId = parseInt(req.params.id);
    const cond = await db('conditions').where({ id: condId }).first();

    // 删除关联的标签
    if (cond) {
      const tagName = `cond_${cond.type}_${cond.name}`;
      const tag = await db('tags').where({ name: tagName }).first();
      if (tag) {
        await db('image_tags').where({ tag_id: tag.id }).del();
        await db('tags').where({ id: tag.id }).del();
      }
    }

    await db('conditions').where({ id: condId }).del();
    logger.info(`条件标签已删除: ID ${condId}`);
    res.json({ message: '已删除' });
  } catch (err) { next(err); }
});

module.exports = router;
