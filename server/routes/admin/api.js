import express from 'express';
import authMiddleware from '../../middleware/auth.js';
import requireAdmin from '../../middleware/requireAdmin.js';
import {v4 as uuidv4} from 'uuid';
import { isIP } from 'node:net';
import db from '../../db/index.js';
import { DEFAULT_PERMISSIONS } from '../../middleware/apiTokenAccess.js';
import { normalizeTokenLabel } from '../../utils/apiTokenPolicy.js';

const router = express.Router();

// API 设置
router.get('/config', authMiddleware, requireAdmin, async (req, res) => {
  res.json({
    dynamicLinkBox: true,
    tagSelector: true,
    livePreview: true,
    dynamicParams: true
  });
});

// 更新 API 设置（占位）
router.put('/config', authMiddleware, requireAdmin, async (req, res) => {
  res.json({ message: 'API 配置已更新' });
});

// Token 列表（只返回当前用户的 Token）
router.get('/tokens', authMiddleware, async (req, res) => {
  const tokens = await db('api_tokens')
    .where({ user_id: req.user.id })
    .select('id', 'token', 'label', 'is_global', 'user_id', 'permissions', 'referer_allowlist', 'ip_allowlist', 'yearly_limit', 'monthly_limit', 'daily_limit', 'created_at', 'last_used_at');
  res.json({ tokens: tokens.map((record) => req.user.role === 'admin'
    ? record
    : (({ token, ...safeRecord }) => ({ ...safeRecord, token_hint: `${token.slice(0, 5)}••••${token.slice(-4)}` }))(record)) });
});

// 创建 Token（自动关联当前用户）
router.post('/tokens', authMiddleware, async (req, res) => {
  const { label, referer_allowlist = [], ip_allowlist = [], yearly_limit = 0, monthly_limit = 0, daily_limit = 0 } = req.body;
  const permissions = req.body.permissions ?? [...DEFAULT_PERMISSIONS, ...(req.user.role === 'admin' ? ['admin:manage'] : [])];
  const normalized = validateTokenSettings({ label, permissions, referer_allowlist, ip_allowlist, yearly_limit, monthly_limit, daily_limit }, req.user.role);
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  const token = uuidv4().replace(/-/g, '');
  const [id] = await db('api_tokens').insert({ token, label, is_global: false, user_id: req.user.id, ...normalized.value });
  res.json({ id, token, label: normalized.value.label });
});

router.put('/tokens/:id', authMiddleware, async (req, res) => {
  const record = await db('api_tokens').where({ id: req.params.id }).first();
  if (!record) return res.status(404).json({ error: 'Token 不存在' });
  if (Number(record.user_id) !== Number(req.user.id)) return res.status(403).json({ error: '无权编辑此 Token' });
  const normalized = validateTokenSettings(req.body, req.user.role);
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  await db('api_tokens').where({ id: record.id }).update(normalized.value);
  res.json({ message: 'Token 权限已更新', label: normalized.value.label });
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
  await db('api_token_usage').where({ token_id: req.params.id }).del();
  res.json({ message: 'Token 已删除' });
});

export default router;

const ALLOWED_PERMISSIONS = new Set([...DEFAULT_PERMISSIONS, 'tags:read', 'admin:manage']);

function validateTokenSettings(input, role) {
  const permissions = Array.isArray(input.permissions) ? [...new Set(input.permissions)] : null;
  if (!permissions || permissions.some((permission) => !ALLOWED_PERMISSIONS.has(permission))) return { error: 'Token 权限配置无效' };
  if (permissions.includes('admin:manage') && role !== 'admin') return { error: '只有管理员可以创建管理面板 Token' };
  const parseEntries = (value, label, validate) => {
    const entries = Array.isArray(value) ? value : String(value || '').split(/[\n,;]+/);
    const filtered = [...new Set(entries.map((entry) => String(entry).trim()).filter(Boolean))];
    if (filtered.some((entry) => entry.length > 255 || /[<>\s]/.test(entry))) throw new Error(`${label}格式无效`);
    if (validate && filtered.some((entry) => !validate(entry))) throw new Error(`${label}格式无效`);
    return JSON.stringify(filtered);
  };
  const parseLimit = (value, label) => {
    const number = Number(value || 0);
    if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label}必须为大于或等于 0 的整数`);
    return number;
  };
  try {
    return { value: {
      label: normalizeTokenLabel(input.label),
      permissions: JSON.stringify(permissions),
      referer_allowlist: parseEntries(input.referer_allowlist, 'Referer 白名单'),
      ip_allowlist: parseEntries(input.ip_allowlist, 'IP 白名单', (entry) => {
        if (!entry.includes('/')) return isIP(entry) > 0;
        const [address, prefixText, ...rest] = entry.split('/');
        const prefix = Number(prefixText);
        return rest.length === 0 && isIP(address) === 4 && Number.isInteger(prefix) && prefix >= 0 && prefix <= 32;
      }),
      yearly_limit: parseLimit(input.yearly_limit, '年额度'),
      monthly_limit: parseLimit(input.monthly_limit, '月额度'),
      daily_limit: parseLimit(input.daily_limit, '日额度')
    } };
  } catch (error) {
    return { error: error.message };
  }
}
