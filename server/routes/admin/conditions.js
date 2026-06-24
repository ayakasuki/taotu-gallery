/**
 * 管理后台 - 条件标签 CRUD
 * 条件标签同时在 tags.json 中创建对应标签条目
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const configService = require('../../services/configService');

const router = express.Router();

// 获取条件标签列表
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const conditions = await configService.readConditions();
    res.json({ conditions });
  } catch (err) {
    next(err);
  }
});

// 添加条件标签
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const conditions = await configService.readConditions();
    const tags = await configService.readTags();
    if (!tags.nextId) tags.nextId = 20;

    const newTagId = tags.nextId++;
    const newCondition = {
      id: newTagId,
      name: req.body.name,
      type: req.body.type,
      config: req.body.config || {},
      is_enabled: req.body.is_enabled !== false,
      tag_id: newTagId,
      created_at: new Date().toISOString()
    };

    conditions.push(newCondition);
    await configService.writeConditions(conditions);

    // 同步创建标签条目
    if (!tags.combinable) tags.combinable = [];
    tags.combinable.push({
      id: newTagId,
      name: `cond_${req.body.type}_${req.body.name}`,
      display_name: req.body.name,
      combinable: true,
      tag_type: 'condition'
    });
    await configService.writeTags(tags);

    // 立即对所有图片执行该条件标签（后台异步执行）
    const conditionTagService = require('../../services/conditionTagService');
    conditionTagService.tagImagesByConditions(null, [newCondition.id], true)
      .then(result => console.log(`条件标签执行完成: 标记 ${result.tagged} 张`))
      .catch(err => console.error(`条件标签执行失败: ${err.message}`));

    res.json(newCondition);
  } catch (err) {
    next(err);
  }
});

// 更新条件标签
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const conditions = await configService.readConditions();
    const idx = conditions.findIndex(c => c.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: '条件不存在' });

    conditions[idx] = { ...conditions[idx], ...req.body };
    await configService.writeConditions(conditions);

    // 同步更新标签显示名
    if (req.body.name) {
      const tags = await configService.readTags();
      const tag = (tags.combinable || []).find(t => t.id === conditions[idx].tag_id);
      if (tag) {
        tag.display_name = req.body.name;
        await configService.writeTags(tags);
      }
    }

    // 立即重新执行该条件标签（覆盖式）
    const conditionTagService = require('../../services/conditionTagService');
    conditionTagService.tagImagesByConditions(null, [conditions[idx].id], true)
      .then(result => console.log(`条件标签更新执行完成: 标记 ${result.tagged} 张`))
      .catch(err => console.error(`条件标签更新执行失败: ${err.message}`));

    res.json(conditions[idx]);
  } catch (err) {
    next(err);
  }
});

// 删除条件标签
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const condId = parseInt(req.params.id);
    const conditions = await configService.readConditions();
    const cond = conditions.find(c => c.id === condId);
    const filtered = conditions.filter(c => c.id !== condId);
    await configService.writeConditions(filtered);

    // 同步删除对应标签
    if (cond && cond.tag_id) {
      const tags = await configService.readTags();
      tags.combinable = (tags.combinable || []).filter(t => t.id !== cond.tag_id);
      tags.nonCombinable = (tags.nonCombinable || []).filter(t => t.id !== cond.tag_id);
      await configService.writeTags(tags);

      // 删除 image_tags 中的关联
      const db = require('../../db');
      await db('image_tags').where({ tag_id: cond.tag_id, source: 'condition' }).del();
    }

    res.json({ message: '已删除' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
