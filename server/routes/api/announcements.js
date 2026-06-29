/**
 * 前台用户通知公告。
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const db = require('../../db');

const router = express.Router();

function normalizeAnnouncement(row) {
  const isRead = !!row.read_at;
  const author = row.author_id
    ? {
        id: row.author_id,
        username: row.author_name || '管理员',
        role: row.author_role || 'admin',
        avatar: row.author_avatar || ''
      }
    : null;

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || '',
    content: row.content || '',
    cover_url: row.cover_url || '',
    is_pinned: row.is_pinned === true || row.is_pinned === 1,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    read_at: row.read_at || null,
    is_read: isRead,
    author,
    notifier: author
      ? { type: author.role === 'admin' ? 'admin' : 'user', name: author.username, avatar: author.avatar }
      : { type: 'system', name: '系统消息', avatar: '' }
  };
}

router.get('/notifications', authMiddleware, async (req, res, next) => {
  try {
    const rows = await db('announcements as a')
      .leftJoin('announcement_reads as r', function joinReads() {
        this.on('r.announcement_id', '=', 'a.id')
          .andOn('r.user_id', '=', db.raw('?', [req.user.id]));
      })
      .leftJoin('users as u', 'a.author_id', 'u.id')
      .where('a.status', 'published')
      .where(function onlyPublished() {
        this.whereNull('a.published_at').orWhere('a.published_at', '<=', db.fn.now());
      })
      .select(
        'a.*',
        'r.read_at',
        'u.username as author_name',
        'u.role as author_role',
        'u.avatar as author_avatar'
      )
      .orderBy('a.is_pinned', 'desc')
      .orderBy('a.published_at', 'desc')
      .orderBy('a.updated_at', 'desc')
      .limit(30);

    const items = rows.map(normalizeAnnouncement);
    res.json({
      notifications: items,
      unreadCount: items.filter(item => !item.is_read).length
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/read', authMiddleware, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const announcement = await db('announcements')
      .where({ id, status: 'published' })
      .first();
    if (!announcement) return res.status(404).json({ error: '公告不存在或尚未发布' });

    await db('announcement_reads')
      .insert({
        announcement_id: id,
        user_id: req.user.id,
        read_at: db.fn.now()
      })
      .onConflict(['announcement_id', 'user_id'])
      .merge({ read_at: db.fn.now() });

    res.json({ message: '已读状态已更新' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
