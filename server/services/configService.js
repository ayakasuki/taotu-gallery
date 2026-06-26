/**
 * 配置服务 — 所有配置存储在数据库
 * - site_config 表：网站配置
 * - custom_paths 表：自定义路径
 * - tags 表：标签定义
 * - conditions 表：条件标签
 */
const db = require('../db');
const logger = require('../config/logger');

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
      registration: config.registration || { enabled: false, emailVerification: false },
      display: config.display || { mode: 'grid' },
      upload: config.upload || { showUrlAfterUpload: true },
      tagDelayMinutes: config.tagDelayMinutes || 5,
      tagDiffThreshold: config.tagDiffThreshold || 0.5,
      publicDomain: config.publicDomain || '',
      https: config.https || { enabled: false },
      background: config.background || { type: 'none', value: '' },
      mediumSize: config.mediumSize || { width: 1500, height: 1500 },
      defaultQuota: config.defaultQuota || { storageLimit: 0, maxFileSize: 50 },
      icon: config.icon || null
    };
  } catch (err) {
    logger.error(`读取网站配置失败: ${err.message}`);
    return { siteName: '桃图智库', registration: { enabled: false } };
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
  const rawTags = incomingTags
    .filter(tag => !tag.isUserTag)
    .filter(tag => Number.isInteger(Number(tag.id)) && tag.name);

  const byId = new Map();
  const adjacency = new Map();
  for (const tag of rawTags) {
    const id = Number(tag.id);
    byId.set(id, {
      ...tag,
      id,
      mutuallyExclusiveIds: parseMutualIds(tag.mutually_exclusive_with).filter(mid => String(mid) !== String(id))
    });
    adjacency.set(id, new Set());
  }

  for (const tag of byId.values()) {
    tag.mutuallyExclusiveIds = tag.mutuallyExclusiveIds.filter(id => validIds.has(mutualIdKey(id)));
    for (const targetId of tag.mutuallyExclusiveIds) {
      if (typeof targetId !== 'number' || !byId.has(targetId)) continue;
      adjacency.get(tag.id).add(targetId);
      adjacency.get(targetId).add(tag.id);
    }
  }

  const visited = new Set();
  for (const tag of byId.values()) {
    if (visited.has(tag.id)) continue;

    const stack = [tag.id];
    const component = [];
    visited.add(tag.id);

    while (stack.length > 0) {
      const currentId = stack.pop();
      component.push(currentId);
      for (const nextId of adjacency.get(currentId) || []) {
        if (visited.has(nextId)) continue;
        visited.add(nextId);
        stack.push(nextId);
      }
    }

    const externalIds = new Set();
    for (const memberId of component) {
      for (const targetId of byId.get(memberId).mutuallyExclusiveIds) {
        if (typeof targetId === 'string') externalIds.add(targetId);
      }
    }

    const sortedComponent = [...component].sort((a, b) => a - b);
    const sortedExternalIds = [...externalIds].sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    for (const memberId of component) {
      const member = byId.get(memberId);
      const nextIds = [
        ...sortedComponent.filter(id => id !== memberId),
        ...sortedExternalIds
      ];
      member.mutuallyExclusiveIds = nextIds;
      if (nextIds.length > 0) member.combinable = false;
    }
  }

  return [...byId.values()].map(tag => ({
    ...tag,
    mutually_exclusive_with: stringifyMutualIds(tag.mutuallyExclusiveIds)
  }));
}

async function writeTags(tags) {
  const allTags = normalizeTagsForWrite(tags);

  // 只更新或插入，不删除（删除通过显式 API 操作）
  for (const tag of allTags) {
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

module.exports = {
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
