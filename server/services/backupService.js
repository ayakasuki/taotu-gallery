/**
 * 备份服务
 * 支持数据库、本地图库、自定义路径图片、标签文件、配置文件备份
 * 输出为 .zip 压缩包
 */
import archiver from 'archiver';
import unzipper from 'unzipper';

import {promises as fs} from 'fs';
import fsSync from 'fs';
import path from 'path';
import {execFile} from 'child_process';
import {promisify} from 'util';
const execFileAsync = promisify(execFile);
import config from '../config/index.js';
import configService from './configService.js';
import logger from '../config/logger.js';

const BACKUP_CONTENT = {
  database: { key: 'database', label: '数据库', description: '完整数据库所有表、数据、触发器、事件与存储过程' },
  gallery: { key: 'gallery', label: '本地图库', description: 'data/gallery 与 data/uploads 中的真实图片文件' },
  tags: { key: 'tags', label: '标签文件', description: '旧版标签文件兼容项，当前主要随数据库备份' },
  conditions: { key: 'conditions', label: '条件配置', description: '旧版条件配置文件兼容项，当前主要随数据库备份' },
  siteConfig: { key: 'siteConfig', label: '网站配置', description: '旧版网站配置文件兼容项，当前主要随数据库备份' },
  customPaths: { key: 'customPaths', label: '自定义路径图片', description: '自定义外部路径图片文件' }
};

function getSafeBackupPath(filename) {
  if (!filename || path.basename(filename) !== filename || !filename.endsWith('.zip')) {
    throw { statusCode: 400, message: '备份文件名无效' };
  }

  const backupsRoot = path.resolve(config.backupsDir);
  const filePath = path.resolve(backupsRoot, filename);
  if (!filePath.startsWith(`${backupsRoot}${path.sep}`)) {
    throw { statusCode: 400, message: '备份文件路径无效' };
  }
  return filePath;
}

function normalizeOptions(options = {}) {
  const includeDatabase = options.includeDatabase !== false;
  return {
    includeDatabase,
    includeGallery: options.includeGallery !== false,
    includeCustomPaths: options.includeCustomPaths === true,
    includeTags: includeDatabase || options.includeTags !== false,
    includePaths: includeDatabase || options.includePaths === true,
    includeConditions: includeDatabase || options.includeConditions !== false,
    includeSiteConfig: includeDatabase || options.includeSiteConfig !== false
  };
}

function buildManifest(options, startedAt, warnings = []) {
  const contents = [];
  if (options.includeDatabase) contents.push(BACKUP_CONTENT.database);
  if (options.includeGallery) contents.push(BACKUP_CONTENT.gallery);
  if (options.includeTags) contents.push(BACKUP_CONTENT.tags);
  if (options.includeConditions) contents.push(BACKUP_CONTENT.conditions);
  if (options.includeSiteConfig) contents.push(BACKUP_CONTENT.siteConfig);
  if (options.includeCustomPaths) contents.push(BACKUP_CONTENT.customPaths);

  return {
    version: 2,
    app: 'taotu-gallery',
    createdAt: startedAt.toISOString(),
    contents,
    options,
    notes: {
      database: '数据库恢复会覆盖整站数据，包含网站配置、条件标签配置、标签管理、图片元数据与关联关系。',
      gallery: '本地图库恢复只还原 data/gallery 与 data/uploads 下的文件，不恢复数据库记录或标签关系。'
    },
    warnings
  };
}

function appendJson(archive, name, value) {
  archive.append(JSON.stringify(value, null, 2), { name });
}

async function addConfigSnapshot(archive, filename, value) {
  appendJson(archive, `config/${filename}`, value);
}

// 创建备份
async function createBackup(options = {}) {
  const backupOptions = normalizeOptions(options);

  const startedAt = new Date();
  const timestamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const backupName = `backup_${timestamp}.zip`;
  const backupPath = path.join(config.backupsDir, backupName);

  await fs.mkdir(config.backupsDir, { recursive: true });

  const output = fsSync.createWriteStream(backupPath);
  const archive = archiver('zip', { zlib: { level: 6 } });
  const warnings = [];

  return new Promise(async (resolve, reject) => {
    let settled = false;

    const fail = async (err) => {
      if (settled) return;
      settled = true;
      archive.abort();
      output.destroy();
      await fs.rm(backupPath, { force: true }).catch(() => {});
      reject(err);
    };

    output.on('close', async () => {
      if (settled) return;
      try {
        const stats = await fs.stat(backupPath);
        settled = true;
        logger.info(`备份完成: ${backupPath} (${stats.size} bytes)`);
        resolve({
          path: backupPath,
          filename: backupName,
          size: stats.size,
          duration_ms: Date.now() - startedAt.getTime(),
          warnings
        });
      } catch (err) {
        await fail(err);
      }
    });

    output.on('error', fail);
    archive.on('error', fail);
    archive.pipe(output);

    try {
      if (backupOptions.includeDatabase) {
        warnings.push(...(await addDatabaseBackup(archive)));
      }

      if (backupOptions.includeGallery) {
        addDirectoryToArchive(archive, config.galleryDir, 'gallery');
        addDirectoryToArchive(archive, config.uploadsDir, 'uploads');
      }

      if (backupOptions.includeCustomPaths) {
        await addCustomPathsBackup(archive);
      }

      if (backupOptions.includeTags) {
        await addConfigSnapshot(archive, 'tags.json', await configService.readTags());
        await addConfigSnapshot(archive, 'tag_groups.json', await configService.readTagGroups());
      }
      if (backupOptions.includePaths) {
        await addConfigSnapshot(archive, 'paths.json', await configService.readPaths());
      }
      if (backupOptions.includeConditions) {
        await addConfigSnapshot(archive, 'conditions.json', await configService.readConditions());
      }
      if (backupOptions.includeSiteConfig) {
        await addConfigSnapshot(archive, 'site.json', await configService.readSiteConfig());
      }

      appendJson(archive, 'manifest.json', buildManifest(backupOptions, startedAt, warnings));
      archive.finalize();
    } catch (err) {
      await fail(err);
    }
  });
}

// 数据库备份（SQL dump）
function buildMysqlDumpArgs({ includeEvents = true } = {}) {
  const args = [
    `--host=${process.env.DB_HOST}`,
    `--port=${process.env.DB_PORT || 3306}`,
    `--user=${process.env.DB_USER}`,
    `--password=${Object.prototype.hasOwnProperty.call(process.env, 'DB_PASSWORD') ? process.env.DB_PASSWORD : ''}`,
    '--single-transaction',
    '--routines',
    '--triggers',
    '--hex-blob',
    '--no-tablespaces'
  ];
  if (includeEvents) args.push('--events');
  args.push(process.env.DB_NAME);
  return args;
}

function sanitizeDumpError(err) {
  const raw = err?.stderr || err?.message || String(err);
  return raw
    .replace(/--password=(?:\"[^\"]*\"|'[^']*'|\S+)/g, '--password=******')
    .trim();
}

function isEventPrivilegeError(err) {
  const message = sanitizeDumpError(err);
  return /show events|Access denied.*event|--events/i.test(message);
}

function makeBackupError(message) {
  const error = new Error(message);
  error.statusCode = 500;
  return error;
}

async function runMysqlDump(args) {
  return execFileAsync('mysqldump', args, {
    maxBuffer: 1024 * 1024 * 1024
  });
}

async function addDatabaseBackup(archive) {
  const warnings = [];

  try {
    const { stdout } = await runMysqlDump(buildMysqlDumpArgs({ includeEvents: true }));
    archive.append(stdout, { name: 'database/taotu_gallery.sql' });
    logger.info('数据库备份已添加');
    return warnings;
  } catch (err) {
    if (!isEventPrivilegeError(err)) {
      const message = sanitizeDumpError(err);
      logger.error(`数据库备份失败: ${message}`);
      throw makeBackupError(`数据库备份失败: ${message}`);
    }

    const warning = '当前数据库用户没有 EVENT 权限，已跳过数据库事件定义；所有表结构和表数据仍会导出。';
    logger.warn(`数据库事件导出权限不足，重试不包含 events 的备份: ${sanitizeDumpError(err)}`);
    warnings.push(warning);
  }

  try {
    const { stdout } = await runMysqlDump(buildMysqlDumpArgs({ includeEvents: false }));
    archive.append(stdout, { name: 'database/taotu_gallery.sql' });
    logger.info('数据库备份已添加（不包含 events）');
    return warnings;
  } catch (err) {
    const message = sanitizeDumpError(err);
    logger.error(`数据库备份失败: ${message}`);
    throw makeBackupError(`数据库备份失败: ${message}`);
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
        created_at: stats.mtime,
        manifest: await readBackupManifest(file).catch(() => null)
      });
    }
  }

  return backups.sort((a, b) => b.created_at - a.created_at);
}

async function readBackupManifest(filename) {
  const filePath = getSafeBackupPath(filename);
  if (!fsSync.existsSync(filePath)) {
    throw { statusCode: 404, message: '备份文件不存在' };
  }

  const directory = await unzipper.Open.file(filePath);
  const entry = directory.files.find(file => file.path === 'manifest.json');
  if (!entry) {
    return inferLegacyManifest(directory.files, filename);
  }

  const content = await entry.buffer();
  return JSON.parse(content.toString('utf8'));
}

function inferLegacyManifest(files, filename) {
  const has = (prefix) => files.some(file => file.path.startsWith(prefix));
  const contents = [];
  if (has('database/')) contents.push(BACKUP_CONTENT.database);
  if (has('gallery/') || has('uploads/')) contents.push(BACKUP_CONTENT.gallery);
  if (has('config/tags.json')) contents.push(BACKUP_CONTENT.tags);
  if (has('config/conditions.json')) contents.push(BACKUP_CONTENT.conditions);
  if (has('config/site.json')) contents.push(BACKUP_CONTENT.siteConfig);
  if (has('custom_paths/')) contents.push(BACKUP_CONTENT.customPaths);

  return {
    version: 1,
    app: 'taotu-gallery',
    createdAt: null,
    filename,
    contents,
    legacy: true
  };
}

// 删除备份
async function deleteBackup(filename) {
  const filePath = getSafeBackupPath(filename);
  if (fsSync.existsSync(filePath)) {
    await fs.unlink(filePath);
    logger.info(`备份已删除: ${filename}`);
  }
}

export default {
  createBackup,
  getBackupList,
  readBackupManifest,
  getSafeBackupPath,
  deleteBackup
};
