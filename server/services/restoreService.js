/**
 * 恢复服务
 * 从 .zip 备份包恢复数据库、图片、配置文件
 * 核心风险：路径相对化必须贯穿整个恢复流程
 */
import unzipper from 'unzipper';

import {promises as fs} from 'fs';
import fsSync from 'fs';
import path from 'path';
import {spawn} from 'child_process';
import db from '../db/index.js';
import config from '../config/index.js';
import pathUtils from '../utils/pathUtils.js';
import logger from '../config/logger.js';
import backupService from './backupService.js';
import configService from './configService.js';

function normalizeRestoreOptions(options = {}) {
  if (Array.isArray(options.restoreItems)) {
    const selected = new Set(options.restoreItems);
    const restoreConfigItems = ['tags', 'paths', 'conditions', 'siteConfig']
      .filter(item => selected.has(item) || selected.has('config'));

    return {
      restoreDatabase: selected.has('database'),
      restoreGallery: selected.has('gallery'),
      restoreCustomPaths: selected.has('customPaths'),
      restoreConfig: restoreConfigItems.length > 0,
      restoreConfigItems
    };
  }

  return {
    restoreDatabase: options.restoreDatabase !== false,
    restoreGallery: options.restoreGallery !== false,
    restoreCustomPaths: options.restoreCustomPaths === true,
    restoreConfig: options.restoreConfig === true,
    restoreConfigItems: options.restoreConfig === true ? ['tags', 'paths', 'conditions', 'siteConfig'] : []
  };
}

async function inspectBackup(filename) {
  const manifest = await backupService.readBackupManifest(filename);
  const backupPath = backupService.getSafeBackupPath(filename);
  const stat = await fs.stat(backupPath);
  return {
    filename,
    size: stat.size,
    created_at: stat.mtime,
    manifest,
    restorableItems: manifest.contents || []
  };
}

// 从备份包恢复
async function restoreFromBackup(backupPath, options = {}) {
  const safeBackupPath = backupService.getSafeBackupPath(path.basename(backupPath));
  if (path.resolve(backupPath) !== safeBackupPath) {
    throw { statusCode: 400, message: '备份文件路径无效' };
  }

  const {
    restoreDatabase,
    restoreGallery,
    restoreCustomPaths,
    restoreConfig,
    restoreConfigItems
  } = normalizeRestoreOptions(options);

  if (!fsSync.existsSync(safeBackupPath)) {
    throw { statusCode: 404, message: '备份文件不存在' };
  }

  // 解压到临时目录
  const tempDir = path.join(config.backupsDir, '.restore_temp');
  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // 解压
    await extractZip(safeBackupPath, tempDir);
    logger.info(`备份已解压到: ${tempDir}`);

    // 查找项目根目录（压缩包内可能是 "项目名/" 的形式）
    const rootDir = await findProjectRoot(tempDir);
    logger.info(`项目根目录: ${rootDir}`);

    const results = {};

    // 数据库恢复包含整站数据：网站配置、条件标签、标签、图片元数据与关联等。
    if (restoreDatabase) {
      results.database = await restoreDatabaseFromDump(rootDir);
    }

    // 本地图库只恢复真实文件，不恢复数据库记录或标签关系。
    if (restoreGallery) {
      results.gallery = await restoreGalleryFiles(rootDir);
    }

    if (restoreCustomPaths) {
      results.customPaths = await restoreCustomPathFiles(rootDir);
    }

    if (restoreConfig) {
      results.config = await restoreConfigFiles(rootDir, restoreConfigItems);
    }

    if (restoreDatabase) {
      results.pathNormalization = await normalizeAllImagePaths();
    }

    logger.info('恢复完成');
    return results;
  } finally {
    // 清理临时目录
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

// 解压 ZIP 文件
async function extractZip(zipPath, targetDir) {
  return new Promise((resolve, reject) => {
    fsSync.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: targetDir }))
      .on('close', resolve)
      .on('error', reject);
  });
}

// 查找项目根目录（压缩包内可能是 "项目名/" 的形式）
async function findProjectRoot(extractDir) {
  const entries = await fs.readdir(extractDir, { withFileTypes: true });

  // 检查是否直接包含 server/ 目录
  for (const entry of entries) {
    if (entry.name === 'server' && entry.isDirectory()) {
      return extractDir;
    }
  }

  // 检查子目录
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subPath = path.join(extractDir, entry.name);
      const subEntries = await fs.readdir(subPath);
      if (subEntries.includes('server') || subEntries.includes('data')) {
        return subPath;
      }
    }
  }

  // 默认使用根目录
  return extractDir;
}

// 恢复配置文件
async function readJsonIfExists(filePath) {
  if (!fsSync.existsSync(filePath)) return null;
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function restoreConfigFiles(rootDir, restoreConfigItems = []) {
  const configSrcDir = path.join(rootDir, 'config');
  if (!fsSync.existsSync(configSrcDir)) {
    logger.warn('备份中未找到配置文件目录');
    return { restored: 0, items: [] };
  }

  let restored = 0;
  const restoredItems = [];
  const selected = new Set(restoreConfigItems);

  if (selected.has('tags')) {
    const tags = await readJsonIfExists(path.join(configSrcDir, 'tags.json'));
    if (tags) {
      await configService.writeTags(tags);
      restored++;
      restoredItems.push('tags');
    }

    const tagGroups = await readJsonIfExists(path.join(configSrcDir, 'tag_groups.json'));
    if (tagGroups) {
      await configService.writeTagGroups(tagGroups);
      restored++;
      restoredItems.push('tag_groups');
    }
  }

  if (selected.has('paths')) {
    const pathsData = await readJsonIfExists(path.join(configSrcDir, 'paths.json'));
    if (pathsData) {
      await configService.writePaths(pathsData);
      restored++;
      restoredItems.push('paths');
    }
  }

  if (selected.has('conditions')) {
    const conditions = await readJsonIfExists(path.join(configSrcDir, 'conditions.json'));
    if (conditions) {
      await configService.writeConditions(conditions);
      restored++;
      restoredItems.push('conditions');
    }
  }

  if (selected.has('siteConfig')) {
    const siteConfig = await readJsonIfExists(path.join(configSrcDir, 'site.json'));
    if (siteConfig) {
      await configService.writeSiteConfig(siteConfig);
      restored++;
      restoredItems.push('siteConfig');
    }
  }

  logger.info(`配置快照已恢复: ${restoredItems.join(', ') || '无'}`);
  return { restored, items: restoredItems };
}

// 从 SQL dump 恢复数据库
async function restoreDatabaseFromDump(rootDir) {
  const dumpPath = path.join(rootDir, 'database', 'taotu_gallery.sql');
  if (!fsSync.existsSync(dumpPath)) {
    throw { statusCode: 400, message: '备份中未找到数据库 dump' };
  }

  try {
    const args = [
      `--host=${process.env.DB_HOST}`,
      `--port=${process.env.DB_PORT || 3306}`,
      `--user=${process.env.DB_USER}`,
      `--password=${Object.prototype.hasOwnProperty.call(process.env, 'DB_PASSWORD') ? process.env.DB_PASSWORD : ''}`,
      process.env.DB_NAME
    ];
    await runMysqlRestore(args, dumpPath);
    logger.info('数据库已恢复');
    return { restored: true };
  } catch (err) {
    logger.error(`数据库恢复失败: ${err.message}`);
    throw err;
  }
}

async function runMysqlRestore(args, dumpPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('mysql', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const input = fsSync.createReadStream(dumpPath);
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `mysql exited with code ${code}`));
    });
    input.on('error', reject);
    input.pipe(child.stdin);
  });
}

// 恢复本地图库文件
async function restoreGalleryFiles(rootDir) {
  const gallerySrc = path.join(rootDir, 'gallery');
  const uploadsSrc = path.join(rootDir, 'uploads');

  let restored = 0;
  if (fsSync.existsSync(gallerySrc)) {
    restored += await copyDirectoryRecursive(gallerySrc, config.galleryDir);
  }
  if (fsSync.existsSync(uploadsSrc)) {
    restored += await copyDirectoryRecursive(uploadsSrc, config.uploadsDir);
  }

  if (!restored) logger.warn('备份中未找到图库或上传目录');
  logger.info(`图库文件已恢复: ${restored} 个文件`);
  return { restored };
}

// 恢复自定义路径图片
async function restoreCustomPathFiles(rootDir) {
  const customSrc = path.join(rootDir, 'custom_paths');
  if (!fsSync.existsSync(customSrc)) {
    return { restored: 0 };
  }

  let restored = 0;
  const entries = await fs.readdir(customSrc, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const srcPath = path.join(customSrc, entry.name);
      // 自定义路径图片恢复到本地图库下的对应目录
      const destPath = path.join(config.galleryDir, 'custom', entry.name);
      restored += await copyDirectoryRecursive(srcPath, destPath);
    }
  }

  logger.info(`自定义路径图片已恢复: ${restored} 个文件`);
  return { restored };
}

// 【核心】规范化所有图片路径 — 绝对路径强制转相对路径
async function normalizeAllImagePaths() {
  const images = await db('images').select('id', 'path', 'original_path');
  let normalized = 0;
  let alreadyRelative = 0;
  let errors = 0;

  for (const image of images) {
    try {
      const currentPath = image.path;

      // 已经是相对路径则跳过
      if (!path.isAbsolute(currentPath)) {
        alreadyRelative++;
        continue;
      }

      // 转为相对路径
      const relativePath = pathUtils.toRelativePath(currentPath);

      // 校验路径安全性
      if (!pathUtils.isPathSafe(relativePath)) {
        logger.warn(`路径不安全，跳过: ${currentPath}`);
        errors++;
        continue;
      }

      await db('images').where({ id: image.id }).update({
        path: relativePath,
        original_path: currentPath // 保留原始绝对路径
      });

      normalized++;
    } catch (err) {
      logger.error(`路径规范化失败: 图片 ${image.id} - ${err.message}`);
      errors++;
    }
  }

  logger.info(`路径规范化完成: 转换 ${normalized}, 已相对 ${alreadyRelative}, 错误 ${errors}`);
  return { normalized, alreadyRelative, errors, total: images.length };
}

// 递归复制目录
async function copyDirectoryRecursive(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  let count = 0;

  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += await copyDirectoryRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
      count++;
    }
  }

  return count;
}

// 校验恢复后所有路径可读性
async function verifyRestoredPaths() {
  const images = await db('images').select('id', 'path');
  let readable = 0;
  let unreadable = 0;
  const unreadableIds = [];

  for (const image of images) {
    const fullPath = pathUtils.toAbsolutePath(image.path);
    try {
      await fs.access(fullPath);
      readable++;
    } catch {
      unreadable++;
      unreadableIds.push(image.id);
    }
  }

  return {
    total: images.length,
    readable,
    unreadable,
    unreadableIds: unreadableIds.slice(0, 100) // 最多返回 100 个
  };
}

export default {
  inspectBackup,
  restoreFromBackup,
  normalizeAllImagePaths,
  verifyRestoredPaths
};
