/**
 * 管理后台 - 统计 API
 */
const express = require('express');
const authMiddleware = require('../../middleware/auth');
const statsService = require('../../services/statsService');

const router = express.Router();

// 总体统计概览
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const overall = await statsService.getOverallStats();
    const today = await statsService.getTodayStats();
    res.json({ ...overall, today });
  } catch (err) {
    next(err);
  }
});

// API 调用量统计
router.get('/api-calls', authMiddleware, async (req, res, next) => {
  try {
    const { period = 'day' } = req.query;
    const stats = await statsService.getApiStats(period);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// 上传活跃统计
router.get('/uploads', authMiddleware, async (req, res, next) => {
  try {
    const { period = 'day' } = req.query;
    const stats = await statsService.getUploadStats(period);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// 用户活跃统计
router.get('/users', authMiddleware, async (req, res, next) => {
  try {
    const { period = 'day' } = req.query;
    const stats = await statsService.getUserActivityStats(period);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// 热门图片
router.get('/top-images', authMiddleware, async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const images = await statsService.getTopImages(parseInt(limit));
    res.json({ images });
  } catch (err) {
    next(err);
  }
});

// 热门 API 端点
router.get('/top-endpoints', authMiddleware, async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const endpoints = await statsService.getTopEndpoints(parseInt(limit));
    res.json({ endpoints });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
