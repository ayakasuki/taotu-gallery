/**
 * 对外 API - 图片上传（需登录）
 */
const express = require('express');
const uploadService = require('../../services/uploadService');
const authMiddleware = require('../../middleware/auth');
const db = require('../../db');

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
    const user = await db('users').where({ id: userId }).first();
    const isAdmin = user?.role === 'admin';

    // 处理新标签：管理员创建公共标签，普通用户创建自己的私有标签
    if (newTags.length > 0) {
      for (const tagName of newTags) {
        if (isAdmin) {
          const existing = await db('tags').where({ name: tagName }).first();
          if (existing) {
            tags.push(existing.id);
          } else {
            const maxRow = await db('tags').max('id as maxId').first();
            const newId = (maxRow?.maxId || 0) + 1;
            await db('tags').insert({
              id: newId, name: tagName, display_name: tagName,
              combinable: true, is_public: true, tag_type: 'manual'
            });
            tags.push(newId);
          }
        } else {
          const existing = await db('user_tags').where({ user_id: userId, name: tagName }).first();
          if (existing) {
            tags.push(`u${existing.id}`);
          } else {
            const [id] = await db('user_tags').insert({
              user_id: userId,
              name: tagName,
              display_name: tagName,
              combinable: true,
              is_public: false
            });
            tags.push(`u${id}`);
          }
        }
      }
    }

    if (!isAdmin) {
      const requestedUserTagIds = tags
        .filter(id => typeof id === 'string' && id.startsWith('u'))
        .map(id => parseInt(id.substring(1)));
      if (requestedUserTagIds.length > 0) {
        const ownedTags = await db('user_tags')
          .where({ user_id: userId })
          .whereIn('id', requestedUserTagIds)
          .select('id');
        const ownedIds = new Set(ownedTags.map(tag => tag.id));
        tags = requestedUserTagIds.filter(id => ownedIds.has(id)).map(id => `u${id}`);
      } else {
        tags = [];
      }
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
