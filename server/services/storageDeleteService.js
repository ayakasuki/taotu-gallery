import path from 'path';
import { promises as fs } from 'fs';
import db from '../db/index.js';
import config from '../config/index.js';
import configService from './configService.js';
import imageProcessor from '../utils/imageProcessor.js';
import pathUtils from '../utils/pathUtils.js';
import logger from '../config/logger.js';

function parseJson(value, fallback = {}) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeSlash(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\/+/g, '/');
}

function normalizeFsPath(value) {
  return normalizeSlash(pathUtils.toAbsolutePath(value || ''));
}

function isSameOrChild(targetPath, parentPath) {
  const target = normalizeFsPath(targetPath);
  const parent = normalizeFsPath(parentPath).replace(/\/+$/, '');
  return target === parent || target.startsWith(`${parent}/`);
}

function toObjectKey(imagePath, cfg = {}) {
  let key = String(imagePath || '').trim();
  if (/^https?:\/\//i.test(key)) {
    try {
      key = decodeURIComponent(new URL(key).pathname);
    } catch {}
  }
  key = key.replace(/^\/+/, '').replace(/\\/g, '/').split('?')[0];
  const prefix = String(cfg.prefix || '').replace(/^\/+|\/+$/g, '');
  if (prefix && !key.startsWith(`${prefix}/`) && !key.startsWith(prefix)) {
    key = `${prefix}/${key}`;
  }
  return key;
}

async function resolveCustomPathPolicy(image) {
  if (image.upload_source !== 'local') return { isCustomPath: false, allowDelete: false };
  const pathsConfig = await configService.readPaths();
  const matched = (pathsConfig.customPaths || []).find(pathEntry => pathEntry.path && isSameOrChild(image.path, pathEntry.path));
  return {
    isCustomPath: !!matched,
    allowDelete: !!matched?.allowDelete,
    pathEntry: matched || null
  };
}

async function deleteLocalFiles(image, options = {}) {
  const realPath = path.resolve(config.projectRoot, image.path);
  const customPolicy = options.customPolicy || await resolveCustomPathPolicy(image);
  const shouldDeleteOriginal = image.upload_source === 'upload'
    || image.upload_source === 'api'
    || (customPolicy.isCustomPath && customPolicy.allowDelete);

  if (shouldDeleteOriginal) {
    await fs.unlink(realPath).catch(err => {
      if (err.code !== 'ENOENT') throw err;
    });
    for (const thumbPath of imageProcessor.getExistingThumbnailPath(realPath, 'thumb')) {
      await fs.unlink(thumbPath).catch(() => {});
    }
    for (const mediumPath of imageProcessor.getExistingThumbnailPath(realPath, 'medium')) {
      await fs.unlink(mediumPath).catch(() => {});
    }
  }
  await imageProcessor.removeDerivedThumbnailsForImage(realPath).catch(() => {});

  return {
    deletedOriginal: shouldDeleteOriginal,
    skippedOriginal: !shouldDeleteOriginal,
    reason: customPolicy.isCustomPath && !customPolicy.allowDelete ? 'custom_path_delete_disabled' : null
  };
}

async function deleteTencentCos(image, cfg) {
  const mod = await import('cos-nodejs-sdk-v5');
  const COS = mod.default || mod;
  const cos = new COS({ SecretId: cfg.secretId, SecretKey: cfg.secretKey });
  const Key = toObjectKey(image.path, cfg);
  await new Promise((resolve, reject) => {
    cos.deleteObject({ Bucket: cfg.bucket, Region: cfg.region, Key }, (err, data) => err ? reject(err) : resolve(data));
  });
  return { deletedOriginal: true, key: Key };
}

async function deleteAliyunOss(image, cfg) {
  const mod = await import('ali-oss');
  const OSS = mod.default || mod;
  const client = new OSS({
    region: cfg.region || undefined,
    endpoint: cfg.endpoint || undefined,
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
    bucket: cfg.bucket
  });
  const key = toObjectKey(image.path, cfg);
  await client.delete(key);
  return { deletedOriginal: true, key };
}

async function deleteFtp(image, cfg) {
  const { Client } = await import('basic-ftp');
  const client = new Client(10000);
  try {
    await client.access({
      host: cfg.host,
      port: Number(cfg.port || 21),
      user: cfg.username,
      password: cfg.password,
      secure: !!cfg.secure
    });
    const remotePath = path.posix.join(String(cfg.rootDir || '/'), toObjectKey(image.path, cfg));
    await client.remove(remotePath);
    return { deletedOriginal: true, key: remotePath };
  } finally {
    client.close();
  }
}

async function deleteSftp(image, cfg) {
  if (cfg.useProxy) throw new Error('当前 SFTP 删除暂不支持代理连接，请先关闭代理或手动清理远端文件');
  const mod = await import('ssh2-sftp-client');
  const SftpClient = mod.default || mod;
  const client = new SftpClient();
  try {
    await client.connect({
      host: cfg.host,
      port: Number(cfg.port || 22),
      username: cfg.username,
      password: cfg.password || undefined,
      privateKey: cfg.privateKey || undefined,
      passphrase: cfg.passphrase || undefined
    });
    const remotePath = path.posix.join(String(cfg.rootDir || '/'), toObjectKey(image.path, cfg));
    await client.delete(remotePath);
    return { deletedOriginal: true, key: remotePath };
  } finally {
    await client.end().catch(() => {});
  }
}

async function deletePhysicalObject(image) {
  const strategy = image.storage_strategy_id
    ? await db('storage_strategies').where({ id: image.storage_strategy_id }).first()
    : null;
  const type = strategy?.type || 'local';
  const cfg = parseJson(strategy?.config, {});

  if (type === 'local') return deleteLocalFiles(image);
  if (type === 'tencent_cos') return deleteTencentCos(image, cfg);
  if (type === 'aliyun_oss') return deleteAliyunOss(image, cfg);
  if (type === 'ftp') return deleteFtp(image, cfg);
  if (type === 'sftp') return deleteSftp(image, cfg);
  return { deletedOriginal: false, skippedOriginal: true, reason: 'unknown_strategy_type' };
}

async function deleteImageRecord(image, options = {}) {
  const physical = options.skipPhysical ? { skippedOriginal: true, reason: 'skip_physical' } : await deletePhysicalObject(image);
  await db.transaction(async trx => {
    await trx('image_tags').where({ image_id: image.id }).del();
    await trx('images').where({ id: image.id }).del();
  });
  logger.info(`图片已删除: ${image.filename} (ID:${image.id}, 策略:${image.storage_strategy_id || 'local'}, 删原图:${!!physical.deletedOriginal})`);
  return physical;
}

export default {
  deletePhysicalObject,
  deleteImageRecord,
  resolveCustomPathPolicy
};
