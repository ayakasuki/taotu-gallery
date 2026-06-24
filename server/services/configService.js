const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const logger = require('../config/logger');

// 读取 JSON 配置文件
async function readConfig(filename) {
  const filePath = path.join(config.configDir, filename);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.warn(`配置文件不存在: ${filename}，返回默认值`);
      return null;
    }
    throw err;
  }
}

// 写入 JSON 配置文件
async function writeConfig(filename, data) {
  const filePath = path.join(config.configDir, filename);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  logger.info(`配置文件已更新: ${filename}`);
}

// 读取标签文件
async function readTags() {
  return await readConfig('tags.json') || { combinable: [], nonCombinable: [], nextId: 1 };
}

// 写入标签文件
async function writeTags(tags) {
  await writeConfig('tags.json', tags);
  // 同步到数据库 tags 表
  await syncTagsToDb(tags);
}

// 同步标签到数据库 tags 表
async function syncTagsToDb(tags) {
  const db = require('../db');
  try {
    const allTags = [...(tags.combinable || []), ...(tags.nonCombinable || [])];
    for (const tag of allTags) {
      const existing = await db('tags').where({ id: tag.id }).first();
      if (existing) {
        await db('tags').where({ id: tag.id }).update({
          name: tag.name,
          display_name: tag.display_name || tag.name,
          combinable: tag.combinable !== false,
          mutually_exclusive_with: tag.mutually_exclusive_with || null
        });
      } else {
        await db('tags').insert({
          id: tag.id,
          name: tag.name,
          display_name: tag.display_name || tag.name,
          combinable: tag.combinable !== false,
          mutually_exclusive_with: tag.mutually_exclusive_with || null,
          tag_type: tag.tag_type || 'manual'
        }).onConflict('id').ignore();
      }
    }
  } catch (err) {
    console.error('同步标签到数据库失败:', err.message);
  }
}

// 读取路径配置
async function readPaths() {
  return await readConfig('paths.json') || { galleryPaths: [], customPaths: [] };
}

// 写入路径配置
async function writePaths(paths) {
  await writeConfig('paths.json', paths);
}

// 读取条件配置
async function readConditions() {
  return await readConfig('conditions.json') || [];
}

// 写入条件配置
async function writeConditions(conditions) {
  await writeConfig('conditions.json', conditions);
}

// 读取网站配置
async function readSiteConfig() {
  return await readConfig('site.json') || {
    siteName: '桃图智库',
    registration: { enabled: false, emailVerification: false },
    display: { mode: 'grid' },
    upload: { showUrlAfterUpload: true },
    tagDelayMinutes: 5,
    tagDiffThreshold: 0.5
  };
}

// 写入网站配置
async function writeSiteConfig(siteConfig) {
  await writeConfig('site.json', siteConfig);
}

module.exports = {
  readConfig,
  writeConfig,
  readTags,
  writeTags,
  readPaths,
  writePaths,
  readConditions,
  writeConditions,
  readSiteConfig,
  writeSiteConfig
};
