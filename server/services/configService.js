/**
 * 配置服务 — 所有配置存储在数据库
 * - site_config 表：网站配置
 * - custom_paths 表：自定义路径
 * - tags 表：标签定义
 * - conditions 表：条件标签
 */
import db from '../db/index.js';

import logger from '../config/logger.js';

const DEFAULT_SITE_BACKGROUND = {
  type: 'default',
  value: '/site_bg.png',
  blur: 0,
  overlayTop: 'rgba(255, 255, 255, 0.08)',
  overlayBottom: 'rgba(255, 246, 250, 0.42)'
};

function normalizeSiteBackground(background) {
  const merged = { ...DEFAULT_SITE_BACKGROUND, ...(background || {}) };
  if (!merged.value) {
    merged.type = 'default';
    merged.value = DEFAULT_SITE_BACKGROUND.value;
  }
  return merged;
}

function parseJsonField(value, fallback = []) {
  if (value === null || value === undefined || value === '') return fallback;
  if (Array.isArray(value) || typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// ========== 网站配置 ==========

async function readSiteConfig() {
  try {
    const rows = await db('site_config').select('key', 'value');
    const config = {};
    for (const row of rows) {
      try {
        config[row.key] = JSON.parse(row.value);
      } catch {
        config[row.key] = row.value;
      }
    }
    return {
      siteName: config.siteName || '桃图智库',
      registration: {
        enabled: !!config.registration?.enabled,
        emailVerification: !!config.registration?.emailVerification,
        requireReview: !!config.registration?.requireReview,
        maxUsers: Number(config.registration?.maxUsers || 0)
      },
      display: config.display || { mode: 'grid' },
      upload: config.upload || { showUrlAfterUpload: true },
      tagDelayMinutes: config.tagDelayMinutes || 5,
      tagDiffThreshold: config.tagDiffThreshold || 0.5,
      tagAutoSync: config.tagAutoSync !== false,
      publicDomain: config.publicDomain || '',
      recordNumber: config.recordNumber || '',
      smtp: config.smtp || { host: '', port: 465, secure: true, username: '', password: '', from: '' },
      https: config.https || { enabled: false },
      background: normalizeSiteBackground(config.background),
      mediumSize: config.mediumSize || { width: 1500, height: 1500 },
      imageProcessing: config.imageProcessing || { quality: 85, formats: ['jpg', 'png', 'webp', 'gif'] },
      defaultQuota: config.defaultQuota || { storageLimit: 0, maxFileSize: 50 },
      icon: config.icon || null,
      logo: config.logo || null,
      webdav: config.webdav || {
        configured: false,
        url: '',
        username: '',
        password: '',
        remotePath: '/gallery-sync/'
      }
    };
  } catch (err) {
    logger.error(`读取网站配置失败: ${err.message}`);
    return { siteName: '桃图智库', registration: { enabled: false, emailVerification: false, requireReview: false, maxUsers: 0 }, background: DEFAULT_SITE_BACKGROUND };
  }
}

async function writeSiteConfig(siteConfig) {
  for (const [key, value] of Object.entries(siteConfig)) {
    await db('site_config')
      .insert({ key, value: JSON.stringify(value), updated_at: db.fn.now() })
      .onConflict('key')
      .merge({ value: JSON.stringify(value), updated_at: db.fn.now() });
  }
  logger.info('网站配置已更新');
}

// ========== 标签 ==========

async function readTags() {
  try {
    const dbTags = await db('tags').select('*');
    const combinable = [];
    const nonCombinable = [];
    for (const t of dbTags) {
      const tag = {
        id: t.id, name: t.name,
        display_name: t.display_name || t.name,
        combinable: !!t.combinable,
        mutually_exclusive_with: t.mutually_exclusive_with,
        tag_type: t.tag_type || 'manual',
        is_public: !!t.is_public
      };
      if (tag.combinable) combinable.push(tag);
      else nonCombinable.push(tag);
    }
    // nextId: 最大 ID + 1
    const maxId = dbTags.reduce((m, t) => Math.max(m, t.id || 0), 0);
    return { combinable, nonCombinable, nextId: maxId + 1 };
  } catch (err) {
    logger.error(`读取标签失败: ${err.message}`);
    return { combinable: [], nonCombinable: [], nextId: 1 };
  }
}

function parseMutualIds(value) {
  if (value === null || value === undefined || value === '') return [];
  const values = Array.isArray(value) ? value : String(value).split(/[,，.。\s]+/);
  return values
    .map(part => String(part).trim())
    .filter(Boolean)
    .map(part => /^u\d+$/i.test(part) ? 'u' + parseInt(part.slice(1)) : (/^\d+$/.test(part) ? parseInt(part) : null))
    .filter(id => id !== null);
}

function mutualIdKey(id) {
  return typeof id === 'string' && /^u\d+$/i.test(id) ? `u${parseInt(id.slice(1))}` : String(Number(id));
}

function stringifyMutualIds(ids) {
  const unique = [];
  const seen = new Set();
  for (const id of ids) {
    const normalized = typeof id === 'string' && /^u\d+$/i.test(id) ? 'u' + parseInt(id.slice(1)) : (Number.isInteger(id) ? id : null);
    if (normalized === null || seen.has(String(normalized))) continue;
    seen.add(String(normalized));
    unique.push(normalized);
  }
  return unique.length > 0 ? unique.join(',') : null;
}

function normalizeTagsForWrite(tags) {
  const incomingTags = [...(tags.combinable || []), ...(tags.nonCombinable || [])]
    .filter(tag => tag && !tag.isSystemTag && !tag.isPublicUserTag && tag.name);
  const validIds = new Set(incomingTags.map(tag => mutualIdKey(tag.id)));

  const byKey = new Map();
  const adjacency = new Map();

  for (const tag of incomingTags) {
    const isUserTag = tag.isUserTag || (typeof tag.id === 'string' && /^u\d+$/i.test(tag.id));
    const key = mutualIdKey(tag.id);
    const id = isUserTag ? parseInt(String(tag.id).replace(/^u/i, '')) : Number(tag.id);
    if (!Number.isInteger(id)) continue;

    byKey.set(key, {
      ...tag,
      id,
      key,
      isUserTag,
      mutuallyExclusiveIds: parseMutualIds(tag.mutually_exclusive_with).filter(mid => mutualIdKey(mid) !== key)
    });
    adjacency.set(key, new Set());
  }

  for (const tag of byKey.values()) {
    tag.mutuallyExclusiveIds = tag.mutuallyExclusiveIds.filter(id => validIds.has(mutualIdKey(id)));
    for (const targetId of tag.mutuallyExclusiveIds) {
      const targetKey = mutualIdKey(targetId);
      if (!byKey.has(targetKey)) continue;
      adjacency.get(tag.key).add(targetKey);
      adjacency.get(targetKey).add(tag.key);
    }
  }

  const visited = new Set();
  for (const tag of byKey.values()) {
    if (visited.has(tag.key)) continue;

    const stack = [tag.key];
    const component = [];
    visited.add(tag.key);

    while (stack.length > 0) {
      const currentKey = stack.pop();
      component.push(currentKey);
      for (const nextKey of adjacency.get(currentKey) || []) {
        if (visited.has(nextKey)) continue;
        visited.add(nextKey);
        stack.push(nextKey);
      }
    }

    const sortedComponent = [...component].sort((a, b) => {
      const aUser = a.startsWith('u');
      const bUser = b.startsWith('u');
      if (aUser !== bUser) return aUser ? 1 : -1;
      return parseInt(a.replace(/^u/, '')) - parseInt(b.replace(/^u/, ''));
    });

    for (const memberKey of component) {
      const member = byKey.get(memberKey);
      const nextIds = sortedComponent
        .filter(key => key !== memberKey)
        .map(key => key.startsWith('u') ? key : Number(key));
      member.mutuallyExclusiveIds = nextIds;
      if (nextIds.length > 0) member.combinable = false;
    }
  }

  const normalized = [...byKey.values()].map(tag => ({
    ...tag,
    mutually_exclusive_with: stringifyMutualIds(tag.mutuallyExclusiveIds)
  }));

  return {
    publicTags: normalized.filter(tag => !tag.isUserTag),
    userTags: normalized.filter(tag => tag.isUserTag)
  };
}

async function writeTags(tags, options = {}) {
  const { publicTags, userTags } = normalizeTagsForWrite(tags);

  // 只更新或插入，不删除（删除通过显式 API 操作）
  for (const tag of publicTags) {
    await db('tags').insert({
      id: tag.id,
      name: tag.name,
      display_name: tag.display_name || tag.name,
      combinable: tag.combinable !== false,
      mutually_exclusive_with: tag.mutually_exclusive_with || null,
      tag_type: tag.tag_type || 'manual',
      is_public: tag.is_public !== undefined ? !!tag.is_public : true
    }).onConflict('id').merge({
      name: tag.name,
      display_name: tag.display_name || tag.name,
      combinable: tag.combinable !== false,
      mutually_exclusive_with: tag.mutually_exclusive_with || null,
      is_public: tag.is_public !== undefined ? !!tag.is_public : true
    });
  }

  for (const tag of userTags) {
    const query = db('user_tags').where({ id: tag.id });
    if (options.userId) query.andWhere({ user_id: options.userId });
    await query.update({
        display_name: tag.display_name || tag.name,
        combinable: tag.combinable !== false,
        mutually_exclusive_with: tag.mutually_exclusive_with || null
      });
  }

  logger.info('标签已同步到数据库');
}

// ========== 路径配置 ==========

async function readPaths() {
  try {
    const customPaths = await db('custom_paths').select('*');
    return {
      galleryPaths: [],
      customPaths: customPaths.map(cp => ({
        id: cp.id,
        path: cp.path,
        recursive: !!cp.recursive,
        albumMode: cp.album_mode || 'none',
        albumId: cp.album_id,
        albumName: cp.album_name,
        makePublic: !!cp.make_public,
        tagIds: parseJsonField(cp.tag_ids, []),
        newTagNames: parseJsonField(cp.new_tag_names, [])
      }))
    };
  } catch (err) {
    logger.error(`读取路径配置失败: ${err.message}`);
    return { galleryPaths: [], customPaths: [] };
  }
}

async function writePaths(pathsData) {
  // 清空并重新写入
  await db('custom_paths').del();
  if (pathsData.customPaths && Array.isArray(pathsData.customPaths)) {
    for (const cp of pathsData.customPaths) {
      await db('custom_paths').insert({
        path: cp.path,
        recursive: cp.recursive !== false,
        album_mode: cp.albumMode || 'none',
        album_id: cp.albumId || null,
        album_name: cp.albumName || null,
        make_public: !!cp.makePublic,
        tag_ids: cp.tagIds ? JSON.stringify(cp.tagIds) : null,
        new_tag_names: cp.newTagNames ? JSON.stringify(cp.newTagNames) : null
      });
    }
  }
  logger.info('路径配置已更新');
}

// ========== 条件标签 ==========

async function readConditions() {
  try {
    return await db('conditions').select('*');
  } catch (err) {
    logger.error(`读取条件标签失败: ${err.message}`);
    return [];
  }
}

async function writeConditions(conditions) {
  await db('conditions').del();
  for (const cond of conditions) {
    await db('conditions').insert({
      id: cond.id,
      name: cond.name,
      type: cond.type,
      config: typeof cond.config === 'string' ? cond.config : JSON.stringify(cond.config),
      is_enabled: cond.is_enabled !== false,
      is_public: cond.is_public || false,
      tag_id: cond.tag_id || null
    }).onConflict('id').ignore();
  }
  logger.info('条件标签已更新');
}

// ========== 标签分组 ==========

async function readTagGroups() {
  try {
    const rows = await db('tag_groups').select('*');
    let nextSid = 1;
    const groups = rows.map(r => {
      const subgroups = (typeof r.subgroups === 'string' ? JSON.parse(r.subgroups) : (r.subgroups || [])).map(sg => {
        if (!sg.sid) sg.sid = nextSid++;
        if (sg.sid >= nextSid) nextSid = sg.sid + 1;
        return sg;
      });
      return {
        id: r.id,
        name: r.name,
        subgroups,
        tagIds: typeof r.tag_ids === 'string' ? JSON.parse(r.tag_ids) : (r.tag_ids || [])
      };
    });
    return { groups, nextGroupId: groups.length > 0 ? Math.max(...groups.map(g => g.id)) + 1 : 1, nextSid };
  } catch (err) {
    logger.error(`读取标签分组失败: ${err.message}`);
    return { groups: [], nextGroupId: 1, nextSid: 1 };
  }
}

async function writeTagGroups(data) {
  // 删除旧数据
  await db('tag_groups').del();
  if (data.groups && Array.isArray(data.groups)) {
    for (const group of data.groups) {
      await db('tag_groups').insert({
        id: group.id,
        name: group.name,
        subgroups: JSON.stringify(group.subgroups || []),
        tag_ids: JSON.stringify(group.tagIds || [])
      }).onConflict('id').ignore();
    }
  }
  logger.info('标签分组已更新');
}

export default {
  readSiteConfig,
  writeSiteConfig,
  readTags,
  writeTags,
  readPaths,
  writePaths,
  readConditions,
  writeConditions,
  readTagGroups,
  writeTagGroups
};
