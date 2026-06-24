/**
 * 云同步服务（WebDAV）
 * 当前范围：同步标签文件、路径配置文件、数据库连接配置文件
 */
const { createClient } = require('webdav');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const config = require('../config');
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
  siteConfig.webdav = webdavConfig;
  await configService.writeSiteConfig(siteConfig);
  logger.info('WebDAV 配置已保存');
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

// 测试 WebDAV 连接
async function testConnection() {
  try {
    const client = await createWebDAVClient();
    const webdavConfig = await getWebDAVConfig();

    // 尝试获取目录内容
    const remotePath = webdavConfig.remotePath || '/';
    const contents = await client.getDirectoryContents(remotePath);

    return {
      success: true,
      message: `连接成功，远程目录 ${remotePath} 下有 ${contents.length} 个项目`
    };
  } catch (err) {
    return {
      success: false,
      message: `连接失败: ${err.message}`
    };
  }
}

// 执行同步
async function sync() {
  const client = await createWebDAVClient();
  const webdavConfig = await getWebDAVConfig();
  const remotePath = webdavConfig.remotePath || '/gallery-sync/';

  // 确保远程目录存在
  try {
    await client.createDirectory(remotePath, { recursive: true });
  } catch (err) {
    // 目录可能已存在
  }

  const syncFiles = [
    { local: config.tagsFile, remote: `${remotePath}tags.json` },
    { local: config.pathsFile, remote: `${remotePath}paths.json` },
    { local: config.conditionsFile, remote: `${remotePath}conditions.json` },
    { local: config.siteFile, remote: `${remotePath}site.json` }
  ];

  let uploaded = 0;
  let downloaded = 0;
  const errors = [];

  for (const file of syncFiles) {
    try {
      const localExists = fsSync.existsSync(file.local);

      // 检查远程文件是否存在
      let remoteExists = false;
      try {
        await client.stat(file.remote);
        remoteExists = true;
      } catch {
        remoteExists = false;
      }

      if (localExists && !remoteExists) {
        // 本地存在，远程不存在 → 上传
        const content = await fs.readFile(file.local);
        await client.putFileContents(file.remote, content);
        uploaded++;
        logger.info(`已上传: ${path.basename(file.local)}`);
      } else if (!localExists && remoteExists) {
        // 远程存在，本地不存在 → 下载
        const content = await client.getFileContents(file.remote, { format: 'text' });
        await fs.writeFile(file.local, content, 'utf-8');
        downloaded++;
        logger.info(`已下载: ${path.basename(file.local)}`);
      } else if (localExists && remoteExists) {
        // 都存在 → 比较修改时间，取较新的
        const localStat = await fs.stat(file.local);
        const remoteStat = await client.stat(file.remote);

        const localTime = localStat.mtime.getTime();
        const remoteTime = new Date(remoteStat.lastmod).getTime();

        if (localTime > remoteTime) {
          const content = await fs.readFile(file.local);
          await client.putFileContents(file.remote, content);
          uploaded++;
          logger.info(`已上传（本地更新）: ${path.basename(file.local)}`);
        } else if (remoteTime > localTime) {
          const content = await client.getFileContents(file.remote, { format: 'text' });
          await fs.writeFile(file.local, content, 'utf-8');
          downloaded++;
          logger.info(`已下载（远程更新）: ${path.basename(file.local)}`);
        }
      }
    } catch (err) {
      errors.push({ file: path.basename(file.local), error: err.message });
      logger.error(`同步失败: ${path.basename(file.local)} - ${err.message}`);
    }
  }

  return { uploaded, downloaded, errors };
}

module.exports = {
  getWebDAVConfig,
  saveWebDAVConfig,
  testConnection,
  sync
};
