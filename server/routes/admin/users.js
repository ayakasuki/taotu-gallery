const express = require('express');
const authMiddleware = require('../../middleware/auth');
const db = require('../../db');

const router = express.Router();

// 用户列表
router.get('/', authMiddleware, async (req, res) => {
  const users = await db('users').select('id', 'username', 'email', 'role', 'last_login_at', 'created_at');
  res.json({ users });
});

// 创建用户
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const bcrypt = require('bcryptjs');
    const { username, password, email, role } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const [id] = await db('users').insert({ username, password_hash: passwordHash, email, role: role || 'user' });
    res.json({ id, username, email, role: role || 'user' });
  } catch (err) {
    next(err);
  }
});

// 更新用户
router.put('/:id', authMiddleware, async (req, res) => {
  const { email, role } = req.body;
  await db('users').where({ id: req.params.id }).update({ email, role });
  res.json({ message: '用户已更新' });
});

// 删除用户
router.delete('/:id', authMiddleware, async (req, res) => {
  await db('users').where({ id: req.params.id }).del();
  res.json({ message: '用户已删除' });
});

module.exports = router;
