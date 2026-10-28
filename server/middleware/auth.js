import jwt from 'jsonwebtoken';
import db from '../db/index.js';

// JWT 认证中间件（管理后台用）
async function authMiddleware(req, res, next) {
  if (req.user) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (req.apiTokenUserId) {
      const tokenUser = await db('users').where({ id: req.apiTokenUserId })
        .select('id', 'username', 'role', 'is_disabled', 'review_status').first();
      if (tokenUser && !tokenUser.is_disabled && tokenUser.review_status !== 'pending') {
        req.user = tokenUser;
        return next();
      }
      return res.status(403).json({ error: 'API Token 所属用户不可用' });
    }
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db('users')
      .where({ id: decoded.id })
      .select('id', 'username', 'role', 'is_disabled', 'review_status')
      .first();
    if (!user) {
      return res.status(401).json({ error: '认证令牌无效或已过期' });
    }
    if (user.review_status === 'pending') {
      return res.status(403).json({ error: '该用户未审核，请等待管理员启用' });
    }
    if (user.is_disabled) {
      return res.status(403).json({ error: '用户已被禁用，请咨询管理员' });
    }
    req.user = { ...decoded, id: user.id, username: user.username, role: user.role };
    next();
  } catch (err) {
    if (req.apiTokenUserId) {
      const tokenUser = await db('users').where({ id: req.apiTokenUserId })
        .select('id', 'username', 'role', 'is_disabled', 'review_status').first();
      if (tokenUser && !tokenUser.is_disabled && tokenUser.review_status !== 'pending') {
        req.user = tokenUser;
        return next();
      }
    }
    res.status(401).json({ error: '认证令牌无效或已过期' });
  }
}

export default authMiddleware;
