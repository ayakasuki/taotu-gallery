/**
 * 管理后台 - 标签分组 CRUD（支持 sid 子分组 ID）
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const configService = require('../../services/configService');

const router = express.Router();

// 获取所有分组
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const data = await configService.readTagGroups();
    res.json(data);
  } catch (err) { next(err); }
});

// 创建分组
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '分组名不能为空' });

    const data = await configService.readTagGroups();
    const maxId = data.groups.reduce((max, g) => Math.max(max, g.id), 0);

    const group = {
      id: maxId + 1,
      name,
      subgroups: [],
      tagIds: []
    };
    data.groups.push(group);
    await configService.writeTagGroups(data);
    res.json(group);
  } catch (err) { next(err); }
});

// 更新分组（名称、标签）
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);
    const data = await configService.readTagGroups();
    const group = data.groups.find(g => g.id === groupId);
    if (!group) return res.status(404).json({ error: '分组不存在' });

    if (req.body.name !== undefined) group.name = req.body.name;
    if (req.body.tagIds !== undefined) group.tagIds = req.body.tagIds;

    await configService.writeTagGroups(data);
    res.json(group);
  } catch (err) { next(err); }
});

// 删除分组
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);
    const data = await configService.readTagGroups();
    data.groups = data.groups.filter(g => g.id !== groupId);
    await configService.writeTagGroups(data);
    res.json({ message: '已删除' });
  } catch (err) { next(err); }
});

// 添加子分组（自动分配 sid）
router.post('/:id/subgroup', authMiddleware, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '子分组名不能为空' });

    const data = await configService.readTagGroups();
    const group = data.groups.find(g => g.id === groupId);
    if (!group) return res.status(404).json({ error: '分组不存在' });

    // 分配唯一 sid
    const allSids = [];
    for (const g of data.groups) {
      for (const sg of (g.subgroups || [])) {
        if (sg.sid) allSids.push(sg.sid);
      }
    }
    const nextSid = allSids.length > 0 ? Math.max(...allSids) + 1 : 1;

    const subgroup = { sid: nextSid, name, tagIds: [] };
    group.subgroups.push(subgroup);
    await configService.writeTagGroups(data);
    res.json(subgroup);
  } catch (err) { next(err); }
});

// 更新子分组（通过 sid 定位）
router.put('/:id/subgroup/:sid', authMiddleware, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);
    const sid = parseInt(req.params.sid);
    const data = await configService.readTagGroups();
    const group = data.groups.find(g => g.id === groupId);
    if (!group) return res.status(404).json({ error: '分组不存在' });

    const subgroup = (group.subgroups || []).find(s => s.sid === sid);
    if (!subgroup) return res.status(404).json({ error: '子分组不存在' });

    if (req.body.name !== undefined) subgroup.name = req.body.name;
    if (req.body.tagIds !== undefined) subgroup.tagIds = req.body.tagIds;

    await configService.writeTagGroups(data);
    res.json(subgroup);
  } catch (err) { next(err); }
});

// 删除子分组（通过 sid 定位）
router.delete('/:id/subgroup/:sid', authMiddleware, async (req, res, next) => {
  try {
    const groupId = parseInt(req.params.id);
    const sid = parseInt(req.params.sid);
    const data = await configService.readTagGroups();
    const group = data.groups.find(g => g.id === groupId);
    if (!group) return res.status(404).json({ error: '分组不存在' });

    group.subgroups = (group.subgroups || []).filter(s => s.sid !== sid);
    await configService.writeTagGroups(data);
    res.json({ message: '已删除' });
  } catch (err) { next(err); }
});

module.exports = router;
