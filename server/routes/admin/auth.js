/**
 * 认证 API — 支持管理员和普通用户
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../db');
const authMiddleware = require('../../middleware/auth');

const router = express.Router();

// 登录（管理员和普通用户通用）
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const user = await db('users').where({ username }).first();
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    await db('users').where({ id: user.id }).update({ last_login_at: db.fn.now() });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, email: user.email }
    });
  } catch (err) {
    next(err);
  }
});

// 注册（普通用户）
router.post('/register', async (req, res, next) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    // 检查是否开放注册
    const configService = require('../../services/configService');
    const siteConfig = await configService.readSiteConfig();
    if (!siteConfig.registration?.enabled) {
      return res.status(403).json({ error: '注册功能未开放' });
    }

    // 检查用户名是否已存在
    const existing = await db('users').where({ username }).first();
    if (existing) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [id] = await db('users').insert({
      username,
      password_hash: passwordHash,
      email,
      role: 'user'
    });

    const token = jwt.sign(
      { id, username, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id, username, role: 'user', email } });
  } catch (err) {
    next(err);
  }
});

// 修改密码
router.post('/change-password', authMiddleware, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请输入旧密码和新密码' });
    }

    const user = await db('users').where({ id: req.user.id }).first();
    const valid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '旧密码错误' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id: req.user.id }).update({ password_hash: passwordHash });

    res.json({ message: '密码修改成功' });
  } catch (err) {
    next(err);
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user.id })
      .select('id', 'username', 'role', 'email', 'avatar', 'gallery_path', 'created_at')
      .first();
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
