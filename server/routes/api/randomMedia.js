import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import db from '../../db/index.js';
import config from '../../config/index.js';
import imageProcessor from '../../utils/imageProcessor.js';
import { getTokenPermissions } from '../../utils/apiTokenPolicy.js';
import { verifyTemporaryMedia } from '../../utils/temporaryMedia.js';
import { isPrivacyModeEnabled } from '../../middleware/privacyMode.js';
import { isUnsafeImage } from '../../utils/albumPrivacy.js';

const router = express.Router();

router.get('/:imageId/:size', async (req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  res.set('Referrer-Policy', 'no-referrer');
  try {
    const { imageId, size } = req.params;
    const { tid, exp, scope, sig, uid = 0 } = req.query;
    if (typeof sig !== 'string' || !/^[a-f0-9]{64}$/i.test(sig)) {
      return res.status(403).json({ error: '临时图片链接缺少有效签名，请重新请求随机接口' });
    }
    if (!verifyTemporaryMedia({ imageId, size, scope, tokenId: tid, userId: uid, expires: exp, sig, secret: process.env.JWT_SECRET })) {
      return res.status(403).json({ error: '临时图片链接无效或已过期' });
    }
    let user = null;
    if (Number(tid) > 0) {
      const token = await db('api_tokens').where({ id: tid }).first();
      const permissions = token ? getTokenPermissions(token) : [];
      if (!permissions.includes(scope) && !permissions.includes('admin:manage')) {
        return res.status(403).json({ error: '签发此链接的 Token 已撤销或权限已变更' });
      }
      user = await db('users').where({ id: token.user_id }).first();
    } else if (Number(uid) > 0) {
      user = await db('users').where({ id: uid }).first();
    }
    if ((Number(tid) > 0 || Number(uid) > 0) && (!user || user.is_disabled || user.review_status === 'pending')) {
      return res.status(403).json({ error: '临时链接所属用户不可用' });
    }
    if (!user && await isPrivacyModeEnabled()) return res.status(403).json({ error: '网站已开启隐私模式，请登录后访问' });
    const image = await db('images').where({ id: imageId }).first();
    if (!image) return res.status(404).json({ error: '图片不存在' });
    const album = image.album_id ? await db('albums').where({ id: image.album_id }).select('is_public', 'is_private').first() : null;
    if (album?.is_private) return res.status(403).json({ error: '私密相册图片不允许通过对外接口访问' });
    const isOwner = !!user && Number(image.uploader_id) === Number(user.id);
    const isAdmin = user?.role === 'admin';
    const isPublic = !!image.is_public || !!album?.is_public;
    if (isUnsafeImage(image) || (!isAdmin && !isOwner && !isPublic)) {
      return res.status(403).json({ error: '无权访问此图片' });
    }
    const realPath = path.resolve(config.projectRoot, image.path);
    let filePath = realPath;
    if (size !== 'full') {
      filePath = imageProcessor.getExistingThumbnailPath(realPath, size).find(candidate => fs.existsSync(candidate));
      if (!filePath && fs.existsSync(realPath)) {
        await imageProcessor.generateDerivedThumbnails(realPath);
        filePath = imageProcessor.getExistingThumbnailPath(realPath, size).find(candidate => fs.existsSync(candidate));
      }
      filePath ||= realPath;
    }
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '图片文件不存在' });
    return res.sendFile(filePath);
  } catch (error) { next(error); }
});

export default router;
