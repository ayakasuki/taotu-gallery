import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import db from '../db/index.js';
import config from '../config/index.js';
import logger from '../config/logger.js';

const DEFAULT_NSFW_CONFIG = {
  nsfwjs: { endpoint: '', thresholds: { Drawing: 100, Hentai: 60, Neutral: 100, Porn: 40, Sexy: 70 } },
  tencent_ims: { endpoint: '', secretId: '', secretKey: '', region: 'ap-guangzhou' }
};
const REQUEST_TIMEOUT_MS = 20000;
const NSFW_CLASS_ALIASES = {
  drawing: 'Drawing',
  drawings: 'Drawing',
  hentai: 'Hentai',
  neutral: 'Neutral',
  porn: 'Porn',
  pornography: 'Porn',
  sexy: 'Sexy'
};

let scanTimer = null;
let scanRunning = false;
let testImageBufferPromise = null;
const activeReviews = new Map();

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeConfig(value) {
  const parsed = parseJson(value, {});
  return {
    nsfwjs: {
      ...DEFAULT_NSFW_CONFIG.nsfwjs,
      ...(parsed.nsfwjs || {}),
      thresholds: {
        ...DEFAULT_NSFW_CONFIG.nsfwjs.thresholds,
        ...(parsed.nsfwjs?.thresholds || {})
      }
    },
    tencent_ims: {
      ...DEFAULT_NSFW_CONFIG.tencent_ims,
      ...(parsed.tencent_ims || {})
    }
  };
}

function createServiceError(message, cause = null) {
  if (cause?.code === 'NSFW_SERVICE_UNAVAILABLE') return cause;
  const detail = String(message || cause?.message || '审核服务未返回有效结果').trim();
  const error = new Error(`NSFW 接口验证失败，不予上传，请联系管理员：${detail}`);
  error.code = 'NSFW_SERVICE_UNAVAILABLE';
  error.statusCode = 503;
  if (cause) error.cause = cause;
  return error;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`连接超时（${REQUEST_TIMEOUT_MS / 1000} 秒）`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonResponse(response, engineName) {
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`${engineName} 返回 HTTP ${response.status}${responseText ? `：${responseText.slice(0, 180)}` : ''}`);
  }
  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`${engineName} 未返回有效 JSON`);
  }
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function getTestImageBuffer() {
  if (!testImageBufferPromise) {
    testImageBufferPromise = sharp({
      create: {
        width: 299,
        height: 299,
        channels: 3,
        background: { r: 245, g: 247, b: 252 }
      }
    }).jpeg({ quality: 88 }).toBuffer();
  }
  return testImageBufferPromise;
}

function normalizeClassName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const compact = raw.toLowerCase().replace(/[\s_-]+/g, '');
  return NSFW_CLASS_ALIASES[compact] || raw.charAt(0).toUpperCase() + raw.slice(1);
}

function normalizeProbability(value) {
  const probability = Number(value);
  if (!Number.isFinite(probability) || probability < 0) return null;
  if (probability <= 1) return probability;
  if (probability <= 100) return probability / 100;
  return null;
}

function normalizePredictions(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.predictions)) return payload.predictions;
  if (Array.isArray(payload?.classes)) return payload.classes;
  if (Array.isArray(payload?.result)) return payload.result;
  const source = payload?.data && typeof payload.data === 'object' ? payload.data : payload;
  if (source && typeof source === 'object') {
    const entries = Object.entries(source)
      .filter(([key, value]) => NSFW_CLASS_ALIASES[String(key || '').toLowerCase().replace(/[\s_-]+/g, '')] && Number.isFinite(Number(value)))
      .map(([key, value]) => ({ className: key, probability: value }));
    if (entries.length > 0) return entries;
  }
  return [];
}

function evaluateNsfwjs(payload, thresholds = {}) {
  const predictions = normalizePredictions(payload);
  const detail = predictions.map((item) => {
    const className = normalizeClassName(item.className || item.class || item.label || item.name);
    const probability = normalizeProbability(item.probability ?? item.score ?? item.value);
    return { className, probability };
  }).filter(item => item.className && item.probability !== null);

  if (detail.length === 0) {
    throw new Error('nsfw.js 返回中缺少 predictions 检测结果');
  }

  const matched = detail.find((item) => {
    const threshold = Number(thresholds[item.className] ?? thresholds[item.className.toLowerCase()] ?? 100);
    if (!Number.isFinite(threshold) || threshold >= 100) return false;
    return item.probability * 100 >= Math.max(0, threshold);
  });

  return {
    nsfw: !!matched,
    detail: { engine: 'nsfwjs', matched: matched || null, predictions: detail }
  };
}

function evaluateTencentIms(payload) {
  const response = payload?.Response || payload || {};
  if (response.Error) {
    throw new Error(`腾讯云 IMS ${response.Error.Code || 'Error'}：${response.Error.Message || '请求失败'}`);
  }
  const suggestion = String(response.Suggestion || response.suggestion || '').toLowerCase();
  if (!['pass', 'review', 'block'].includes(suggestion)) {
    throw new Error('腾讯云 IMS 返回中缺少有效 Suggestion');
  }
  const labelResults = response.LabelResults || response.LabelResult || response.Labels || [];
  const nsfw = suggestion === 'block' || suggestion === 'review' || labelResults.some((item) => {
    const score = Number(item.Score ?? item.score ?? 0);
    const suggestionValue = String(item.Suggestion || item.suggestion || '').toLowerCase();
    return suggestionValue === 'block' || suggestionValue === 'review' || score >= 80;
  });
  return { nsfw, detail: { engine: 'tencent_ims', suggestion, response } };
}

function normalizeEndpoint(value, fallback = '') {
  const endpoint = String(value || fallback).trim();
  if (!endpoint) return '';
  if (!/^https?:\/\//i.test(endpoint)) return `https://${endpoint}`;
  return endpoint;
}

async function callNsfwjsBuffer(buffer, mimeType, filename, groupConfig) {
  const endpoint = normalizeEndpoint(groupConfig?.nsfwjs?.endpoint);
  if (!endpoint) throw new Error('未配置 nsfw.js 接口地址');
  try {
    new URL(endpoint);
  } catch {
    throw new Error('nsfw.js 接口地址格式无效');
  }

  const formData = new FormData();
  formData.append('image', new Blob([buffer], { type: mimeType || 'application/octet-stream' }), filename || 'image');
  const response = await fetchWithTimeout(endpoint, { method: 'POST', body: formData });
  const payload = await readJsonResponse(response, 'nsfw.js 接口');
  return evaluateNsfwjs(payload, groupConfig?.nsfwjs?.thresholds || DEFAULT_NSFW_CONFIG.nsfwjs.thresholds);
}

async function callNsfwjs(image, groupConfig) {
  const fullPath = path.resolve(config.projectRoot, image.path);
  const buffer = await fs.promises.readFile(fullPath);
  return callNsfwjsBuffer(buffer, image.mime_type, image.filename, groupConfig);
}

async function callTencentImsBuffer(buffer, groupConfig) {
  const settings = groupConfig?.tencent_ims || {};
  const secretId = String(settings.secretId || '').trim();
  const secretKey = String(settings.secretKey || '').trim();
  const region = String(settings.region || 'ap-guangzhou').trim();
  const endpointUrl = normalizeEndpoint(settings.endpoint, 'ims.tencentcloudapi.com');
  const endpoint = new URL(endpointUrl).host;
  if (!secretId || !secretKey) throw new Error('腾讯云 IMS SecretId 或 SecretKey 未配置');
  if (!region) throw new Error('腾讯云 IMS 地域未配置');

  const service = 'ims';
  const action = 'ImageModeration';
  const version = '2020-12-29';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const payload = JSON.stringify({ FileContent: buffer.toString('base64') });
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

  const response = await fetchWithTimeout(endpointUrl, {
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
  const result = await readJsonResponse(response, '腾讯云 IMS');
  return evaluateTencentIms(result);
}

async function callTencentIms(image, groupConfig) {
  const fullPath = path.resolve(config.projectRoot, image.path);
  const fileContent = await fs.promises.readFile(fullPath);
  return callTencentImsBuffer(fileContent, groupConfig);
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

async function validateConfiguration(group) {
  if (!group?.image_review_enabled) return { ok: true, disabled: true };
  const groupConfig = normalizeConfig(group.nsfw_config);
  const engine = group.nsfw_engine === 'tencent_ims' ? 'tencent_ims' : 'nsfwjs';
  try {
    const testImageBuffer = await getTestImageBuffer();
    const result = engine === 'tencent_ims'
      ? await callTencentImsBuffer(testImageBuffer, groupConfig)
      : await callNsfwjsBuffer(testImageBuffer, 'image/jpeg', 'taotu-nsfw-healthcheck.jpg', groupConfig);
    return { ok: true, engine, nsfw: result.nsfw, detail: result.detail };
  } catch (error) {
    throw createServiceError(error.message, error);
  }
}

async function performReview(imageId, options = {}) {
  const image = await db('images').where({ id: imageId }).first();
  if (!image) throw new Error('待审核图片不存在');
  if (!options.force && image.nsfw_status !== null && image.nsfw_status !== undefined) {
    return {
      ok: true,
      status: image.nsfw_status ? 'unsafe' : 'safe',
      reason: 'already_checked',
      nsfw: !!image.nsfw_status,
      engine: image.nsfw_engine || null
    };
  }

  const group = await getImageGroup(image);
  if (!group?.image_review_enabled) {
    await db('images').where({ id: image.id }).update({
      nsfw_status: false,
      nsfw_checked_at: db.fn.now(),
      nsfw_engine: null,
      nsfw_detail: JSON.stringify({ disabled: true, reason: 'review_disabled' })
    });
    return { ok: true, status: 'disabled', disabled: true, nsfw: false, engine: null };
  }

  const groupConfig = normalizeConfig(group.nsfw_config);
  const engine = group.nsfw_engine === 'tencent_ims' ? 'tencent_ims' : 'nsfwjs';
  try {
    const result = engine === 'tencent_ims'
      ? await callTencentIms(image, groupConfig)
      : await callNsfwjs(image, groupConfig);
    if (typeof result.nsfw !== 'boolean') throw new Error('审核服务未返回明确的安全状态');

    await db('images').where({ id: image.id }).update({
      nsfw_status: result.nsfw,
      nsfw_checked_at: db.fn.now(),
      nsfw_engine: engine,
      nsfw_detail: JSON.stringify(result.detail)
    });
    return {
      ok: true,
      status: result.nsfw ? 'unsafe' : 'safe',
      nsfw: result.nsfw,
      engine,
      detail: result.detail
    };
  } catch (error) {
    await db('images').where({ id: image.id }).update({
      nsfw_status: null,
      nsfw_checked_at: db.fn.now(),
      nsfw_engine: engine,
      nsfw_detail: JSON.stringify({ failed: true, reason: error.message })
    });
    throw createServiceError(error.message, error);
  }
}

async function reviewImage(imageId, options = {}) {
  if (activeReviews.has(imageId)) return activeReviews.get(imageId);
  const reviewPromise = performReview(imageId, options).finally(() => activeReviews.delete(imageId));
  activeReviews.set(imageId, reviewPromise);
  return reviewPromise;
}

async function getGroupPendingImageIds(groupId) {
  const group = await db('user_groups').where({ id: groupId }).select('id', 'is_default').first();
  if (!group) return [];
  return db('images as i')
    .leftJoin('users as u', 'u.id', 'i.uploader_id')
    .where((builder) => {
      builder.where('u.user_group_id', group.id);
      if (group.is_default) builder.orWhereNull('u.user_group_id');
    })
    .whereNotNull('i.uploader_id')
    .select('i.id')
    .groupBy('i.id')
    .orderBy('i.id', 'asc');
}

async function reviewQueuedImages(imageIds, groupId) {
  let checked = 0;
  let failed = 0;
  for (const { id } of imageIds) {
    try {
      await reviewImage(id);
      checked++;
    } catch (error) {
      failed++;
      logger.warn(`用户组 ${groupId} NSFW 补审失败: image=${id} - ${error.message}`);
    }
  }
  logger.info(`用户组 ${groupId} NSFW 补审完成: 成功 ${checked}，待重试 ${failed}`);
  return { checked, failed };
}

async function queueGroupImagesForReview(groupId) {
  const imageIds = await getGroupPendingImageIds(groupId);
  if (imageIds.length === 0) return { queued: 0 };
  const ids = imageIds.map(image => image.id);
  await db('images').whereIn('id', ids).update({
    nsfw_status: null,
    nsfw_checked_at: null,
    nsfw_engine: null,
    nsfw_detail: JSON.stringify({ queued: true, reason: 'group_review_enabled_or_changed' })
  });
  setTimeout(() => {
    reviewQueuedImages(imageIds, groupId).catch(error => {
      logger.warn(`用户组 ${groupId} NSFW 补审任务异常: ${error.message}`);
    });
  }, 0);
  return { queued: ids.length };
}

async function scanPendingImages(limit = 20) {
  if (scanRunning) return { skipped: true, reason: 'scan_running' };
  scanRunning = true;
  try {
    const enabledGroups = await db('user_groups').where({ image_review_enabled: 1 }).select('id', 'is_default');
    if (enabledGroups.length === 0) return { checked: 0, failed: 0 };
    const enabledGroupIds = enabledGroups.map(group => group.id);
    const defaultReviewEnabled = enabledGroups.some(group => group.is_default === true || group.is_default === 1);
    const images = await db('images as i')
      .leftJoin('users as u', 'u.id', 'i.uploader_id')
      .whereNull('i.nsfw_status')
      .where((builder) => {
        builder.whereIn('u.user_group_id', enabledGroupIds);
        if (defaultReviewEnabled) builder.orWhereNull('u.user_group_id');
      })
      .select('i.id')
      .groupBy('i.id')
      .limit(limit);

    let checked = 0;
    let failed = 0;
    for (const image of images) {
      try {
        await reviewImage(image.id);
        checked++;
      } catch (error) {
        failed++;
        logger.warn(`NSFW 定时审核失败: image=${image.id} - ${error.message}`);
      }
    }
    return { checked, failed };
  } finally {
    scanRunning = false;
  }
}

function startScheduler(intervalMs = 5 * 60 * 1000) {
  if (scanTimer) return;
  const runScan = () => scanPendingImages().catch(error => logger.warn(`NSFW 定时扫描异常: ${error.message}`));
  setTimeout(runScan, 1000).unref?.();
  scanTimer = setInterval(runScan, intervalMs);
  scanTimer.unref?.();
  logger.info(`NSFW 定时审核已启用，间隔 ${Math.round(intervalMs / 1000)} 秒`);
}

export default {
  validateConfiguration,
  reviewImage,
  queueGroupImagesForReview,
  scanPendingImages,
  startScheduler
};
