/**
 * 图片处理工具
 * 使用 sharp 生成缩略图、中等图，分析颜色和分辨率
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const config = require('../config');
const logger = require('../config/logger');

// 生成缩略图和中等图
async function generateThumbnails(imagePath, options = {}) {
  const ext = path.extname(imagePath);
  const baseName = path.basename(imagePath, ext);
  const dirName = path.dirname(imagePath);

  const thumbDir = path.join(dirName, '.thumbs');
  await fs.mkdir(thumbDir, { recursive: true });

  const mediumW = options.mediumWidth || config.thumbnails.medium.width;
  const mediumH = options.mediumHeight || config.thumbnails.medium.height;

  // 缩略图
  const thumbPath = path.join(thumbDir, `${baseName}_thumb${ext}`);
  await sharp(imagePath)
    .resize(config.thumbnails.small.width, config.thumbnails.small.height, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toFile(thumbPath);

  // 中等图（质量稍高）
  const mediumPath = path.join(thumbDir, `${baseName}_medium${ext}`);
  await sharp(imagePath)
    .resize(mediumW, mediumH, { fit: 'inside' })
    .jpeg({ quality: 90 })
    .toFile(mediumPath);

  return { thumbPath, mediumPath };
}

function calculateOrientation(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error('图片缺少有效像素尺寸');
  }
  const ratio = w / h;
  if (ratio >= 0.9 && ratio <= 1.1) return 'square';
  return ratio > 1.1 ? 'landscape' : 'portrait';
}

// 获取图片元信息
async function getImageMeta(imagePath) {
  const metadata = await sharp(imagePath).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('图片缺少有效像素尺寸，已拒绝处理');
  }
  const stats = await sharp(imagePath).stats();

  // 计算平均颜色
  const channels = stats.channels;
  const r = Math.round(channels[0].mean);
  const g = Math.round(channels[1].mean);
  const b = Math.round(channels[2].mean);
  const avgColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

  // 判断横竖正方，0.9-1.1 视为正方图，三者严格互斥
  const orientation = calculateOrientation(metadata.width, metadata.height);

  return {
    width: metadata.width,
    height: metadata.height,
    mime_type: metadata.format ? `image/${metadata.format}` : null,
    avg_color: avgColor,
    orientation
  };
}

// 检查图片分辨率是否达标
function checkResolution(width, height, minLevel) {
  const levels = {
    '480p': { w: 640, h: 480 },
    '720p': { w: 1280, h: 720 },
    '1080p': { w: 1920, h: 1080 }
  };
  const level = levels[minLevel];
  if (!level) return false;
  return width >= level.w || height >= level.h;
}

// 检测图片是否包含特定颜色
async function checkColorPresence(imagePath, targetHex, minRatio = 0.1) {
  const { dominant } = await sharp(imagePath).stats();
  // 简化实现：检查主色调是否接近目标颜色
  const target = hexToRgb(targetHex);
  if (!dominant || dominant.length < 3) return false;

  const dr = Math.abs(dominant[0] - target.r);
  const dg = Math.abs(dominant[1] - target.g);
  const db = Math.abs(dominant[2] - target.b);
  const distance = Math.sqrt(dr * dr + dg * dg + db * db);

  return distance < 100; // 颜色距离阈值
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

module.exports = {
  generateThumbnails,
  getImageMeta,
  calculateOrientation,
  checkResolution,
  checkColorPresence
};
