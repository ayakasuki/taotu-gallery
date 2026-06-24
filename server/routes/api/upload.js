/**
 * 对外 API - 图片上传（需登录）
 */
const express = require('express');
const uploadService = require('../../services/uploadService');
const configService = require('../../services/configService');
const authMiddleware = require('../../middleware/auth');

const router = express.Router();

// 单上传 / 批量上传（需登录）
router.post('/', authMiddleware, uploadService.upload.array('files', 100), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }

    const albumId = req.body.album_id ? parseInt(req.body.album_id) : null;
    let tags = req.body.tags ? JSON.parse(req.body.tags) : [];
    const newTags = req.body.newTags ? JSON.parse(req.body.newTags) : [];
    const userId = req.user ? req.user.id : null;

    // 处理新标签：写入 tags.json
    if (newTags.length > 0) {
      const currentTags = await configService.readTags();
      if (!currentTags.nextId) currentTags.nextId = 1;
      for (const tagName of newTags) {
        const existing = (currentTags.combinable || []).find(t => t.name === tagName) ||
                        (currentTags.nonCombinable || []).find(t => t.name === tagName);
        if (!existing) {
          const newId = currentTags.nextId++;
          if (!currentTags.combinable) currentTags.combinable = [];
          currentTags.combinable.push({ id: newId, name: tagName, display_name: tagName, combinable: true });
          tags.push(newId);
        } else {
          tags.push(existing.id);
        }
      }
      await configService.writeTags(currentTags);
    }

    const results = await uploadService.processUploadedFiles(req.files, albumId, tags, userId, req.body.is_public === '1');

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      message: `上传完成: ${successCount} 成功, ${failCount} 失败`,
      results
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
