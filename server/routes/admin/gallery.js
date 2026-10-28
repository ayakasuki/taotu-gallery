import express from 'express';
import fs from 'fs';
import authMiddleware from '../../middleware/auth.js';
import configService from '../../services/configService.js';
import galleryWatcher from '../../services/galleryWatcher.js';
import db from '../../db/index.js';
import config from '../../config/index.js';
import pathUtils from '../../utils/pathUtils.js';
import albumService from '../../services/albumService.js';
import imageProcessor from '../../utils/imageProcessor.js';
import crypto from 'crypto';

const router = express.Router();
const scanState = globalThis.__taotuScanState || { jobs: new Map(), activeJobId: null };
globalThis.__taotuScanState = scanState;
const scanJobs = scanState.jobs;
const SCAN_JOB_TTL_MS = 30 * 60 * 1000;

function serializeScanJob(job) {
  return {
    jobId: job.id,
    path: job.path,
    status: job.status,
    total: job.total,
    processed: job.processed,
    added: job.added,
    skipped: job.skipped,
    percent: job.percent,
    startedAt: job.startedAt,
    lastHeartbeatAt: job.lastHeartbeatAt,
    lastClientHeartbeatAt: job.lastClientHeartbeatAt,
    pauseRequested: job.pauseRequested,
    cancelRequested: job.cancelRequested,
    result: job.result,
    error: job.error
  };
}

function createScanJob({ path: targetPath = null, task }) {
  const activeJob = scanState.activeJobId ? scanJobs.get(scanState.activeJobId) : null;
  if (activeJob && isActiveScanJob(activeJob)) return { job: activeJob, created: false };

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const job = {
    id,
    path: targetPath,
    status: 'queued',
    total: 0,
    processed: 0,
    added: 0,
    skipped: 0,
    percent: 0,
    startedAt: null,
    lastHeartbeatAt: now,
    lastClientHeartbeatAt: null,
    pauseRequested: false,
    cancelRequested: false,
    pathDeleted: false,
    result: null,
    error: null
  };
  scanJobs.set(id, job);
  scanState.activeJobId = id;
  Promise.resolve().then(async () => {
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    try {
      job.result = await task(job);
      if (job.cancelRequested) {
        const error = new Error(job.pathDeleted ? '路径已被删除，扫描已中断' : '扫描已终止');
        error.code = job.pathDeleted ? 'SCAN_PATH_DELETED' : 'SCAN_CANCELLED';
        throw error;
      }
      job.status = 'completed';
      job.percent = 100;
    } catch (error) {
      job.error = error.message || '扫描失败';
      job.status = error.code === 'SCAN_CANCELLED' ? 'cancelled' : 'failed';
      if (error.code === 'SCAN_PATH_DELETED' || job.pathDeleted) {
        job.status = 'failed';
        job.error = '路径已被删除，扫描已中断';
      }
    }
    job.lastHeartbeatAt = new Date().toISOString();
    if (scanState.activeJobId === id) scanState.activeJobId = null;
    setTimeout(() => scanJobs.delete(id), SCAN_JOB_TTL_MS);
  });
  return { job, created: true };
}

function updateScanJobProgress(job, progress = {}) {
  job.total = Number(progress.total ?? job.total ?? 0);
  job.processed = Number(progress.processed ?? job.processed ?? 0);
  job.added = Number(progress.added ?? job.added ?? 0);
  job.skipped = Number(progress.skipped ?? job.skipped ?? 0);
  job.percent = job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0;
  job.lastHeartbeatAt = new Date().toISOString();
}

function isActiveScanJob(job) {
  return ['queued', 'running', 'paused'].includes(job.status);
}

function normalizedScanPath(value) {
  return pathUtils.toCanonicalRelativePath(value).replace(/\/$/, '');
}

function findActiveScanForPath(targetPath) {
  const key = normalizedScanPath(targetPath);
  for (const job of scanJobs.values()) {
    if (isActiveScanJob(job) && job.path && normalizedScanPath(job.path) === key) {
      return serializeScanJob(job);
    }
  }
  return null;
}

function cancelScanJobsForPath(targetPath) {
  const key = normalizedScanPath(targetPath);
  for (const job of scanJobs.values()) {
    if (!job.path || normalizedScanPath(job.path) !== key || !isActiveScanJob(job)) continue;
    job.cancelRequested = true;
    job.pathDeleted = true;
    job.lastHeartbeatAt = new Date().toISOString();
  }
}

function createJobControl(job, targetPath, { checkConfiguredPath = false } = {}) {
  let lastPathCheck = 0;
  let pathExists = true;
  return {
    onProgress: progress => updateScanJobProgress(job, progress),
    shouldStop: async () => {
      if (job.cancelRequested) {
        if (job.pathDeleted) {
          const error = new Error('路径已被删除，扫描已中断');
          error.code = 'SCAN_PATH_DELETED';
          throw error;
        }
        return true;
      }
      const now = Date.now();
      if (checkConfiguredPath && now - lastPathCheck >= 10000) {
        lastPathCheck = now;
        pathExists = Boolean(await db('custom_paths').where({ path: targetPath }).first());
        if (!pathExists) {
          job.cancelRequested = true;
          job.pathDeleted = true;
          const error = new Error('路径已被删除，扫描已中断');
          error.code = 'SCAN_PATH_DELETED';
          throw error;
        }
      }
      return false;
    },
    waitIfPaused: async () => {
      while (job.pauseRequested && !job.cancelRequested) {
        job.status = 'paused';
        job.lastHeartbeatAt = new Date().toISOString();
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (!job.cancelRequested) job.status = 'running';
    }
  };
}

const normalizeDisplayMode = (mode) => mode === 'waterfall' ? 'waterfall' : 'grid';

function normalizePathForLike(filePath) {
  return pathUtils.normalizePath(pathUtils.toRelativePath(filePath || ''));
}

function withTrailingSlash(filePath) {
  const normalized = normalizePathForLike(filePath);
  return normalized.endsWith('/') ? normalized : `${normalized}/`;
}

async function getScanMetaForPath(filePath) {
  const normalized = withTrailingSlash(filePath);
  const row = await db('images')
    .where(function() {
      this.where('path', normalized.slice(0, -1)).orWhere('path', 'like', `${normalized}%`);
    })
    .max('created_at as last_scanned_at')
    .count('* as image_count')
    .first();

  return {
    last_scanned_at: row?.last_scanned_at || null,
    image_count: Number(row?.image_count || 0)
  };
}

async function getImagesForPath(filePath) {
  const normalized = normalizePathForLike(filePath);
  const prefix = withTrailingSlash(filePath);
  return db('images')
    .where(function() {
      this.where('path', normalized).orWhere('path', 'like', `${prefix}%`);
    })
    .select('id', 'path', 'album_id');
}

async function resolveAlbumForPath({ albumId, albumName, userId }) {
  if (albumId) return Number(albumId);
  const normalizedAlbumName = String(albumName || '').trim();
  if (!normalizedAlbumName) return null;
  const album = await albumService.createAlbum({ name: normalizedAlbumName, user_id: userId, is_public: false });
  return album.id;
}

async function resolvePathTagIds(tagIds = [], newTagNames = []) {
  const ids = (tagIds || []).map(id => Number(id)).filter(Number.isInteger);
  if (!newTagNames?.length) return [...new Set(ids)];
  const newIds = [];
  for (const rawName of newTagNames) {
    const name = String(rawName || '').trim();
    if (!name) continue;
    const existing = await db('tags').whereRaw('LOWER(name) = LOWER(?)', [name]).first();
    if (existing) {
      newIds.push(existing.id);
      continue;
    }
    const maxRow = await db('tags').max('id as maxId').first();
    const newId = Number(maxRow?.maxId || 0) + 1;
    await db('tags').insert({
      id: newId,
      name,
      display_name: name,
      combinable: true,
      is_public: true,
      tag_type: 'manual'
    });
    newIds.push(newId);
  }
  return [...new Set([...ids, ...newIds].map(id => Number(id)).filter(Number.isInteger))];
}

async function applyPathImageSettings({ oldPathEntry = {}, nextPathEntry = {}, userId }) {
  const images = await getImagesForPath(oldPathEntry.path);
  const imageIds = images.map(image => image.id);
  const oldTagIds = (oldPathEntry.tagIds || []).map(id => Number(id)).filter(Number.isInteger);
  const nextTagIds = await resolvePathTagIds(nextPathEntry.tagIds || [], nextPathEntry.newTagNames || []);
  const finalAlbumId = await resolveAlbumForPath({
    albumId: nextPathEntry.albumId || null,
    albumName: nextPathEntry.albumMode === 'new' ? nextPathEntry.albumName : null,
    userId
  });

  if (imageIds.length > 0) {
    await db('images').whereIn('id', imageIds).update({
      album_id: finalAlbumId,
      is_public: !!nextPathEntry.makePublic,
      updated_at: db.fn.now()
    });

    const removeTagIds = [...new Set([...oldTagIds, ...nextTagIds])];
    if (removeTagIds.length > 0) {
      await db('image_tags')
        .whereIn('image_id', imageIds)
        .whereIn('tag_id', removeTagIds)
        .whereNull('user_tag_id')
        .where('source', 'manual')
        .del();
    }
    for (const imageId of imageIds) {
      for (const tagId of nextTagIds) {
        await db('image_tags').insert({
          image_id: imageId,
          tag_id: tagId,
          source: 'manual'
        }).onConflict(['image_id', 'tag_id']).ignore();
      }
    }
  }

  const affectedAlbumIds = [...new Set([
    ...images.map(image => image.album_id).filter(Boolean),
    finalAlbumId
  ].filter(Boolean))];
  for (const albumId of affectedAlbumIds) {
    const [{ cnt }] = await db('images').where({ album_id: albumId }).count('* as cnt');
    await db('albums').where({ id: albumId }).update({ image_count: cnt });
  }

  return { imageCount: imageIds.length, albumId: finalAlbumId, tagIds: nextTagIds, newTagNames: [] };
}

function inferPathType(filePath, isDefault = false) {
  if (isDefault) return 'default';
  const value = String(filePath || '').toLowerCase();
  if (value.startsWith('smb://')) return 'smb';
  if (value.startsWith('s3://')) return 's3';
  if (value.startsWith('ftp://')) return 'ftp';
  return 'local';
}

function pathExists(filePath, isDefault = false) {
  if (!filePath) return false;
  if (/^(smb|s3|ftp):\/\//i.test(filePath)) return true;
  const absolute = isDefault ? filePath : pathUtils.toAbsolutePath(filePath);
  try {
    return fs.existsSync(absolute);
  } catch {
    return false;
  }
}

async function enrichPath(pathEntry, options = {}) {
  const isDefault = Boolean(options.default);
  const filePath = isDefault ? config.galleryDir : pathEntry.path;
  const scanMeta = await getScanMetaForPath(filePath);
  const exists = pathExists(filePath, isDefault);
  return {
    ...pathEntry,
    type: inferPathType(pathEntry.path, isDefault),
    status: exists ? 'normal' : 'warning',
    statusText: exists ? '正常' : '警告',
    last_scanned_at: pathEntry.last_scanned_at || scanMeta.last_scanned_at,
    image_count: scanMeta.image_count,
    activeScan: isDefault ? null : findActiveScanForPath(filePath)
  };
}

// 获取图库配置
router.get('/config', authMiddleware, async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    const pathsConfig = await configService.readPaths();
    const customPaths = await Promise.all((pathsConfig.customPaths || []).map(pathEntry => enrichPath(pathEntry)));
    const defaultPath = await enrichPath({
      path: 'data/gallery/',
      recursive: true,
      albumMode: 'public',
      albumName: '公共图库',
      tagIds: [],
      newTagNames: []
    }, { default: true });

    res.json({
      display: { ...(siteConfig.display || {}), mode: normalizeDisplayMode(siteConfig.display?.mode) },
      upload: siteConfig.upload || { showUrlAfterUpload: true },
      defaultPath,
      customPaths
    });
  } catch (err) {
    next(err);
  }
});

// 更新图库配置
router.put('/config', authMiddleware, async (req, res, next) => {
  try {
    const siteConfig = await configService.readSiteConfig();
    if (req.body.display) siteConfig.display = { ...req.body.display, mode: normalizeDisplayMode(req.body.display.mode) };
    if (req.body.upload) siteConfig.upload = req.body.upload;
    await configService.writeSiteConfig(siteConfig);

    // 更新自定义路径
    if (req.body.customPaths) {
      const currentPaths = await configService.readPaths();
      const nextPathKeys = new Set((req.body.customPaths || []).map(pathEntry => normalizedScanPath(pathEntry.path)));
      for (const pathEntry of currentPaths.customPaths || []) {
        if (!nextPathKeys.has(normalizedScanPath(pathEntry.path))) cancelScanJobsForPath(pathEntry.path);
      }
      await configService.writePaths({ galleryPaths: [], customPaths: req.body.customPaths });
    }

    res.json({ message: '图库配置已更新' });
  } catch (err) {
    next(err);
  }
});

// 立即扫描所有路径
router.post('/scan', authMiddleware, async (req, res, next) => {
  try {
    const { job, created } = createScanJob({
      path: null,
      task: job => galleryWatcher.scanAndIndexAll({ ...createJobControl(job, null) })
    });
    res.status(created ? 202 : 200).json({ ...serializeScanJob(job), attached: !created });
  } catch (err) {
    next(err);
  }
});

router.get('/scan-jobs', authMiddleware, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const jobs = [...scanJobs.values()]
    .filter(job => req.query.active === '1' ? isActiveScanJob(job) : true)
    .map(serializeScanJob);
  res.json({ jobs });
});

router.get('/scan-jobs/:id', authMiddleware, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const job = scanJobs.get(req.params.id);
  if (!job) {
    return res.json({
      jobId: req.params.id,
      status: 'failed',
      error: '后台扫描任务因服务进程重启而丢失，请重新发起扫描'
    });
  }
  res.json(serializeScanJob(job));
});

router.post('/scan-jobs/:id/heartbeat', authMiddleware, async (req, res) => {
  const job = scanJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: '扫描任务不存在或已过期' });
  job.lastClientHeartbeatAt = new Date().toISOString();
  res.json(serializeScanJob(job));
});

router.patch('/scan-jobs/:id', authMiddleware, async (req, res) => {
  const job = scanJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: '扫描任务不存在或已过期' });
  const action = String(req.body?.action || '').toLowerCase();
  if (!isActiveScanJob(job)) return res.status(409).json({ error: '扫描任务已结束', ...serializeScanJob(job) });
  if (action === 'pause') {
    job.pauseRequested = true;
  } else if (action === 'resume') {
    job.pauseRequested = false;
    if (job.status === 'paused') job.status = 'running';
  } else if (action === 'cancel') {
    job.cancelRequested = true;
  } else {
    return res.status(400).json({ error: '不支持的扫描操作' });
  }
  job.lastClientHeartbeatAt = new Date().toISOString();
  res.json(serializeScanJob(job));
});

// 扫描指定路径（支持指定相册和标签）
router.post('/scan-path', authMiddleware, async (req, res, next) => {
  try {
    const { path: targetPath, recursive, albumId, albumName, tagIds, newTags, makePublic, allowDelete } = req.body;
    if (!targetPath) return res.status(400).json({ error: '请提供路径' });

    const currentJob = scanState.activeJobId ? scanJobs.get(scanState.activeJobId) : null;
    if (currentJob && isActiveScanJob(currentJob)) {
      return res.status(200).json({ ...serializeScanJob(currentJob), attached: true });
    }

    let finalAlbumId = albumId || null;

    // 如果指定了新相册名，创建相册
    if (!finalAlbumId && albumName) {
      const album = await albumService.createAlbum({
        name: albumName,
        user_id: req.user.id,
        is_public: false
      });
      finalAlbumId = album.id;
    }

    const ignoreFilenameParts = Array.isArray(req.body.ignoreFilenameParts) ? req.body.ignoreFilenameParts : [];
    const initialPathsConfig = await configService.readPaths();
    const initialPaths = initialPathsConfig.customPaths || [];
    const existingPath = initialPaths.some(cp => cp.path === targetPath);
    const initialSavedPath = {
      path: targetPath,
      recursive: recursive !== false,
      albumMode: albumName ? 'new' : (finalAlbumId ? 'existing' : 'none'),
      albumId: finalAlbumId,
      albumName: albumName || null,
      makePublic: !!makePublic,
      allowDelete: !!allowDelete,
      ignoreFilenameParts,
      tagIds: tagIds || [],
      newTagNames: newTags || []
    };
    if (existingPath) {
      const index = initialPaths.findIndex(cp => cp.path === targetPath);
      initialPaths[index] = { ...initialPaths[index], ...initialSavedPath };
    } else {
      initialPaths.push(initialSavedPath);
    }
    await configService.writePaths({ galleryPaths: [], customPaths: initialPaths });
    const { job, created } = createScanJob({ path: targetPath, task: async (job) => {
      const control = createJobControl(job, targetPath, { checkConfiguredPath: true });
      const result = await galleryWatcher.scanSinglePath({
        targetPath,
        recursive: recursive !== false,
        albumId: finalAlbumId,
        tagIds: tagIds || [],
        newTags: newTags || [],
        userId: req.user.id,
        makePublic: !!makePublic,
        ignoreFilenameParts,
        onProgress: control.onProgress,
        shouldStop: control.shouldStop,
        waitIfPaused: control.waitIfPaused
      });

      await control.shouldStop();
      const savedPath = {
        recursive: recursive !== false,
        album_mode: albumName ? 'new' : (finalAlbumId ? 'existing' : 'none'),
        album_id: finalAlbumId,
        album_name: albumName || null,
        make_public: !!makePublic,
        allow_delete: !!allowDelete,
        ignore_filename_parts: JSON.stringify(ignoreFilenameParts),
        tag_ids: JSON.stringify(result.tagIds || tagIds || []),
        new_tag_names: JSON.stringify(result.newTagNames || [])
      };
      const updatedCount = await db('custom_paths').where({ path: targetPath }).update(savedPath);
      if (!updatedCount) {
        const error = new Error('路径已被删除，扫描已中断');
        error.code = 'SCAN_PATH_DELETED';
        throw error;
      }
      return { ...result, pathCount: 1 };
    }});

    res.status(created ? 202 : 200).json({ ...serializeScanJob(job), attached: !created });
  } catch (err) { next(err); }
});

router.post('/update-path', authMiddleware, async (req, res, next) => {
  try {
    const { path: targetPath } = req.body || {};
    if (!targetPath) return res.status(400).json({ error: '请提供路径' });

    const pathsConfig = await configService.readPaths();
    const existingPaths = pathsConfig.customPaths || [];
    const existingIndex = existingPaths.findIndex(pathEntry => pathEntry.path === targetPath);
    if (existingIndex < 0) return res.status(404).json({ error: '路径配置不存在，请先添加路径' });

    const oldPathEntry = existingPaths[existingIndex];
    const nextPathEntry = {
      ...oldPathEntry,
      path: oldPathEntry.path,
      recursive: req.body.recursive !== false,
      albumMode: req.body.albumMode || 'none',
      albumId: req.body.albumMode === 'existing' ? (req.body.albumId || null) : null,
      albumName: req.body.albumMode === 'new' ? String(req.body.albumName || '').trim() : null,
      makePublic: !!req.body.makePublic,
      allowDelete: !!req.body.allowDelete,
      ignoreFilenameParts: Array.isArray(req.body.ignoreFilenameParts) ? req.body.ignoreFilenameParts : [],
      tagIds: req.body.tagIds || [],
      newTagNames: req.body.newTagNames || req.body.newTags || []
    };

    const applied = await applyPathImageSettings({ oldPathEntry, nextPathEntry, userId: req.user.id });
    existingPaths[existingIndex] = {
      ...nextPathEntry,
      albumMode: applied.albumId ? 'existing' : 'none',
      albumId: applied.albumId,
      albumName: nextPathEntry.albumMode === 'new' ? nextPathEntry.albumName : null,
      tagIds: applied.tagIds,
      newTagNames: []
    };
    await configService.writePaths({ galleryPaths: [], customPaths: existingPaths });
    res.json({ message: '路径配置已更新', updatedImages: applied.imageCount, ...applied });
  } catch (err) { next(err); }
});

// 删除自定义路径并清理该路径扫描入库的图片记录与标签关联（不删除原始磁盘文件）
router.post('/delete-path', authMiddleware, async (req, res, next) => {
  try {
    const { path: targetPath } = req.body || {};
    if (!targetPath) return res.status(400).json({ error: '请提供路径' });

    cancelScanJobsForPath(targetPath);

    const normalized = normalizePathForLike(targetPath);
    const prefix = withTrailingSlash(targetPath);
    const images = await db('images')
      .where('path', normalized)
      .orWhere('path', 'like', `${prefix}%`)
      .select('id', 'path', 'album_id');
    const imageIds = images.map(image => image.id);
    const albumIds = [...new Set(images.map(image => image.album_id).filter(Boolean))];

    await db.transaction(async trx => {
      if (imageIds.length) {
        await trx('image_tags').whereIn('image_id', imageIds).del();
        await trx('images').whereIn('id', imageIds).del();
      }
      await trx('custom_paths').where({ path: targetPath }).del();
    });

    for (const image of images) {
      const realPath = pathUtils.toAbsolutePath(image.path);
      await imageProcessor.removeDerivedThumbnailsForImage(realPath).catch(() => {});
    }

    for (const albumId of albumIds) {
      const [{ cnt }] = await db('images').where({ album_id: albumId }).count('* as cnt');
      await db('albums').where({ id: albumId }).update({ image_count: cnt });
    }

    res.json({ deletedImages: imageIds.length, deletedRelations: imageIds.length, deletedPath: targetPath });
  } catch (err) { next(err); }
});

export default router;
