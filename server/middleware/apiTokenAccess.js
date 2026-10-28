import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import {
  DEFAULT_TOKEN_PERMISSIONS,
  consumeTokenQuota,
  getTokenPermissions,
  hasTokenPermission,
  isSourceAllowed,
  parseAllowlist,
  requiredTokenPermission
} from '../utils/apiTokenPolicy.js';

const DEFAULT_PERMISSIONS = DEFAULT_TOKEN_PERMISSIONS;

function tokenFromRequest(req) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (bearer) {
    try {
      jwt.verify(bearer, process.env.JWT_SECRET);
      return null;
    } catch {
      return bearer;
    }
  }
  return typeof req.query.tk === 'string' ? req.query.tk : null;
}

async function countCall(token, limits) {
  return consumeTokenQuota(db, token.id, limits);
}

export default async function apiTokenAccess(req, res, next) {
  try {
    const rawToken = tokenFromRequest(req);
    if (!rawToken) return next();
    const record = await db('api_tokens').where({ token: rawToken }).first();
    if (!record) return res.status(401).json({ error: '无效的 API Token', code: 'INVALID_API_TOKEN' });
    const permissions = getTokenPermissions(record);
    const permission = requiredTokenPermission(req.originalUrl || `${req.baseUrl || ''}${req.path}`);
    if (!hasTokenPermission(permissions, permission)) {
      return res.status(403).json({ error: '此 API Token 未获准执行该操作', code: 'TOKEN_PERMISSION_DENIED' });
    }

    const ips = parseAllowlist(record.ip_allowlist);
    const referers = parseAllowlist(record.referer_allowlist);
    if (ips.length || referers.length) {
      const ip = String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
      const allowed = isSourceAllowed({
        ip,
        referer: req.get('referer'),
        origin: req.get('origin'),
        fetchSite: req.get('sec-fetch-site'),
        host: req.get('host'),
        protocol: req.protocol
      }, ips, referers);
      if (!allowed) return res.status(403).json({ error: '请求来源不在此 Token 的白名单内', code: 'TOKEN_SOURCE_DENIED' });
    }

    if (!(await countCall(record, record))) {
      return res.status(429).json({ error: '该 API Token 的年/月/日调用额度已不足', code: 'TOKEN_QUOTA_EXCEEDED' });
    }
    await db('api_tokens').where({ id: record.id }).update({ last_used_at: db.fn.now() });
    req.apiToken = record;
    req.apiTokenUserId = record.user_id;
    if (permission === 'admin:manage' && permissions.includes('admin:manage')) {
      const owner = record.user_id ? await db('users').where({ id: record.user_id }).select('id', 'username', 'role', 'is_disabled', 'review_status').first() : null;
      if (!owner || owner.role !== 'admin' || owner.is_disabled || owner.review_status === 'pending') {
        return res.status(403).json({ error: '管理权限 Token 必须归属有效管理员', code: 'TOKEN_ADMIN_OWNER_REQUIRED' });
      }
      req.user = owner;
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

export { DEFAULT_PERMISSIONS, getTokenPermissions as getPermissions };
