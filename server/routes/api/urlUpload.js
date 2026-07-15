/**
 * URL 上传 API — 通过图片URL下载并索引
 */
import express from 'express';

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import authMiddleware from '../../middleware/auth.js';
import logger from '../../config/logger.js';
import uploadService from '../../services/uploadService.js';

const router = express.Router();

// 下载图片到本地
function downloadImage(url, userId) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { timeout: 30000 }, async (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, userId).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const contentType = res.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) {
        return reject(new Error('不是图片文件'));
      }

      try {
        const ext = (contentType.split('/')[1]?.split(';')[0] || 'jpg').replace('jpeg', 'jpg');
        const sourceName = path.basename(new URL(url).pathname || `remote.${ext}`) || `remote.${ext}`;
        const originalname = path.extname(sourceName) ? sourceName : `${sourceName}.${ext}`;
        const target = await uploadService.prepareLocalUploadPath(originalname, userId);
        const filePath = path.join(target.dir, target.filename);
        const ws = fs.createWriteStream(filePath);
        res.pipe(ws);
        ws.on('finish', () => resolve({ filePath, filename: target.filename, mimetype: contentType.split(';')[0] }));
        ws.on('error', reject);
      } catch (err) {
        reject(err);
      }
    }).on('error', reject);
  });
}

// URL 上传
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: '请提供图片 URL' });

    const { filePath, filename, mimetype } = await downloadImage(url, req.user?.id);
    const fileSize = fs.statSync(filePath).size;
    const quotaCheck = await uploadService.checkUserQuota(req.user?.id, fileSize);
    if (!quotaCheck.ok) {
      fs.unlinkSync(filePath);
      return res.status(413).json({ error: quotaCheck.error });
    }

    const result = await uploadService.processUploadedFile({
      filename,
      originalname: filename,
      path: filePath,
      size: fileSize,
      mimetype
    }, null, [], req.user?.id, false, [], 'api');
    logger.info(`URL上传成功: ${url} -> ${result.hash_path}`);

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    logger.error(`URL上传失败: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

export default router;
