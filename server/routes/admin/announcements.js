/**
 * 管理后台 - 公告中心
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const db = require('../../db');

const router = express.Router();

async function requireAdmin(req, res, next) {
  try {
    const user = await db('users').where({ id: req.user.id }).select('role').first();
    if (user?.role !== 'admin') {
      return res.status(403).json({ error: '仅管理员可操作公告中心' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

function normalizeStatus(status) {
  return status === 'published' ? 'published' : 'draft';
}

function normalizeAnnouncement(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || '',
    content: row.content || '',
    cover_url: row.cover_url || '',
    status: row.status,
    is_pinned: row.is_pinned === true || row.is_pinned === 1,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: row.author_id
      ? {
          id: row.author_id,
          username: row.author_name || '管理员',
          role: row.author_role || 'admin',
          avatar: row.author_avatar || ''
        }
      : null
  };
}

function applyAnnouncementPayload(payload, previous = null) {
  const nextStatus = payload.status !== undefined ? normalizeStatus(payload.status) : previous?.status || 'draft';
  const rawContent = typeof payload.content === 'string'
    ? payload.content
    : payload.content == null
      ? ''
      : String(payload.content);
  const updates = {
    title: String(payload.title || '').trim(),
    subtitle: String(payload.subtitle || '').trim() || null,
    content: rawContent,
    cover_url: String(payload.cover_url || '').trim() || null,
    status: nextStatus,
    is_pinned: payload.is_pinned === true || payload.is_pinned === 1
  };

  if (!updates.title) {
    const err = new Error('公告标题不能为空');
    err.statusCode = 400;
    throw err;
  }
  if (!rawContent.trim()) {
    const err = new Error('公告正文不能为空');
    err.statusCode = 400;
    throw err;
  }
  if (nextStatus === 'published' && !previous?.published_at) {
    updates.published_at = db.fn.now();
  }
  if (nextStatus === 'draft') {
    updates.published_at = null;
  }
  updates.updated_at = db.fn.now();
  return updates;
}

router.use(authMiddleware, requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const status = String(req.query.status || 'all');
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;

    const base = db('announcements as a');
    if (status === 'draft' || status === 'published') {
      base.where('a.status', status);
    }

    const [{ count }] = await base.clone().count('* as count');
    const rows = await base.clone()
      .leftJoin('users as u', 'a.author_id', 'u.id')
      .select(
        'a.*',
        'u.username as author_name',
        'u.role as author_role',
        'u.avatar as author_avatar'
      )
      .orderBy('a.is_pinned', 'desc')
      .orderBy('a.published_at', 'desc')
      .orderBy('a.updated_at', 'desc')
      .limit(pageSize)
      .offset(offset);

    res.json({
      announcements: rows.map(normalizeAnnouncement),
      total: Number(count || 0),
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(Number(count || 0) / pageSize))
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = applyAnnouncementPayload(req.body);
    payload.author_id = req.user.id;
    payload.created_at = db.fn.now();
    const [id] = await db('announcements').insert(payload);
    const saved = await db('announcements as a')
      .leftJoin('users as u', 'a.author_id', 'u.id')
      .select('a.*', 'u.username as author_name', 'u.role as author_role', 'u.avatar as author_avatar')
      .where('a.id', id)
      .first();
    res.json({ message: payload.status === 'published' ? '公告已发布' : '公告已存为草稿', announcement: normalizeAnnouncement(saved) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const previous = await db('announcements').where({ id }).first();
    if (!previous) return res.status(404).json({ error: '公告不存在' });

    const payload = applyAnnouncementPayload(req.body, previous);
    await db('announcements').where({ id }).update(payload);
    const saved = await db('announcements as a')
      .leftJoin('users as u', 'a.author_id', 'u.id')
      .select('a.*', 'u.username as author_name', 'u.role as author_role', 'u.avatar as author_avatar')
      .where('a.id', id)
      .first();
    res.json({ message: payload.status === 'published' ? '公告已发布' : '公告已存为草稿', announcement: normalizeAnnouncement(saved) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db('announcement_reads').where({ announcement_id: id }).del();
    const deleted = await db('announcements').where({ id }).del();
    if (!deleted) return res.status(404).json({ error: '公告不存在' });
    res.json({ message: '公告已删除' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
