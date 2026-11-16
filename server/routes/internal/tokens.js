import express from 'express';
import authMiddleware from '../../middleware/auth.js';
import db from '../../db/index.js';

const router = express.Router();

router.get('/', authMiddleware, async (req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  try {
    const tokens = await db('api_tokens').where({ user_id: req.user.id })
      .select('id', 'label', 'token', 'permissions', 'created_at');
    res.json({ tokens });
  } catch (error) { next(error); }
});

export default router;
