import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import configService from '../services/configService.js';

let privacyModeCache = {
  expiresAt: 0,
  enabled: false
};

function parseCookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((cookies, item) => {
    const index = item.indexOf('=');
    if (index <= 0) return cookies;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    if (!key) return cookies;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
    return cookies;
  }, {});
}

async function findActiveUser(userId) {
  if (!userId) return null;
  const user = await db('users')
    .where({ id: userId })
    .select('id', 'username', 'role', 'is_disabled', 'review_status')
    .first();
  if (!user || user.is_disabled || user.review_status === 'pending') return null;
  return user;
}

async function resolveApiToken(token) {
  if (!token) return null;
  const tokenRecord = await db('api_tokens').where({ token }).first();
  if (!tokenRecord?.user_id) return null;
  await db('api_tokens').where({ id: tokenRecord.id }).update({ last_used_at: db.fn.now() });
  return findActiveUser(tokenRecord.user_id);
}

export async function isPrivacyModeEnabled() {
  const now = Date.now();
  if (privacyModeCache.expiresAt > now) return privacyModeCache.enabled;
  const siteConfig = await configService.readSiteConfig();
  privacyModeCache = {
    expiresAt: now + 1000,
    enabled: !!siteConfig.registration?.privacyMode
  };
  return privacyModeCache.enabled;
}

export async function resolvePrivacyUser(req) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';
  const cookies = parseCookies(req);
  const jwtToken = bearerToken || req.query.auth || cookies.taotu_token;

  if (jwtToken) {
    try {
      const decoded = jwt.verify(String(jwtToken), process.env.JWT_SECRET);
      const user = await findActiveUser(decoded.id);
      if (user) return user;
    } catch {
      const apiTokenUser = await resolveApiToken(jwtToken);
      if (apiTokenUser) return apiTokenUser;
    }
  }

  return resolveApiToken(req.query.tk);
}

export async function requirePrivacyAccess(req, res, next) {
  try {
    if (!(await isPrivacyModeEnabled())) return next();
    const user = await resolvePrivacyUser(req);
    if (!user) {
      return res.status(403).json({ error: '网站已开启隐私模式，请登录后访问' });
    }
    req.privacyUser = user;
    next();
  } catch (err) {
    next(err);
  }
}

export default requirePrivacyAccess;
