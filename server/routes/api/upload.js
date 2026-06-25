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

    const userId = req.user ? req.user.id : null;

    // 配额检查
    for (const file of req.files) {
      const quotaCheck = await uploadService.checkUserQuota(userId, file.size);
      if (!quotaCheck.ok) {
        return res.status(413).json({ error: quotaCheck.error });
      }
    }

    const albumId = req.body.album_id ? parseInt(req.body.album_id) : null;
    let tags = req.body.tags ? JSON.parse(req.body.tags) : [];
    const newTags = req.body.newTags ? JSON.parse(req.body.newTags) : [];

    // 处理新标签：写入 tags.json
    if (newTags.length > 0) {
      const currentTags = await configService.readTags();
      // 计算不冲突的新 ID
      const allExisting = [...(currentTags.combinable || []), ...(currentTags.nonCombinable || [])];
      const maxId = allExisting.reduce((max, t) => Math.max(max, typeof t.id === 'number' ? t.id : 0), 0);
      if (!currentTags.nextId || currentTags.nextId <= maxId) {
        currentTags.nextId = maxId + 1;
      }

      for (const tagName of newTags) {
        const existing = allExisting.find(t => t.name === tagName);
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

    // 分离公共标签和用户标签（u前缀为用户标签）
    const publicTags = tags.filter(id => typeof id === 'number' || (typeof id === 'string' && !String(id).startsWith('u')));
    const userTagIds = tags.filter(id => typeof id === 'string' && String(id).startsWith('u')).map(id => parseInt(String(id).substring(1)));

    const results = await uploadService.processUploadedFiles(req.files, albumId, publicTags, userId, req.body.is_public === '1', userTagIds);

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
