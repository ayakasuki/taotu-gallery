/**
 * 备份服务
 * 支持数据库、本地图库、自定义路径图片、标签文件、配置文件备份
 * 输出为 .zip 压缩包
 */
const archiver = require('archiver');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const db = require('../db');
const config = require('../config');
const configService = require('./configService');
const logger = require('../config/logger');

// 创建备份
async function createBackup(options = {}) {
  const {
    includeDatabase = true,
    includeGallery = true,
    includeCustomPaths = true,
    includeTags = true,
    includePaths = true,
    includeConditions = true,
    includeSiteConfig = true
  } = options;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `backup_${timestamp}.zip`;
  const backupPath = path.join(config.backupsDir, backupName);

  await fs.mkdir(config.backupsDir, { recursive: true });

  const output = fsSync.createWriteStream(backupPath);
  const archive = archiver('zip', { zlib: { level: 6 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      logger.info(`备份完成: ${backupPath} (${archive.pointer()} bytes)`);
      resolve({ path: backupPath, filename: backupName, size: archive.pointer() });
    });

    archive.on('error', reject);
    archive.pipe(output);

    // 1. 数据库备份
    if (includeDatabase) {
      addDatabaseBackup(archive).catch(reject);
    }

    // 2. 本地图库
    if (includeGallery) {
      addDirectoryToArchive(archive, config.galleryDir, 'gallery');
    }

    // 3. 自定义路径图片（带目录结构）
    if (includeCustomPaths) {
      addCustomPathsBackup(archive).catch(reject);
    }

    // 4. 配置文件
    if (includeTags) {
      addConfigFile(archive, 'tags.json');
    }
    if (includePaths) {
      addConfigFile(archive, 'paths.json');
    }
    if (includeConditions) {
      addConfigFile(archive, 'conditions.json');
    }
    if (includeSiteConfig) {
      addConfigFile(archive, 'site.json');
    }

    archive.finalize();
  });
}

// 数据库备份（SQL dump）
async function addDatabaseBackup(archive) {
  try {
    const dumpCmd = `mysqldump -u ${process.env.DB_USER} -p'${process.env.DB_PASSWORD}' ${process.env.DB_NAME} --no-tablespaces`;
    const { stdout } = await execAsync(dumpCmd);
    archive.append(stdout, { name: 'database/taotu_gallery.sql' });
    logger.info('数据库备份已添加');
  } catch (err) {
    logger.error(`数据库备份失败: ${err.message}`);
    // 写入错误信息而非阻塞备份
    archive.append(`数据库备份失败: ${err.message}`, { name: 'database/ERROR.txt' });
  }
}

// 自定义路径图片备份（带目录结构）
async function addCustomPathsBackup(archive) {
  const pathsConfig = await configService.readPaths();
  if (!pathsConfig.customPaths || pathsConfig.customPaths.length === 0) return;

  for (const cp of pathsConfig.customPaths) {
    if (cp.path && fsSync.existsSync(cp.path)) {
      const dirName = path.basename(cp.path);
      addDirectoryToArchive(archive, cp.path, `custom_paths/${dirName}`);
    }
  }
}

// 将目录添加到压缩包
function addDirectoryToArchive(archive, dirPath, archivePrefix) {
  if (!fsSync.existsSync(dirPath)) return;

  const entries = fsSync.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const archivePath = `${archivePrefix}/${entry.name}`;

    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      addDirectoryToArchive(archive, fullPath, archivePath);
    } else if (entry.isFile()) {
      archive.file(fullPath, { name: archivePath });
    }
  }
}

// 添加配置文件到压缩包
function addConfigFile(archive, filename) {
  const filePath = path.join(config.configDir, filename);
  if (fsSync.existsSync(filePath)) {
    archive.file(filePath, { name: `config/${filename}` });
  }
}

// 获取备份列表
async function getBackupList() {
  await fs.mkdir(config.backupsDir, { recursive: true });
  const files = await fs.readdir(config.backupsDir);
  const backups = [];

  for (const file of files) {
    if (file.endsWith('.zip')) {
      const filePath = path.join(config.backupsDir, file);
      const stats = await fs.stat(filePath);
      backups.push({
        filename: file,
        path: filePath,
        size: stats.size,
        created_at: stats.mtime
      });
    }
  }

  return backups.sort((a, b) => b.created_at - a.created_at);
}

// 删除备份
async function deleteBackup(filename) {
  const filePath = path.join(config.backupsDir, filename);
  if (fsSync.existsSync(filePath)) {
    await fs.unlink(filePath);
    logger.info(`备份已删除: ${filename}`);
  }
}

module.exports = {
  createBackup,
  getBackupList,
  deleteBackup
};
