import express from 'express';
import path from 'path';
import { promises as fs, constants as fsConstants } from 'fs';
import net from 'net';
import db from '../../db/index.js';

const router = express.Router();
const TYPES = ['local', 'tencent_cos', 'aliyun_oss', 'ftp', 'sftp'];

function parseJson(value, fallback = {}) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeType(value) {
  return TYPES.includes(String(value)) ? String(value) : 'local';
}

function defaultConfig(type) {
  if (type === 'local') return { basePath: path.resolve(process.cwd(), 'data/uploads') };
  if (type === 'tencent_cos') return { bucket: '', region: 'ap-guangzhou', secretId: '', secretKey: '', prefix: 'data/uploads', publicDomain: '' };
  if (type === 'aliyun_oss') return { bucket: '', region: '', endpoint: '', accessKeyId: '', accessKeySecret: '', prefix: 'data/uploads', publicDomain: '' };
  if (type === 'ftp') return { host: '', port: 21, username: '', password: '', rootDir: '/', publicDomain: '', urlQueries: '', secure: false, passive: true };
  if (type === 'sftp') return { host: '', port: 22, username: '', password: '', privateKey: '', passphrase: '', rootDir: '/', publicDomain: '', urlQueries: '', useProxy: false, proxyUrl: '' };
  return {};
}

function normalizeConfig(type, input) {
  const merged = { ...defaultConfig(type), ...parseJson(input, {}) };
  if (type === 'local' && !String(merged.basePath || '').trim()) {
    merged.basePath = defaultConfig('local').basePath;
  }
  if (['tencent_cos', 'aliyun_oss', 'ftp', 'sftp'].includes(type)) {
    merged.prefix = String(merged.prefix || 'data/uploads').replace(/^\/+|\/+$/g, '') || 'data/uploads';
  }
  return merged;
}

function typeLabel(type) {
  return {
    local: '本地',
    tencent_cos: '腾讯云 COS',
    aliyun_oss: '阿里云 OSS',
    ftp: 'FTP',
    sftp: 'SFTP'
  }[type] || type;
}

function withTimeout(promise, timeoutMs = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('连接检测超时')), timeoutMs))
  ]);
}

function tcpCheck(host, port, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port: Number(port), timeout: timeoutMs });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error('连接超时'));
    });
    socket.once('error', reject);
  });
}

async function httpHeadCheck(url) {
  const response = await withTimeout(fetch(url, { method: 'HEAD' }));
  if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
  return true;
}

function normalizeHttpUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

async function checkStrategyStatus(strategy) {
  const type = normalizeType(strategy.type);
  const cfg = parseJson(strategy.config, defaultConfig(type));
  try {
    if (type === 'local') {
      const basePath = String(cfg.basePath || defaultConfig('local').basePath).trim();
      if (!path.isAbsolute(basePath)) throw new Error('本地路径必须是绝对路径');
      await fs.mkdir(basePath, { recursive: true });
      await fs.access(basePath, fsConstants.R_OK | fsConstants.W_OK);
      return { id: strategy.id, status: 'normal', message: '本地路径可读写' };
    }

    if (type === 'ftp' || type === 'sftp') {
      if (!cfg.host) throw new Error('未配置主机地址');
      await tcpCheck(cfg.host, cfg.port || (type === 'ftp' ? 21 : 22));
      return { id: strategy.id, status: 'normal', message: '端口可连接' };
    }

    if (type === 'tencent_cos') {
      if (cfg.publicDomain) {
        await httpHeadCheck(normalizeHttpUrl(cfg.publicDomain));
      } else {
        if (!cfg.bucket || !cfg.region) throw new Error('未配置 Bucket 或 Region');
        await httpHeadCheck(`https://${cfg.bucket}.cos.${cfg.region}.myqcloud.com`);
      }
      return { id: strategy.id, status: 'normal', message: 'COS 端点可达' };
    }

    if (type === 'aliyun_oss') {
      if (cfg.publicDomain) {
        await httpHeadCheck(normalizeHttpUrl(cfg.publicDomain));
      } else {
        if (!cfg.bucket || !cfg.endpoint) throw new Error('未配置 Bucket 或 Endpoint');
        const endpoint = normalizeHttpUrl(String(cfg.endpoint).replace(/^https?:\/\//, ''));
        const endpointUrl = new URL(endpoint);
        await httpHeadCheck(`${endpointUrl.protocol}//${cfg.bucket}.${endpointUrl.host}`);
      }
      return { id: strategy.id, status: 'normal', message: 'OSS 端点可达' };
    }

    return { id: strategy.id, status: 'abnormal', message: '未知挂载类型' };
  } catch (err) {
    return { id: strategy.id, status: 'abnormal', message: err.message || '连接异常' };
  }
}

function serialize(row = {}) {
  return {
    ...row,
    type_label: typeLabel(row.type),
    is_system_default: !!row.is_system_default,
    config: parseJson(row.config, defaultConfig(row.type)),
    image_count: Number(row.image_count || 0),
    used_storage: Number(row.used_storage || 0)
  };
}

router.get('/', async (req, res, next) => {
  try {
    const imageUsage = db('images')
      .select('storage_strategy_id')
      .count({ image_count: 'id' })
      .sum({ used_storage: 'size_bytes' })
      .groupBy('storage_strategy_id')
      .as('iu');
    const strategies = await db('storage_strategies as s')
      .leftJoin('user_groups as g', 'g.id', 's.user_group_id')
      .leftJoin(imageUsage, 'iu.storage_strategy_id', 's.id')
      .select('s.*', 'g.name as group_name', db.raw('COALESCE(iu.image_count, 0) as image_count'), db.raw('COALESCE(iu.used_storage, 0) as used_storage'))
      .orderBy('s.is_system_default', 'desc')
      .orderBy('s.id', 'asc');
    res.json({ strategies: strategies.map(serialize) });
  } catch (err) { next(err); }
});

router.get('/status', async (req, res, next) => {
  try {
    const strategies = await db('storage_strategies').select('*').orderBy('id', 'asc');
    const statuses = await Promise.all(strategies.map(checkStrategyStatus));
    res.json({ statuses });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const strategy = await db('storage_strategies as s')
      .leftJoin('user_groups as g', 'g.id', 's.user_group_id')
      .where('s.id', req.params.id)
      .select('s.*', 'g.name as group_name')
      .first();
    if (!strategy) return res.status(404).json({ error: '存储策略不存在' });
    const [{ image_count: imageCount, used_storage: usedStorage }] = await db('images')
      .where({ storage_strategy_id: strategy.id })
      .count({ image_count: 'id' })
      .sum({ used_storage: 'size_bytes' });
    res.json(serialize({ ...strategy, image_count: imageCount, used_storage: usedStorage }));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const type = normalizeType(req.body.type);
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: '策略名称不能为空' });
    const [id] = await db('storage_strategies').insert({
      name,
      description: String(req.body.description || '').trim() || null,
      type,
      user_group_id: req.body.user_group_id ? Number(req.body.user_group_id) : null,
      is_system_default: 0,
      config: JSON.stringify(normalizeConfig(type, req.body.config))
    });
    const saved = await db('storage_strategies').where({ id }).first();
    res.json(serialize(saved));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await db('storage_strategies').where({ id: req.params.id }).first();
    if (!existing) return res.status(404).json({ error: '存储策略不存在' });
    const requestedType = normalizeType(req.body.type || existing.type);
    if (requestedType !== existing.type) return res.status(400).json({ error: '已创建的存储策略不能更改挂载方式，请新建策略' });
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: '策略名称不能为空' });
    await db('storage_strategies').where({ id: existing.id }).update({
      name,
      description: String(req.body.description || '').trim() || null,
      user_group_id: req.body.user_group_id ? Number(req.body.user_group_id) : null,
      config: JSON.stringify(normalizeConfig(existing.type, req.body.config)),
      updated_at: db.fn.now()
    });
    const saved = await db('storage_strategies').where({ id: existing.id }).first();
    res.json(serialize(saved));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await db('storage_strategies').where({ id: req.params.id }).first();
    if (!existing) return res.status(404).json({ error: '存储策略不存在' });
    if (existing.is_system_default) return res.status(400).json({ error: '默认本地策略不能删除' });
    const deleted = await db.transaction(async trx => {
      const imageIds = (await trx('images').where({ storage_strategy_id: existing.id }).select('id')).map(row => row.id);
      if (imageIds.length > 0) {
        await trx('image_tags').whereIn('image_id', imageIds).del();
        await trx('images').whereIn('id', imageIds).del();
      }
      await trx('storage_strategies').where({ id: existing.id }).del();
      return imageIds.length;
    });
    res.json({ message: '存储策略已删除', deletedImages: deleted });
  } catch (err) { next(err); }
});

export default router;
