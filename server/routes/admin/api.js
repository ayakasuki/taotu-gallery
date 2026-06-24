const express = require('express');
const authMiddleware = require('../../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const db = require('../../db');

const router = express.Router();

// API 设置
router.get('/config', authMiddleware, async (req, res) => {
  res.json({
    dynamicLinkBox: true,
    tagSelector: true,
    livePreview: true,
    dynamicParams: true
  });
});

// 更新 API 设置（占位）
router.put('/config', authMiddleware, async (req, res) => {
  res.json({ message: 'API 配置已更新' });
});

// Token 列表（只返回当前用户的 Token）
router.get('/tokens', authMiddleware, async (req, res) => {
  const tokens = await db('api_tokens')
    .where({ user_id: req.user.id })
    .select('id', 'label', 'is_global', 'user_id', 'created_at', 'last_used_at');
  res.json({ tokens });
});

// 创建 Token（自动关联当前用户）
router.post('/tokens', authMiddleware, async (req, res) => {
  const { label } = req.body;
  const token = uuidv4().replace(/-/g, '');
  const [id] = await db('api_tokens').insert({ token, label, is_global: false, user_id: req.user.id });
  res.json({ id, token, label });
});

// 删除 Token（只能删除自己的）
router.delete('/tokens/:id', authMiddleware, async (req, res) => {
  const token = await db('api_tokens').where({ id: req.params.id }).first();
  if (!token) return res.status(404).json({ error: 'Token 不存在' });

  const user = await db('users').where({ id: req.user.id }).first();
  if (user.role !== 'admin' && token.user_id !== req.user.id) {
    return res.status(403).json({ error: '无权删除此 Token' });
  }

  await db('api_tokens').where({ id: req.params.id }).del();
  res.json({ message: 'Token 已删除' });
});

module.exports = router;
