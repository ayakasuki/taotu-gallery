import express from 'express';
import db from '../../db/index.js';

const router = express.Router();

const DEFAULT_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'ico'];
const DEFAULT_NSFW_CONFIG = {
  nsfwjs: { endpoint: '', thresholds: { Drawing: 100, Hentai: 60, Neutral: 100, Porn: 40, Sexy: 70 } },
  tencent_ims: { endpoint: '', secretId: '', secretKey: '', region: 'ap-guangzhou' }
};

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function toBool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function toNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

function normalizeFormats(value) {
  const formats = Array.isArray(value) ? value : parseJson(value, DEFAULT_FORMATS);
  const normalized = [...new Set((formats || []).map(item => String(item || '').toLowerCase()).filter(Boolean))];
  return normalized.length ? normalized : DEFAULT_FORMATS;
}

function normalizePayload(body = {}) {
  return {
    name: String(body.name || '').trim(),
    max_file_size_mb: toNumber(body.max_file_size_mb),
    max_concurrent_uploads: Math.floor(toNumber(body.max_concurrent_uploads)),
    upload_limit_minute: Math.floor(toNumber(body.upload_limit_minute)),
    upload_limit_hour: Math.floor(toNumber(body.upload_limit_hour)),
    upload_limit_day: Math.floor(toNumber(body.upload_limit_day)),
    upload_limit_week: Math.floor(toNumber(body.upload_limit_week)),
    upload_limit_month: Math.floor(toNumber(body.upload_limit_month)),
    path_rule: String(body.path_rule || '{yyyy}-{mm}-{dd}').trim() || '{yyyy}-{mm}-{dd}',
    filename_rule: String(body.filename_rule || '{uniqid}').trim() || '{uniqid}',
    image_quality: Math.max(40, Math.min(100, Math.floor(toNumber(body.image_quality, 85)))),
    medium_width: Math.max(1, Math.floor(toNumber(body.medium_width, 1920))),
    medium_height: Math.max(1, Math.floor(toNumber(body.medium_height, 1080))),
    allowed_formats: JSON.stringify(normalizeFormats(body.allowed_formats)),
    image_review_enabled: toBool(body.image_review_enabled) ? 1 : 0,
    nsfw_visible: toBool(body.nsfw_visible) ? 1 : 0,
    nsfw_engine: ['nsfwjs', 'tencent_ims'].includes(String(body.nsfw_engine)) ? String(body.nsfw_engine) : 'nsfwjs',
    nsfw_config: JSON.stringify({ ...DEFAULT_NSFW_CONFIG, ...parseJson(body.nsfw_config, DEFAULT_NSFW_CONFIG) }),
    is_default: toBool(body.is_default) ? 1 : 0
  };
}

function serializeGroup(row = {}) {
  return {
    ...row,
    is_default: !!row.is_default,
    image_review_enabled: !!row.image_review_enabled,
    nsfw_visible: !!row.nsfw_visible,
    max_file_size_mb: Number(row.max_file_size_mb || 0),
    allowed_formats: parseJson(row.allowed_formats, DEFAULT_FORMATS),
    nsfw_config: parseJson(row.nsfw_config, DEFAULT_NSFW_CONFIG),
    user_count: Number(row.user_count || 0),
    strategy_count: Number(row.strategy_count || 0)
  };
}

router.get('/', async (req, res, next) => {
  try {
    const userCounts = db('users').select('user_group_id').count({ user_count: 'id' }).groupBy('user_group_id').as('uc');
    const strategyCounts = db('storage_strategies').select('user_group_id').count({ strategy_count: 'id' }).groupBy('user_group_id').as('sc');
    const groups = await db('user_groups as g')
      .leftJoin(userCounts, 'uc.user_group_id', 'g.id')
      .leftJoin(strategyCounts, 'sc.user_group_id', 'g.id')
      .select('g.*', db.raw('COALESCE(uc.user_count, 0) as user_count'), db.raw('COALESCE(sc.strategy_count, 0) as strategy_count'))
      .orderBy('g.is_default', 'desc')
      .orderBy('g.id', 'asc');
    res.json({ groups: groups.map(serializeGroup) });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const group = await db('user_groups').where({ id: req.params.id }).first();
    if (!group) return res.status(404).json({ error: '用户组不存在' });
    const [{ count: userCount }] = await db('users').where({ user_group_id: group.id }).count('* as count');
    const [{ count: strategyCount }] = await db('storage_strategies').where({ user_group_id: group.id }).count('* as count');
    res.json(serializeGroup({ ...group, user_count: userCount, strategy_count: strategyCount }));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = normalizePayload(req.body);
    if (!payload.name) return res.status(400).json({ error: '用户组名称不能为空' });
    const saved = await db.transaction(async trx => {
      if (payload.is_default) await trx('user_groups').update({ is_default: 0 });
      const [id] = await trx('user_groups').insert(payload);
      return trx('user_groups').where({ id }).first();
    });
    res.json(serializeGroup(saved));
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '用户组名称已存在' });
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await db('user_groups').where({ id: req.params.id }).first();
    if (!existing) return res.status(404).json({ error: '用户组不存在' });
    const payload = normalizePayload(req.body);
    if (!payload.name) return res.status(400).json({ error: '用户组名称不能为空' });
    const saved = await db.transaction(async trx => {
      if (payload.is_default) await trx('user_groups').whereNot({ id: existing.id }).update({ is_default: 0 });
      await trx('user_groups').where({ id: existing.id }).update({ ...payload, updated_at: trx.fn.now() });
      return trx('user_groups').where({ id: existing.id }).first();
    });
    res.json(serializeGroup(saved));
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '用户组名称已存在' });
    next(err);
  }
});

export default router;
