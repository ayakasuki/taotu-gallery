/**
 * URL 上传 API — 通过图片URL下载并索引
 */
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../../middleware/auth');
const config = require('../../config');
const imageProcessor = require('../../utils/imageProcessor');
const pathUtils = require('../../utils/pathUtils');
const imageService = require('../../services/imageService');
const db = require('../../db');
const logger = require('../../config/logger');

const router = express.Router();

// 下载图片到本地
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const contentType = res.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) {
        return reject(new Error('不是图片文件'));
      }

      const ext = contentType.split('/')[1]?.split(';')[0] || 'jpg';
      const filename = `${uuidv4()}.${ext}`;
      const today = new Date().toISOString().split('T')[0];
      const uploadDir = path.join(config.uploadsDir, today);
      fs.mkdirSync(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, filename);
      const ws = fs.createWriteStream(filePath);
      res.pipe(ws);
      ws.on('finish', () => resolve({ filePath, filename, ext, today }));
      ws.on('error', reject);
    }).on('error', reject);
  });
}

// URL 上传
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: '请提供图片 URL' });

    const { filePath, filename, ext, today } = await downloadImage(url);
    const relativePath = pathUtils.toRelativePath(filePath);

    // 获取元信息
    const meta = await imageProcessor.getImageMeta(filePath);
    await imageProcessor.generateThumbnails(filePath);

    const hashPath = imageService.generateHashPath(filename);
    const fileSize = fs.statSync(filePath).size;

    const [imageId] = await db('images').insert({
      filename,
      path: relativePath,
      hash_path: hashPath,
      width: meta.width,
      height: meta.height,
      size_bytes: fileSize,
      mime_type: `image/${ext}`,
      avg_color: meta.avg_color,
      orientation: meta.orientation,
      upload_source: 'api',
      uploader_id: req.user?.id
    });

    // 立即对新图片执行条件标签
    try {
      const conditionTagService = require('../../services/conditionTagService');
      const matchedConditions = await conditionTagService.tagImageByConditions(imageId);
      if (matchedConditions.length > 0) {
        for (const cond of matchedConditions) {
          await db('image_tags').insert({
            image_id: imageId,
            tag_id: cond.id,
            source: 'condition',
            source_detail: `condition_${cond.id}`
          }).onConflict(['image_id', 'tag_id']).ignore();
        }
        logger.info(`URL上传条件标签: ${filename} 匹配 ${matchedConditions.length} 个条件`);
      }
    } catch (condErr) {
      logger.warn(`URL上传条件标签执行失败: ${condErr.message}`);
    }

    const urls = imageService.buildImageUrls({ hash_path: hashPath });
    logger.info(`URL上传成功: ${url} -> ${hashPath}`);

    res.json({
      success: true,
      id: imageId,
      filename,
      hash_path: hashPath,
      url: urls.url
    });
  } catch (err) {
    logger.error(`URL上传失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
