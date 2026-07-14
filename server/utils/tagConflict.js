import db from '../db/index.js';

function parseTagIds(tags) {
  if (!tags) return null;
  const values = Array.isArray(tags) ? tags : String(tags).split(',');
  return values
    .map(id => String(id).trim())
    .filter(Boolean)
    .map(id => {
      if (id.startsWith('u') || id.startsWith('__')) return id;
      const numeric = Number(id);
      return Number.isNaN(numeric) ? id : numeric;
    });
}

function parseMutualIds(value) {
  if (value === null || value === undefined || value === '') return [];
  const values = Array.isArray(value) ? value : String(value).split(/[,，.。\s]+/);
  return values
    .map(part => String(part).trim())
    .filter(Boolean)
    .map(part => /^u\d+$/i.test(part) ? `u${parseInt(part.slice(1))}` : (/^\d+$/.test(part) ? Number(part) : null))
    .filter(id => id !== null);
}

function tagIdKey(id) {
  if (typeof id === 'string' && id.startsWith('__')) return id;
  if (typeof id === 'string' && /^u\d+$/i.test(id)) return `u${parseInt(id.slice(1))}`;
  const numeric = Number(id);
  return Number.isInteger(numeric) ? String(numeric) : String(id);
}

function tagLabel(tag, fallbackId) {
  return tag?.display_name || tag?.name || String(fallbackId);
}

async function validateTagFilterConflict(tagIds) {
  const ids = (tagIds || []).filter(id => id !== null && id !== undefined);
  if (ids.length < 2) return { valid: true };

  const selectedKeys = new Set(ids.map(tagIdKey));
  const publicIds = ids
    .filter(id => !String(id).startsWith('u') && !String(id).startsWith('__'))
    .map(id => Number(id))
    .filter(Number.isInteger);
  const userTagIds = ids
    .filter(id => /^u\d+$/i.test(String(id)))
    .map(id => parseInt(String(id).slice(1)))
    .filter(Number.isInteger);

  const publicTags = publicIds.length > 0
    ? await db('tags').whereIn('id', [...new Set(publicIds)]).select('id', 'name', 'display_name', 'mutually_exclusive_with')
    : [];
  const userTags = userTagIds.length > 0
    ? await db('user_tags').whereIn('id', [...new Set(userTagIds)]).select('id', 'name', 'display_name', 'mutually_exclusive_with')
    : [];

  const labelMap = new Map();
  for (const tag of publicTags) labelMap.set(tagIdKey(tag.id), tagLabel(tag, tag.id));
  for (const tag of userTags) labelMap.set(`u${tag.id}`, tagLabel(tag, `u${tag.id}`));

  for (const tag of [...publicTags, ...userTags.map(tag => ({ ...tag, id: `u${tag.id}` }))]) {
    const sourceKey = tagIdKey(tag.id);
    for (const targetId of parseMutualIds(tag.mutually_exclusive_with)) {
      const targetKey = tagIdKey(targetId);
      if (!selectedKeys.has(targetKey)) continue;
      return {
        valid: false,
        error: `非法互斥标签参数：${labelMap.get(sourceKey) || sourceKey} 与 ${labelMap.get(targetKey) || targetKey} 不可同时筛选`,
        conflictTags: [sourceKey, targetKey]
      };
    }
  }

  return { valid: true };
}

async function assertNoTagFilterConflict(tagIds) {
  const result = await validateTagFilterConflict(tagIds);
  if (!result.valid) {
    const err = new Error(result.error);
    err.statusCode = 400;
    err.conflictTags = result.conflictTags;
    throw err;
  }
}

export {
  parseTagIds,
  parseMutualIds,
  tagIdKey,
  validateTagFilterConflict,
  assertNoTagFilterConflict
};

export default {
  parseTagIds,
  parseMutualIds,
  tagIdKey,
  validateTagFilterConflict,
  assertNoTagFilterConflict
};
