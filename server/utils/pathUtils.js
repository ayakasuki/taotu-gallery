import path from 'path';
import config from '../config/index.js';

// 将绝对路径转为相对路径（基准：项目根目录）
function toRelativePath(absolutePath) {
  if (!absolutePath) return absolutePath;
  // 已经是相对路径则直接返回
  if (!path.isAbsolute(absolutePath)) return absolutePath;
  return path.relative(config.projectRoot, absolutePath);
}

// 将相对路径转为绝对路径
function toAbsolutePath(relativePath) {
  if (!relativePath) return relativePath;
  if (path.isAbsolute(relativePath)) return relativePath;
  return path.resolve(config.projectRoot, relativePath);
}

// 校验路径是否在项目目录内（安全检查）
function isPathSafe(targetPath) {
  const resolved = path.resolve(config.projectRoot, targetPath);
  return resolved.startsWith(config.projectRoot);
}

// 从文件路径提取相对于图库目录的路径
function relativeToGallery(filePath) {
  return path.relative(config.galleryDir, filePath);
}

// 规范化路径分隔符（统一为 /）
function normalizePath(filePath) {
  if (!filePath) return filePath;
  return filePath.replace(/\\/g, '/');
}

export default {
  toRelativePath,
  toAbsolutePath,
  isPathSafe,
  relativeToGallery,
  normalizePath
};
