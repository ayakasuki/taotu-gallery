const express = require('express');
const authMiddleware = require('../../middleware/auth');
const db = require('../../db');
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');
const logger = require('../../config/logger');
const imageProcessor = require('../../utils/imageProcessor');

const router = express.Router();

function normalizeTagName(name) {
  return String(name || '').trim();
}

function createUserTagError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function parsePositiveInt(value, fallback, max = 100) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function normalizeBytes(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.floor(parsed);
}

function toNumber(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function requireAdminUser(req) {
  const user = await db('users').where({ id: req.user.id }).first();
  if (user?.role !== 'admin') throw createUserTagError('仅管理员可操作', 403);
  return user;
}

async function cleanupUserData(userId, user) {
  const tokenCount = await db('api_tokens').where({ user_id: userId }).del();
  logger.info(`删除用户 ${userId} 的 ${tokenCount} 个 Token`);

  const userTagIds = await db('user_tags').where({ user_id: userId }).select('id');
  for (const ut of userTagIds) {
    await db('image_tags').where({ user_tag_id: ut.id }).del();
  }
  const tagCount = await db('user_tags').where({ user_id: userId }).del();
  logger.info(`删除用户 ${userId} 的 ${tagCount} 个私有标签`);

  const userImages = await db('images').where({ uploader_id: userId }).select('id', 'path');
  const imageIds = userImages.map(img => img.id);
  if (imageIds.length > 0) {
    await db('image_tags').whereIn('image_id', imageIds).del();
    let deletedFiles = 0;
    for (const img of userImages) {
      if (img.path) {
        const fullPath = path.resolve(config.projectRoot, img.path);
        try {
          await fs.unlink(fullPath);
          for (const thumbPath of imageProcessor.getExistingThumbnailPath(fullPath, 'thumb')) await fs.unlink(thumbPath).catch(() => {});
          for (const mediumPath of imageProcessor.getExistingThumbnailPath(fullPath, 'medium')) await fs.unlink(mediumPath).catch(() => {});
          await imageProcessor.removeDerivedThumbnailsForImage(fullPath).catch(() => {});
          deletedFiles++;
        } catch {}
      }
    }
    logger.info(`删除用户 ${userId} 的 ${deletedFiles} 个图片文件`);
    await db('images').whereIn('id', imageIds).del();
    logger.info(`删除用户 ${userId} 的 ${imageIds.length} 条图片记录`);
  }

  const userAlbums = await db('albums').where({ user_id: userId }).select('id');
  const albumIds = userAlbums.map(a => a.id);
  if (albumIds.length > 0) {
    await db('album_tags').whereIn('album_id', albumIds).del();
    await db('albums').whereIn('id', albumIds).del();
    logger.info(`删除用户 ${userId} 的 ${albumIds.length} 个相册`);
  }

  await db('upload_logs').where({ user_id: userId }).del();
  await db('users').where({ id: userId }).del();
  logger.info(`用户 ${user.username} (ID:${userId}) 已彻底删除`);

  return { tokenCount, tagCount, imageIds, albumIds };
}

async function assertUserTagNameAvailable(userId, name) {
  const normalizedName = normalizeTagName(name);
  if (!normalizedName) throw createUserTagError('标签名不能为空');

  const existing = await db('user_tags')
    .where({ user_id: userId })
    .whereRaw('LOWER(name) = LOWER(?)', [normalizedName])
    .first();
  if (existing) throw createUserTagError(`私有标签名「${normalizedName}」已存在，请换一个名称`, 409);
  return normalizedName;
}

// 用户列表（含存储用量、状态筛选和分页）
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    await requireAdminUser(req);

    const all = ['true', '1', 'yes'].includes(String(req.query.all || '').toLowerCase());
    const page = all ? 1 : parsePositiveInt(req.query.page, 1, 100000);
    const pageSize = all
      ? parsePositiveInt(req.query.pageSize || req.query.limit, 10000, 10000)
      : parsePositiveInt(req.query.pageSize || req.query.limit, 10, 100);
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || 'all');
    const status = String(req.query.status || 'all');

    const imageUsage = db('images')
      .select('uploader_id')
      .sum({ used_storage: 'size_bytes' })
      .count({ image_count: 'id' })
      .whereNotNull('uploader_id')
      .groupBy('uploader_id')
      .as('img');

    const baseQuery = db('users as u')
      .leftJoin(imageUsage, 'img.uploader_id', 'u.id');

    if (search) {
      baseQuery.where((builder) => {
        builder
          .where('u.username', 'like', `%${search}%`)
          .orWhere('u.email', 'like', `%${search}%`);
      });
    }

    if (role === 'admin' || role === 'user') {
      baseQuery.where('u.role', role);
    }

    if (status === 'enabled') {
      baseQuery.where((builder) => builder.where('u.is_disabled', false).orWhereNull('u.is_disabled'))
        .where((builder) => builder.where('u.review_status', 'approved').orWhereNull('u.review_status'));
    } else if (status === 'disabled') {
      baseQuery.where('u.is_disabled', true);
    } else if (status === 'pending') {
      baseQuery.where('u.review_status', 'pending');
    }

    const totalRow = await baseQuery.clone().clearSelect().count({ total: 'u.id' }).first();
    const total = toNumber(totalRow?.total);
    const listQuery = baseQuery
      .clone()
      .select(
        'u.id',
        'u.username',
        'u.email',
        'u.avatar',
        'u.role',
        'u.storage_limit',
        'u.max_file_size',
        'u.last_login_at',
        'u.last_login_ip',
        'u.created_at',
        'u.is_disabled',
        'u.review_status',
        db.raw('COALESCE(img.used_storage, 0) as used_storage'),
        db.raw('COALESCE(img.image_count, 0) as image_count')
      )
      .orderBy('u.created_at', 'desc');

    if (all) {
      listQuery.limit(pageSize);
    } else {
      listQuery.limit(pageSize).offset((page - 1) * pageSize);
    }

    const users = await listQuery;

    res.json({
      users: users.map((user) => ({
        ...user,
        is_disabled: !!user.is_disabled,
        review_status: user.review_status || 'approved',
        used_storage: toNumber(user.used_storage),
        image_count: toNumber(user.image_count),
        storage_limit: toNumber(user.storage_limit),
        max_file_size: toNumber(user.max_file_size)
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize))
      }
    });
  } catch (err) {
    next(err);
  }
});

// 获取指定用户的私有标签（管理员编辑用户图片时使用）
router.get('/:id/tags', authMiddleware, async (req, res) => {
  const currentUser = await db('users').where({ id: req.user.id }).first();
  const targetUserId = parseInt(req.params.id);
  if (currentUser?.role !== 'admin' && targetUserId !== req.user.id) {
    return res.status(403).json({ error: '无权查看此用户标签' });
  }
  const tags = await db('user_tags')
    .where({ user_id: targetUserId })
    .select('id', 'user_id', 'name', 'display_name', 'combinable', 'is_public', 'mutually_exclusive_with', 'created_at');
  res.json({ tags });
});

// 管理员为指定用户创建私有标签（图片管理弹窗使用）
router.post('/:id/tags', authMiddleware, async (req, res, next) => {
  try {
    await requireAdminUser(req);
    const targetUserId = parseInt(req.params.id);
    const targetUser = await db('users').where({ id: targetUserId }).first();
    if (!targetUser) return res.status(404).json({ error: '用户不存在' });

    const { name, display_name, combinable } = req.body;
    const normalizedName = await assertUserTagNameAvailable(targetUserId, name);
    const [id] = await db('user_tags').insert({
      user_id: targetUserId,
      name: normalizedName,
      display_name: display_name || normalizedName,
      combinable: combinable !== false,
      is_public: false,
      mutually_exclusive_with: null
    });

    const saved = await db('user_tags').where({ id, user_id: targetUserId }).first();
    res.json({
      id: saved.id,
      user_id: saved.user_id,
      name: saved.name,
      display_name: saved.display_name || saved.name,
      combinable: !!saved.combinable,
      is_public: !!saved.is_public,
      mutually_exclusive_with: saved.mutually_exclusive_with
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '私有标签名已存在，请换一个名称' });
    next(err);
  }
});

// 创建用户
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    await requireAdminUser(req);
    const bcrypt = require('bcryptjs');
    const { username, password, email, role, storage_limit, max_file_size } = req.body;
    const normalizedUsername = String(username || '').trim();
    const normalizedEmail = String(email || '').trim() || null;
    if (!normalizedUsername || !password) return res.status(400).json({ error: '请填写用户名和密码' });
    if (role && !['admin', 'user'].includes(role)) return res.status(400).json({ error: '角色无效' });

    const existing = await db('users').whereRaw('LOWER(username) = LOWER(?)', [normalizedUsername]).first();
    if (existing) return res.status(409).json({ error: '用户名已存在' });

    const passwordHash = await bcrypt.hash(password, 10);
    const [id] = await db('users').insert({
      username: normalizedUsername,
      password_hash: passwordHash,
      email: normalizedEmail,
      role: role || 'user',
      storage_limit: normalizeBytes(storage_limit),
      max_file_size: normalizeBytes(max_file_size),
      is_disabled: false,
      review_status: 'approved'
    });
    res.json({ id, username: normalizedUsername, email: normalizedEmail, role: role || 'user' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '用户名已存在' });
    next(err);
  }
});

// 更新用户
router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    await requireAdminUser(req);
    const target = await db('users').where({ id: req.params.id }).first();
    if (!target) return res.status(404).json({ error: '用户不存在' });

    const { email, role, storage_limit, max_file_size } = req.body;
    const updates = {};
    if (email !== undefined) updates.email = String(email || '').trim() || null;
    if (role !== undefined) {
      if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: '角色无效' });
      updates.role = role;
    }
    if (storage_limit !== undefined) updates.storage_limit = normalizeBytes(storage_limit);
    if (max_file_size !== undefined) updates.max_file_size = normalizeBytes(max_file_size);
    await db('users').where({ id: req.params.id }).update(updates);
    res.json({ message: '用户已更新' });
  } catch (err) {
    next(err);
  }
});

// 启用/禁用用户
router.patch('/:id/status', authMiddleware, async (req, res, next) => {
  try {
    await requireAdminUser(req);
    const userId = parseInt(req.params.id, 10);
    const disabled = !!req.body.disabled;
    if (userId === req.user.id && disabled) {
      return res.status(400).json({ error: '不能禁用当前登录账号' });
    }

    const target = await db('users').where({ id: userId }).first();
    if (!target) return res.status(404).json({ error: '用户不存在' });

    await db('users').where({ id: userId }).update({ is_disabled: disabled });
    res.json({ message: disabled ? '用户已禁用' : '用户已启用', is_disabled: disabled });
  } catch (err) {
    next(err);
  }
});

// 审核通过用户
router.patch('/:id/review/approve', authMiddleware, async (req, res, next) => {
  try {
    await requireAdminUser(req);
    const userId = parseInt(req.params.id, 10);
    const target = await db('users').where({ id: userId }).first();
    if (!target) return res.status(404).json({ error: '用户不存在' });
    if (target.role === 'admin') return res.status(400).json({ error: '管理员账号无需审核' });

    await db('users').where({ id: userId }).update({ review_status: 'approved', is_disabled: false });
    if (target.email) {
      const mailService = require('../../services/mailService');
      await mailService.sendAccountReviewApproved(target.email, target.username).catch((err) => {
        logger.warn(`审核通过邮件发送失败: ${target.email} - ${err.message}`);
      });
    }
    res.json({ message: '用户审核已通过', review_status: 'approved', is_disabled: false });
  } catch (err) {
    next(err);
  }
});

// 拒绝审核并删除用户
router.patch('/:id/review/reject', authMiddleware, async (req, res, next) => {
  try {
    await requireAdminUser(req);
    const userId = parseInt(req.params.id, 10);
    if (userId === req.user.id) return res.status(400).json({ error: '不能拒绝当前登录账号' });
    const target = await db('users').where({ id: userId }).first();
    if (!target) return res.status(404).json({ error: '用户不存在' });
    if (target.role === 'admin') return res.status(400).json({ error: '不能拒绝管理员账号' });

    await db('users').where({ id: userId }).update({ review_status: 'rejected', is_disabled: true });
    if (target.email) {
      const mailService = require('../../services/mailService');
      await mailService.sendAccountReviewRejected(target.email, target.username).catch((err) => {
        logger.warn(`审核拒绝邮件发送失败: ${target.email} - ${err.message}`);
      });
    }

    const cleaned = await cleanupUserData(userId, target);
    res.json({
      message: `已拒绝用户 ${target.username} 的审核申请并删除账户`,
      cleaned: {
        tokens: cleaned.tokenCount,
        tags: cleaned.tagCount,
        images: cleaned.imageIds.length,
        albums: cleaned.albumIds.length
      }
    });
  } catch (err) {
    next(err);
  }
});

// 删除用户（彻底清理：Token、相册、图片、标签、文件）
router.delete('/:id', authMiddleware, async (req, res, next) => {
  try {
    await requireAdminUser(req);
    const userId = parseInt(req.params.id);
    if (userId === req.user.id) return res.status(400).json({ error: '不能删除当前登录账号' });
    const user = await db('users').where({ id: userId }).first();
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (user.role === 'admin') return res.status(400).json({ error: '不能删除管理员账号' });

    const cleaned = await cleanupUserData(userId, user);

    res.json({
      message: `用户 ${user.username} 已彻底删除`,
      cleaned: {
        tokens: cleaned.tokenCount,
        tags: cleaned.tagCount,
        images: cleaned.imageIds.length,
        albums: cleaned.albumIds.length
      }
    });
  } catch (err) { next(err); }
});

module.exports = router;
