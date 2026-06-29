/**
 * 云同步服务（WebDAV）
 * 当前范围：同步数据库中的标签、路径、条件与站点配置快照
 */
const { createClient } = require('webdav');
const configService = require('./configService');
const logger = require('../config/logger');

// 获取 WebDAV 配置
async function getWebDAVConfig() {
  const siteConfig = await configService.readSiteConfig();
  return siteConfig.webdav || {
    configured: false,
    url: '',
    username: '',
    password: '',
    remotePath: '/gallery-sync/'
  };
}

// 保存 WebDAV 配置
async function saveWebDAVConfig(webdavConfig) {
  const siteConfig = await configService.readSiteConfig();
  const previous = siteConfig.webdav || {};
  const nextConfig = { ...previous, ...webdavConfig };
  if (!webdavConfig.password || webdavConfig.password === '******') {
    nextConfig.password = previous.password || '';
  }

  siteConfig.webdav = {
    configured: false,
    url: '',
    username: '',
    password: '',
    remotePath: '/gallery-sync/',
    ...nextConfig
  };
  await configService.writeSiteConfig(siteConfig);
  logger.info('WebDAV 配置已保存');
}

async function saveSyncStatus(status) {
  const siteConfig = await configService.readSiteConfig();
  const previous = siteConfig.webdav || {};
  const history = Array.isArray(previous.syncHistory) ? previous.syncHistory : [];
  const entry = {
    ...status,
    updatedAt: new Date().toISOString()
  };

  siteConfig.webdav = {
    ...previous,
    lastStatus: entry,
    syncHistory: [entry, ...history].slice(0, 20)
  };
  await configService.writeSiteConfig(siteConfig);
  return siteConfig.webdav.lastStatus;
}

async function getSyncStatus() {
  const webdavConfig = await getWebDAVConfig();
  return webdavConfig.lastStatus || {
    success: false,
    message: '尚未同步',
    updatedAt: null
  };
}

async function getSyncLogs() {
  const webdavConfig = await getWebDAVConfig();
  return Array.isArray(webdavConfig.syncHistory) ? webdavConfig.syncHistory : [];
}

// 创建 WebDAV 客户端
async function createWebDAVClient() {
  const webdavConfig = await getWebDAVConfig();

  if (!webdavConfig.configured || !webdavConfig.url) {
    throw { statusCode: 400, message: 'WebDAV 未配置' };
  }

  return createClient(webdavConfig.url, {
    username: webdavConfig.username,
    password: webdavConfig.password
  });
}

function normalizeRemotePath(remotePath = '/gallery-sync/') {
  let nextPath = remotePath || '/gallery-sync/';
  if (!nextPath.startsWith('/')) nextPath = `/${nextPath}`;
  if (!nextPath.endsWith('/')) nextPath = `${nextPath}/`;
  return nextPath;
}

async function buildSyncPayloads() {
  const [tags, tagGroups, paths, conditions, siteConfig] = await Promise.all([
    configService.readTags(),
    configService.readTagGroups(),
    configService.readPaths(),
    configService.readConditions(),
    configService.readSiteConfig()
  ]);

  return [
    { filename: 'tags.json', data: tags },
    { filename: 'tag_groups.json', data: tagGroups },
    { filename: 'paths.json', data: paths },
    { filename: 'conditions.json', data: conditions },
    { filename: 'site.json', data: siteConfig },
    {
      filename: 'sync_manifest.json',
      data: {
        app: 'taotu-gallery',
        createdAt: new Date().toISOString(),
        contents: ['tags', 'tag_groups', 'paths', 'conditions', 'site_config']
      }
    }
  ];
}

// 测试 WebDAV 连接
async function testConnection() {
  try {
    const client = await createWebDAVClient();
    const webdavConfig = await getWebDAVConfig();

    // 尝试获取目录内容
    const remotePath = normalizeRemotePath(webdavConfig.remotePath || '/');
    const contents = await client.getDirectoryContents(remotePath);

    const result = {
      success: true,
      message: `连接成功，远程目录 ${remotePath} 下有 ${contents.length} 个项目`
    };
    await saveSyncStatus({ ...result, type: 'test' });
    return result;
  } catch (err) {
    const result = {
      success: false,
      message: `连接失败: ${err.message}`
    };
    await saveSyncStatus({ ...result, type: 'test' }).catch(() => {});
    return result;
  }
}

// 执行同步
async function sync() {
  const client = await createWebDAVClient();
  const webdavConfig = await getWebDAVConfig();
  const remotePath = normalizeRemotePath(webdavConfig.remotePath || '/gallery-sync/');

  // 确保远程目录存在
  try {
    await client.createDirectory(remotePath, { recursive: true });
  } catch (err) {
    // 目录可能已存在
  }

  const syncFiles = await buildSyncPayloads();

  let uploaded = 0;
  const errors = [];

  for (const file of syncFiles) {
    try {
      await client.putFileContents(
        `${remotePath}${file.filename}`,
        JSON.stringify(file.data, null, 2),
        { overwrite: true }
      );
      uploaded++;
      logger.info(`已同步配置快照: ${file.filename}`);
    } catch (err) {
      errors.push({ file: file.filename, error: err.message });
      logger.error(`同步失败: ${file.filename} - ${err.message}`);
    }
  }

  const result = {
    success: errors.length === 0,
    uploaded,
    downloaded: 0,
    errors,
    message: errors.length === 0 ? '同步成功' : `同步完成，${errors.length} 个文件失败`
  };
  await saveSyncStatus({ ...result, type: 'sync' }).catch(() => {});
  return result;
}

module.exports = {
  getWebDAVConfig,
  saveWebDAVConfig,
  getSyncStatus,
  getSyncLogs,
  testConnection,
  sync
};
