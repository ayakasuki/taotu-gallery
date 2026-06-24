/**
 * 恢复服务
 * 从 .zip 备份包恢复数据库、图片、配置文件
 * 核心风险：路径相对化必须贯穿整个恢复流程
 */
const unzipper = require('unzipper');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const db = require('../db');
const config = require('../config');
const pathUtils = require('../utils/pathUtils');
const logger = require('../config/logger');

// 从备份包恢复
async function restoreFromBackup(backupPath, options = {}) {
  const {
    restoreDatabase = true,
    restoreGallery = true,
    restoreCustomPaths = true,
    restoreConfig = true
  } = options;

  if (!fsSync.existsSync(backupPath)) {
    throw { statusCode: 404, message: '备份文件不存在' };
  }

  // 解压到临时目录
  const tempDir = path.join(config.backupsDir, '.restore_temp');
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // 解压
    await extractZip(backupPath, tempDir);
    logger.info(`备份已解压到: ${tempDir}`);

    // 查找项目根目录（压缩包内可能是 "项目名/" 的形式）
    const rootDir = await findProjectRoot(tempDir);
    logger.info(`项目根目录: ${rootDir}`);

    const results = {};

    // 1. 恢复配置文件
    if (restoreConfig) {
      results.config = await restoreConfigFiles(rootDir);
    }

    // 2. 恢复数据库
    if (restoreDatabase) {
      results.database = await restoreDatabaseFromDump(rootDir);
    }

    // 3. 恢复本地图库
    if (restoreGallery) {
      results.gallery = await restoreGalleryFiles(rootDir);
    }

    // 4. 恢复自定义路径图片
    if (restoreCustomPaths) {
      results.customPaths = await restoreCustomPathFiles(rootDir);
    }

    // 5. 关键步骤：路径相对化
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
async function restoreConfigFiles(rootDir) {
  const configSrcDir = path.join(rootDir, 'config');
  if (!fsSync.existsSync(configSrcDir)) {
    logger.warn('备份中未找到配置文件目录');
    return { restored: 0 };
  }

  let restored = 0;
  const configFiles = ['tags.json', 'paths.json', 'conditions.json', 'site.json'];

  for (const file of configFiles) {
    const srcPath = path.join(configSrcDir, file);
    const destPath = path.join(config.configDir, file);

    if (fsSync.existsSync(srcPath)) {
      await fs.copyFile(srcPath, destPath);
      restored++;
      logger.info(`配置文件已恢复: ${file}`);
    }
  }

  return { restored };
}

// 从 SQL dump 恢复数据库
async function restoreDatabaseFromDump(rootDir) {
  const dumpPath = path.join(rootDir, 'database', 'taotu_gallery.sql');
  if (!fsSync.existsSync(dumpPath)) {
    logger.warn('备份中未找到数据库 dump');
    return { restored: false };
  }

  try {
    const cmd = `mysql -u ${process.env.DB_USER} -p'${process.env.DB_PASSWORD}' ${process.env.DB_NAME} < "${dumpPath}"`;
    await execAsync(cmd);
    logger.info('数据库已恢复');
    return { restored: true };
  } catch (err) {
    logger.error(`数据库恢复失败: ${err.message}`);
    return { restored: false, error: err.message };
  }
}

// 恢复本地图库文件
async function restoreGalleryFiles(rootDir) {
  const gallerySrc = path.join(rootDir, 'gallery');
  if (!fsSync.existsSync(gallerySrc)) {
    logger.warn('备份中未找到图库目录');
    return { restored: 0 };
  }

  let restored = 0;
  restored = await copyDirectoryRecursive(gallerySrc, config.galleryDir);
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

module.exports = {
  restoreFromBackup,
  normalizeAllImagePaths,
  verifyRestoredPaths
};
