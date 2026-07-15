import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import db from '../db/index.js';
import config from '../config/index.js';
import logger from '../config/logger.js';

const DEFAULT_NSFW_CONFIG = {
  nsfwjs: { endpoint: '', thresholds: { Drawing: 100, Hentai: 60, Neutral: 100, Porn: 40, Sexy: 70 } },
  tencent_ims: { endpoint: '', secretId: '', secretKey: '', region: 'ap-guangzhou' }
};

let scanTimer = null;
let scanRunning = false;

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizePredictions(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.predictions)) return payload.predictions;
  if (Array.isArray(payload?.classes)) return payload.classes;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function evaluateNsfwjs(payload, thresholds = {}) {
  const predictions = normalizePredictions(payload);
  const detail = predictions.map((item) => {
    const className = item.className || item.class || item.label || item.name;
    const probability = Number(item.probability ?? item.score ?? item.value ?? 0);
    return { className, probability };
  }).filter(item => item.className);

  const matched = detail.find((item) => {
    const threshold = Number(thresholds[item.className] ?? 100);
    if (!Number.isFinite(threshold) || threshold >= 100) return false;
    return item.probability * 100 >= threshold;
  });

  return { nsfw: !!matched, detail: { engine: 'nsfwjs', matched: matched || null, predictions: detail } };
}

function evaluateTencentIms(payload) {
  const response = payload?.Response || payload || {};
  const suggestion = String(response.Suggestion || response.suggestion || '').toLowerCase();
  const labelResults = response.LabelResults || response.LabelResult || response.Labels || [];
  const nsfw = suggestion === 'block' || suggestion === 'review' || labelResults.some((item) => {
    const score = Number(item.Score ?? item.score ?? 0);
    const suggestionValue = String(item.Suggestion || item.suggestion || '').toLowerCase();
    return suggestionValue === 'block' || suggestionValue === 'review' || score >= 80;
  });
  return { nsfw, detail: { engine: 'tencent_ims', suggestion, response } };
}

async function callNsfwjs(image, groupConfig) {
  const endpoint = String(groupConfig?.nsfwjs?.endpoint || '').trim();
  if (!endpoint) return { skipped: true, reason: 'nsfwjs_endpoint_empty' };

  const fullPath = path.resolve(config.projectRoot, image.path);
  const buffer = await fs.promises.readFile(fullPath);
  const formData = new FormData();
  formData.append('image', new Blob([buffer], { type: image.mime_type || 'application/octet-stream' }), image.filename || 'image');

  const response = await fetch(endpoint, { method: 'POST', body: formData });
  if (!response.ok) throw new Error(`nsfw.js 接口返回 HTTP ${response.status}`);
  const payload = await response.json();
  return evaluateNsfwjs(payload, groupConfig?.nsfwjs?.thresholds || DEFAULT_NSFW_CONFIG.nsfwjs.thresholds);
}

async function callTencentIms(image, groupConfig) {
  const settings = groupConfig?.tencent_ims || {};
  const secretId = String(settings.secretId || '').trim();
  const secretKey = String(settings.secretKey || '').trim();
  const region = String(settings.region || 'ap-guangzhou').trim();
  const endpoint = String(settings.endpoint || 'ims.tencentcloudapi.com').replace(/^https?:\/\//, '').trim() || 'ims.tencentcloudapi.com';
  if (!secretId || !secretKey) return { skipped: true, reason: 'tencent_ims_secret_empty' };

  const service = 'ims';
  const action = 'ImageModeration';
  const version = '2020-12-29';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const fullPath = path.resolve(config.projectRoot, image.path);
  const fileContent = await fs.promises.readFile(fullPath, 'base64');
  const payload = JSON.stringify({ FileContent: fileContent });
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${endpoint}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256(payload)}`;
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256(canonicalRequest)}`;
  const secretDate = hmac(`TC3${secretKey}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, 'tc3_request');
  const signature = hmac(secretSigning, stringToSign, 'hex');
  const authorization = `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`https://${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json; charset=utf-8',
      Host: endpoint,
      'X-TC-Action': action,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Version': version,
      'X-TC-Region': region
    },
    body: payload
  });
  if (!response.ok) throw new Error(`腾讯云 IMS 返回 HTTP ${response.status}`);
  const result = await response.json();
  return evaluateTencentIms(result);
}

async function getImageGroup(image) {
  if (!image?.uploader_id) return db('user_groups').where({ is_default: true }).first();
  const user = await db('users').where({ id: image.uploader_id }).select('user_group_id').first();
  if (user?.user_group_id) {
    const group = await db('user_groups').where({ id: user.user_group_id }).first();
    if (group) return group;
  }
  return db('user_groups').where({ is_default: true }).first();
}

async function reviewImage(imageId, options = {}) {
  const image = await db('images').where({ id: imageId }).first();
  if (!image) return { ok: false, skipped: true, reason: 'image_not_found' };
  if (!options.force && image.nsfw_status !== null && image.nsfw_status !== undefined) {
    return { ok: true, skipped: true, reason: 'already_checked', nsfw: !!image.nsfw_status };
  }

  const group = await getImageGroup(image);
  if (!group?.image_review_enabled) {
    await db('images').where({ id: image.id }).update({ nsfw_status: false, nsfw_checked_at: db.fn.now(), nsfw_engine: null, nsfw_detail: JSON.stringify({ skipped: true, reason: 'review_disabled' }) });
    return { ok: true, skipped: true, reason: 'review_disabled', nsfw: false };
  }

  const nsfwConfig = parseJson(group.nsfw_config, DEFAULT_NSFW_CONFIG);
  const engine = group.nsfw_engine === 'tencent_ims' ? 'tencent_ims' : 'nsfwjs';
  const result = engine === 'tencent_ims'
    ? await callTencentIms(image, nsfwConfig)
    : await callNsfwjs(image, nsfwConfig);

  const nsfw = result.skipped ? false : !!result.nsfw;
  await db('images').where({ id: image.id }).update({
    nsfw_status: nsfw,
    nsfw_checked_at: db.fn.now(),
    nsfw_engine: engine,
    nsfw_detail: JSON.stringify(result.detail || { skipped: true, reason: result.reason })
  });
  return { ok: true, ...result, nsfw };
}

async function scanPendingImages(limit = 20) {
  if (scanRunning) return { skipped: true, reason: 'scan_running' };
  scanRunning = true;
  try {
    const enabledGroups = await db('user_groups').where({ image_review_enabled: 1 }).select('id', 'is_default');
    if (enabledGroups.length === 0) return { checked: 0 };
    const enabledGroupIds = enabledGroups.map(group => group.id);
    const defaultReviewEnabled = enabledGroups.some(group => group.is_default === true || group.is_default === 1);
    const images = await db('images as i')
      .leftJoin('users as u', 'u.id', 'i.uploader_id')
      .whereNull('i.nsfw_status')
      .where((builder) => {
        builder.whereIn('u.user_group_id', enabledGroupIds);
        if (defaultReviewEnabled) {
          builder.orWhereNull('i.uploader_id').orWhereNull('u.user_group_id');
        }
      })
      .select('i.id')
      .groupBy('i.id')
      .limit(limit);

    let checked = 0;
    for (const image of images) {
      try {
        await reviewImage(image.id);
        checked++;
      } catch (err) {
        logger.warn(`NSFW 定时审核失败: image=${image.id} - ${err.message}`);
      }
    }
    return { checked };
  } finally {
    scanRunning = false;
  }
}

function startScheduler(intervalMs = 5 * 60 * 1000) {
  if (scanTimer) return;
  scanTimer = setInterval(() => {
    scanPendingImages().catch((err) => logger.warn(`NSFW 定时扫描异常: ${err.message}`));
  }, intervalMs);
  scanTimer.unref?.();
  logger.info(`NSFW 定时审核已启用，间隔 ${Math.round(intervalMs / 1000)} 秒`);
}

export default {
  reviewImage,
  scanPendingImages,
  startScheduler
};
