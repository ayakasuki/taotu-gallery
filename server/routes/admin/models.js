const express = require('express');
const authMiddleware = require('../../middleware/auth');

const router = express.Router();

// 模型列表（桩，暂不启用）
router.get('/', authMiddleware, async (req, res) => {
  res.json({
    models: [],
    message: 'AI 标签功能暂未启用，计划接入远程视觉大模型'
  });
});

// 添加模型（桩）
router.post('/', authMiddleware, async (req, res) => {
  res.status(501).json({ error: 'AI 模型功能暂未启用' });
});

// 更新模型（桩）
router.put('/:id', authMiddleware, async (req, res) => {
  res.status(501).json({ error: 'AI 模型功能暂未启用' });
});

// 删除模型（桩）
router.delete('/:id', authMiddleware, async (req, res) => {
  res.status(501).json({ error: 'AI 模型功能暂未启用' });
});

module.exports = router;
