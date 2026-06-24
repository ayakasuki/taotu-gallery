/**
 * 图库路径监听服务
 * 使用 chokidar 监听本地图库和自定义路径变化
 */
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const configService = require('./configService');
const imageService = require('./imageService');
const logger = require('../config/logger');

let watcher = null;
const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

// 启动监听
async function startWatching() {
  if (watcher) {
    logger.warn('图库路径监听已在运行');
    return;
  }

  const pathsConfig = await configService.readPaths();
  const watchPaths = [config.galleryDir];

  // 添加自定义路径
  if (pathsConfig.customPaths) {
    for (const cp of pathsConfig.customPaths) {
      if (cp.path && fs.existsSync(cp.path)) {
        watchPaths.push(cp.path);
      }
    }
  }

  logger.info(`开始监听图库路径: ${watchPaths.join(', ')}`);

  watcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: false,
    depth: 3, // 默认递归 3 层
    ignored: /(^|[\/\\])\.|node_modules/,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
  });

  watcher.on('add', async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!imageExts.includes(ext)) return;

    logger.info(`检测到新图片: ${filePath}`);
    await handleNewImage(filePath);
  });

  watcher.on('unlink', async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!imageExts.includes(ext)) return;

    logger.info(`图片已删除: ${filePath}`);
    await handleDeletedImage(filePath);
  });

  watcher.on('error', (error) => {
    logger.error(`图库路径监听错误: ${error.message}`);
  });
}

// 处理新图片
async function handleNewImage(filePath) {
  const db = require('../db');
  const pathUtils = require('../utils/pathUtils');
  const imageProcessor = require('../utils/imageProcessor');

  try {
    const relativePath = pathUtils.toRelativePath(filePath);
    const filename = path.basename(filePath);

    // 检查是否已存在
    const existing = await db('images').where({ path: relativePath }).first();
    if (existing) return;

    // 获取图片元信息
    const meta = await imageProcessor.getImageMeta(filePath);
    const fileSize = fs.statSync(filePath).size;

    // 插入数据库
    const hashPath = imageService.generateHashPath(filename);
    await db('images').insert({
      filename,
      path: relativePath,
      hash_path: hashPath,
      width: meta.width,
      height: meta.height,
      size_bytes: fileSize,
      mime_type: meta.mime_type,
      avg_color: meta.avg_color,
      orientation: meta.orientation,
      upload_source: 'local'
    });

    logger.info(`新图片已索引: ${filename} -> ${hashPath}`);

    // 对新图片执行条件标签
    try {
      const conditionTagService = require('./conditionTagService');
      const newImage = await db('images').where({ path: relativePath }).first();
      if (newImage) {
        const matched = await conditionTagService.tagImageByConditions(newImage.id);
        if (matched.length > 0) {
          for (const cond of matched) {
            await db('image_tags').insert({
              image_id: newImage.id,
              tag_id: cond.id,
              source: 'condition',
              source_detail: `condition_${cond.id}`
            }).onConflict(['image_id', 'tag_id']).ignore();
          }
          logger.info(`新图片条件标签: ${filename} 匹配 ${matched.length} 个条件`);
        }
      }
    } catch (condErr) {
      logger.warn(`新图片条件标签执行失败: ${condErr.message}`);
    }
  } catch (err) {
    logger.error(`图片索引失败: ${filePath} - ${err.message}`);
  }
}

// 处理删除的图片
async function handleDeletedImage(filePath) {
  const db = require('../db');
  const pathUtils = require('../utils/pathUtils');

  try {
    const relativePath = pathUtils.toRelativePath(filePath);
    await db('images').where({ path: relativePath }).del();
    logger.info(`图片记录已删除: ${relativePath}`);
  } catch (err) {
    logger.error(`图片删除处理失败: ${filePath} - ${err.message}`);
  }
}

// 停止监听
function stopWatching() {
  if (watcher) {
    watcher.close();
    watcher = null;
    logger.info('图库路径监听已停止');
  }
}

// 扫描并索引所有图片
async function scanAndIndexAll() {
  const db = require('../db');
  const pathUtils = require('../utils/pathUtils');
  const imageProcessor = require('../utils/imageProcessor');

  const pathsConfig = await configService.readPaths();
  const scanPaths = [config.galleryDir];

  if (pathsConfig.customPaths) {
    for (const cp of pathsConfig.customPaths) {
      if (cp.path && fs.existsSync(cp.path)) {
        scanPaths.push(cp.path);
      }
    }
  }

  let added = 0;
  let skipped = 0;

  for (const scanPath of scanPaths) {
    await scanDirectory(scanPath, async (filePath) => {
      const relativePath = pathUtils.toRelativePath(filePath);
      const existing = await db('images').where({ path: relativePath }).first();
      if (existing) {
        skipped++;
        return;
      }

      try {
        const meta = await imageProcessor.getImageMeta(filePath);
        const fileSize = fs.statSync(filePath).size;
        const hashPath = imageService.generateHashPath(path.basename(filePath));

        await db('images').insert({
          filename: path.basename(filePath),
          path: relativePath,
          hash_path: hashPath,
          width: meta.width,
          height: meta.height,
          size_bytes: fileSize,
          mime_type: meta.mime_type,
          avg_color: meta.avg_color,
          orientation: meta.orientation,
          upload_source: 'local'
        });
        added++;
      } catch (err) {
        logger.error(`索引失败: ${filePath} - ${err.message}`);
      }
    });
  }

  logger.info(`扫描完成: 新增 ${added}, 跳过 ${skipped}`);

  // 扫描完成后对所有图片执行条件标签
  if (added > 0) {
    try {
      const conditionTagService = require('./conditionTagService');
      logger.info('扫描完成，开始执行条件标签...');
      const tagResult = await conditionTagService.tagImagesByConditions(null, null, false);
      logger.info(`条件标签完成: 标记 ${tagResult.tagged} 张图片`);
    } catch (condErr) {
      logger.warn(`扫描后条件标签执行失败: ${condErr.message}`);
    }
  }

  return { added, skipped };
}

// 递归扫描目录
async function scanDirectory(dirPath, callback) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      await scanDirectory(fullPath, callback);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (imageExts.includes(ext)) {
        await callback(fullPath);
      }
    }
  }
}

module.exports = {
  startWatching,
  stopWatching,
  scanAndIndexAll
};
