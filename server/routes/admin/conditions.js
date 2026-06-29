/**
 * 管理后台 - 条件标签 CRUD（数据库模式）
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const configService = require('../../services/configService');
const db = require('../../db');
const logger = require('../../config/logger');

const router = express.Router();

function parseJsonConfig(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function normalizeCondition(row) {
  return {
    ...row,
    config: parseJsonConfig(row.config),
    is_enabled: row.is_enabled !== false && row.is_enabled !== 0,
    is_public: row.is_public === true || row.is_public === 1
  };
}

function buildConditionTagName(condition) {
  return `cond_${condition.type}_${condition.name}`;
}

// 获取条件标签列表
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 8));
    const offset = (page - 1) * pageSize;
    const [{ count }] = await db('conditions').count('* as count');
    const total = Number(count || 0);
    const conditions = await db('conditions')
      .select('*')
      .orderBy('id', 'asc')
      .limit(pageSize)
      .offset(offset);
    res.json({
      conditions: conditions.map(normalizeCondition),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    });
  } catch (err) { next(err); }
});

// 添加条件标签
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { name, type, config: condConfig, is_enabled, is_public } = req.body;
    if (!name || !type) return res.status(400).json({ error: '名称和类型必填' });

    // 计算新 ID
    const maxRow = await db('conditions').max('id as maxId').first();
    const newCondId = (maxRow?.maxId || 0) + 1;

    // 写入 conditions 表
    await db('conditions').insert({
      id: newCondId,
      name,
      type,
      config: JSON.stringify(condConfig || {}),
      is_enabled: is_enabled !== false,
      is_public: !!is_public
    });

    // 同步创建对应标签到 tags 表
    const maxTagRow = await db('tags').max('id as maxId').first();
    const newTagId = (maxTagRow?.maxId || 0) + 1;

    await db('tags').insert({
      id: newTagId,
      name: `cond_${type}_${name}`,
      display_name: name,
      combinable: true,
      is_public: !!is_public,
      tag_type: 'condition'
    });

    // 更新 conditions 的 tag_id（如果有这个列的话）
    try {
      await db('conditions').where({ id: newCondId }).update({ tag_id: newTagId });
    } catch {}

    logger.info(`条件标签已创建: ${name} (${type})`);
    res.json({ id: newCondId, name, type, config: condConfig, is_enabled, is_public: !!is_public, tag_id: newTagId });
  } catch (err) { next(err); }
});

// 更新条件标签
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const condId = parseInt(req.params.id);
    const previous = await db('conditions').where({ id: condId }).first();
    if (!previous) return res.status(404).json({ error: '条件标签不存在' });

    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.type !== undefined) updates.type = req.body.type;
    if (req.body.config !== undefined) updates.config = JSON.stringify(req.body.config);
    if (req.body.is_enabled !== undefined) updates.is_enabled = req.body.is_enabled;
    if (req.body.is_public !== undefined) updates.is_public = req.body.is_public;
    updates.updated_at = db.fn.now();

    await db('conditions').where({ id: condId }).update(updates);

    // 同步更新关联的标签
    const cond = await db('conditions').where({ id: condId }).first();
    if (cond) {
      try {
        const oldTagName = buildConditionTagName(previous);
        const nextTagName = buildConditionTagName(cond);
        await db('tags').where({ name: oldTagName }).update({
          name: nextTagName,
          display_name: cond.name,
          is_public: cond.is_public === true || cond.is_public === 1
        });
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
      const tagName = buildConditionTagName(cond);
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
