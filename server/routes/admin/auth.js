/**
 * 认证 API — 支持管理员和普通用户
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../../db');
const authMiddleware = require('../../middleware/auth');
const configService = require('../../services/configService');
const redisService = require('../../services/redisService');
const mailService = require('../../services/mailService');

const router = express.Router();
const uploadsDir = path.resolve(__dirname, '../../../data/uploads');
const tmpUploadDir = path.join(uploadsDir, 'tmp');
if (!fs.existsSync(tmpUploadDir)) fs.mkdirSync(tmpUploadDir, { recursive: true });

const CAPTCHA_TTL_SECONDS = 120;
const EMAIL_CODE_TTL_SECONDS = 120;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length = 5) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)];
  }
  return code;
}

function pickChars(source, count) {
  return Array.from({ length: count }, () => source[crypto.randomInt(0, source.length)]);
}

function shuffleParts(parts) {
  const shuffled = [...parts];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function randomEmailCode() {
  const digits = '23456789';
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const parts = [
    ...pickChars(digits, 2),
    ...pickChars(letters, 3)
  ];
  return shuffleParts(parts).join('');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function registrationCapacityReached(siteConfig) {
  const maxUsers = Number(siteConfig.registration?.maxUsers || 0);
  if (!Number.isFinite(maxUsers) || maxUsers <= 0) return false;
  const row = await db('users').where({ role: 'user' }).count('* as count').first();
  return Number(row?.count || 0) >= maxUsers;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(email) {
  const [name, domain] = String(email || '').split('@');
  if (!name || !domain) return '';
  const visible = name.length <= 2 ? name.slice(0, 1) : name.slice(0, 2);
  return visible + '***@' + domain;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || '';
}

function buildCaptchaSvg(code) {
  const width = 160;
  const height = 52;
  const chars = code.split('');
  const noise = Array.from({ length: 8 }, () => {
    const x1 = crypto.randomInt(0, width);
    const y1 = crypto.randomInt(0, height);
    const x2 = crypto.randomInt(0, width);
    const y2 = crypto.randomInt(0, height);
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#8a8a8a" stroke-width="1" opacity="0.45" />';
  }).join('');
  const text = chars.map((char, index) => {
    const x = 18 + index * 26 + crypto.randomInt(-3, 4);
    const y = 34 + crypto.randomInt(-5, 6);
    const rotate = crypto.randomInt(-18, 19);
    return '<text x="' + x + '" y="' + y + '" transform="rotate(' + rotate + ' ' + x + ' ' + y + ')" font-size="28" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#111">' + escapeHtml(char) + '</text>';
  }).join('');

  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"><rect width="100%" height="100%" fill="#fff"/><rect x="0.5" y="0.5" width="159" height="51" fill="none" stroke="#d1d1d1"/>' + noise + text + '</svg>';
}

async function verifyCaptcha(captchaId, captchaCode) {
  if (!captchaId || !captchaCode) {
    const err = new Error('请填写人机验证码');
    err.statusCode = 400;
    throw err;
  }

  const key = 'captcha:' + captchaId;
  const saved = await redisService.get(key);
  if (!saved) {
    const err = new Error('人机验证码已过期，请刷新后重试');
    err.statusCode = 400;
    throw err;
  }

  await redisService.del(key);
  if (String(saved).toLowerCase() !== String(captchaCode).trim().toLowerCase()) {
    const err = new Error('人机验证码错误');
    err.statusCode = 400;
    throw err;
  }
}

async function verifyEmailCode(email, emailCode) {
  if (!emailCode) {
    const err = new Error('请输入邮箱验证码');
    err.statusCode = 400;
    throw err;
  }

  const normalizedEmail = normalizeEmail(email);
  const key = 'register:email:' + normalizedEmail;
  const saved = await redisService.get(key);
  if (!saved) {
    const err = new Error('邮箱验证码已过期，请重新发送');
    err.statusCode = 400;
    throw err;
  }
  if (String(saved).toLowerCase() !== String(emailCode).trim().toLowerCase()) {
    const err = new Error('邮箱验证码错误');
    err.statusCode = 400;
    throw err;
  }
  await redisService.del(key);
}

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

    if (user.review_status === 'pending') {
      return res.status(403).json({ error: '该用户未审核，请等待管理员启用' });
    }
    if (user.is_disabled) {
      return res.status(403).json({ error: '用户已被禁用，请咨询管理员' });
    }

    await db('users').where({ id: user.id }).update({
      last_login_at: db.fn.now(),
      last_login_ip: getClientIp(req)
    });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, email: user.email, avatar: user.avatar || null }
    });
  } catch (err) {
    next(err);
  }
});

// 图片人机验证码
router.get('/captcha', async (req, res, next) => {
  try {
    const code = randomCode(5);
    const captchaId = crypto.randomUUID();
    await redisService.setEx('captcha:' + captchaId, CAPTCHA_TTL_SECONDS, code.toLowerCase());
    res.json({ captchaId, svg: buildCaptchaSvg(code), ttl: CAPTCHA_TTL_SECONDS });
  } catch (err) {
    next(err);
  }
});

// 发送注册邮箱验证码
router.post('/register-code', async (req, res, next) => {
  try {
    const { email, captchaId, captchaCode } = req.body;
    const siteConfig = await configService.readSiteConfig();
    if (!siteConfig.registration?.enabled) {
      return res.status(403).json({ error: '注册功能未开放' });
    }
    if (await registrationCapacityReached(siteConfig)) {
      return res.status(403).json({ error: '注册用户数已达到上限' });
    }
    if (!siteConfig.registration?.emailVerification) {
      return res.status(400).json({ error: '当前未启用邮箱验证' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: '请输入有效邮箱' });
    }

    const existingEmail = await db('users').where({ email: normalizedEmail }).first();
    if (existingEmail) {
      return res.status(409).json({ error: '邮箱已被使用' });
    }

    await verifyCaptcha(captchaId, captchaCode);

    const code = randomEmailCode();
    const emailCodeKey = 'register:email:' + normalizedEmail;
    await redisService.setEx(emailCodeKey, EMAIL_CODE_TTL_SECONDS, code.toLowerCase());
    try {
      await mailService.sendVerificationCode(normalizedEmail, code);
    } catch (err) {
      await redisService.del(emailCodeKey);
      throw err;
    }

    res.json({ message: '验证码已发送', ttl: EMAIL_CODE_TTL_SECONDS });
  } catch (err) {
    next(err);
  }
});

// 注册（普通用户）
router.post('/register', async (req, res, next) => {
  try {
    const { username, password, email, emailCode, captchaId, captchaCode } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' });
    }

    const siteConfig = await configService.readSiteConfig();
    if (!siteConfig.registration?.enabled) {
      return res.status(403).json({ error: '注册功能未开放' });
    }
    if (await registrationCapacityReached(siteConfig)) {
      return res.status(403).json({ error: '注册用户数已达到上限' });
    }

    await verifyCaptcha(captchaId, captchaCode);

    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: '请输入有效邮箱' });
    }

    if (siteConfig.registration?.emailVerification) {
      if (!normalizedEmail) {
        return res.status(400).json({ error: '请输入有效邮箱' });
      }
      await verifyEmailCode(normalizedEmail, emailCode);
    }

    const existing = await db('users').where({ username }).first();
    if (existing) {
      return res.status(409).json({ error: '用户名已存在' });
    }

    if (normalizedEmail) {
      const existingEmail = await db('users').where({ email: normalizedEmail }).first();
      if (existingEmail) {
        return res.status(409).json({ error: '邮箱已被使用' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const requireReview = !!siteConfig.registration?.requireReview;
    const [id] = await db('users').insert({
      username,
      password_hash: passwordHash,
      email: normalizedEmail || null,
      role: 'user',
      is_disabled: requireReview,
      review_status: requireReview ? 'pending' : 'approved'
    });

    if (requireReview) {
      return res.json({ pendingReview: true, message: '注册成功，等待管理员审核账户。' });
    }

    const token = jwt.sign(
      { id, username, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id, username, role: 'user', email: normalizedEmail || null, avatar: null } });
  } catch (err) {
    next(err);
  }
});


// 发送忘记密码邮箱验证码
router.post('/forgot-password-code', async (req, res, next) => {
  try {
    const { username, captchaId, captchaCode } = req.body;
    if (!username) {
      return res.status(400).json({ error: '请输入用户名' });
    }

    await verifyCaptcha(captchaId, captchaCode);

    const user = await db('users').where({ username }).select('id', 'email').first();
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const normalizedEmail = normalizeEmail(user.email);
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: '该账号未绑定有效邮箱，请联系管理员' });
    }

    const code = randomEmailCode();
    const resetKey = 'reset:password:' + user.id;
    await redisService.setEx(resetKey, EMAIL_CODE_TTL_SECONDS, code.toLowerCase());
    try {
      await mailService.sendPasswordResetCode(normalizedEmail, code);
    } catch (err) {
      await redisService.del(resetKey);
      throw err;
    }

    res.json({ message: '验证码已发送到绑定邮箱', maskedEmail: maskEmail(normalizedEmail), ttl: EMAIL_CODE_TTL_SECONDS });
  } catch (err) {
    next(err);
  }
});

// 忘记密码重置
router.post('/reset-password', async (req, res, next) => {
  try {
    const { username, emailCode, captchaId, captchaCode, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).json({ error: '请输入用户名和新密码' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: '密码至少6位' });
    }
    if (!emailCode) {
      return res.status(400).json({ error: '请输入邮箱验证码' });
    }

    await verifyCaptcha(captchaId, captchaCode);

    const user = await db('users').where({ username }).select('id', 'email').first();
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const normalizedEmail = normalizeEmail(user.email);
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: '该账号未绑定有效邮箱，请联系管理员' });
    }

    const resetKey = 'reset:password:' + user.id;
    const saved = await redisService.get(resetKey);
    if (!saved) {
      return res.status(400).json({ error: '邮箱验证码已过期，请重新发送' });
    }
    if (String(saved).toLowerCase() !== String(emailCode).trim().toLowerCase()) {
      return res.status(400).json({ error: '邮箱验证码错误' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id: user.id }).update({ password_hash: passwordHash });
    await redisService.del(resetKey);

    res.json({ message: '密码已重置，请使用新密码登录' });
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

// 上传当前用户头像
router.post('/upload-avatar', authMiddleware, multer({ dest: tmpUploadDir }).single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请选择文件' });
    const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
    const avatarDir = path.join(uploadsDir, 'avatars');
    if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
    const filename = `user_${req.user.id}_${Date.now()}${ext}`;
    const destPath = path.join(avatarDir, filename);
    fs.renameSync(req.file.path, destPath);

    const avatarUrl = `/uploads/avatars/${filename}`;
    await db('users').where({ id: req.user.id }).update({ avatar: avatarUrl });

    res.json({ url: avatarUrl });
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
