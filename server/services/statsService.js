/**
 * 统计服务
 * 提供 API 调用量、上传活跃、用户活跃、总收录图片等统计数据
 */
const db = require('../db');
const logger = require('../config/logger');

// 获取总体统计
async function getOverallStats() {
  const [imageCount] = await db('images').count('* as count');
  const [albumCount] = await db('albums').count('* as count');
  const [userCount] = await db('users').count('* as count');
  const [tagCount] = await db('tags').count('* as count');

  return {
    totalImages: imageCount.count,
    totalAlbums: albumCount.count,
    totalUsers: userCount.count,
    totalTags: tagCount.count
  };
}

// 获取今日统计
async function getTodayStats() {
  const today = new Date().toISOString().split('T')[0];

  const [apiCalls] = await db('api_logs')
    .where('created_at', '>=', today)
    .count('* as count');

  const [uploads] = await db('upload_logs')
    .where('created_at', '>=', today)
    .where({ status: 'success' })
    .count('* as count');

  const [newUsers] = await db('users')
    .where('created_at', '>=', today)
    .count('* as count');

  return {
    apiCalls: apiCalls.count,
    uploads: uploads.count,
    newUsers: newUsers.count
  };
}

// 获取 API 调用量统计（按日/月/年）
async function getApiStats(period = 'day') {
  let dateFormat;
  let groupBy;

  switch (period) {
    case 'year':
      dateFormat = '%Y';
      groupBy = 'year';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      groupBy = 'month';
      break;
    case 'day':
    default:
      dateFormat = '%Y-%m-%d';
      groupBy = 'day';
      break;
  }

  const stats = await db('api_logs')
    .select(db.raw(`DATE_FORMAT(created_at, '${dateFormat}') as period`))
    .count('* as count')
    .groupBy('period')
    .orderBy('period', 'desc')
    .limit(30);

  return { period: groupBy, stats };
}

// 获取上传活跃统计
async function getUploadStats(period = 'day') {
  let dateFormat;
  switch (period) {
    case 'year': dateFormat = '%Y'; break;
    case 'month': dateFormat = '%Y-%m'; break;
    case 'day':
    default: dateFormat = '%Y-%m-%d'; break;
  }

  const stats = await db('upload_logs')
    .select(db.raw(`DATE_FORMAT(created_at, '${dateFormat}') as period`))
    .count('* as count')
    .where({ status: 'success' })
    .groupBy('period')
    .orderBy('period', 'desc')
    .limit(30);

  return { period, stats };
}

// 获取用户活跃统计
async function getUserActivityStats(period = 'day') {
  let dateFormat;
  switch (period) {
    case 'year': dateFormat = '%Y'; break;
    case 'month': dateFormat = '%Y-%m'; break;
    case 'day':
    default: dateFormat = '%Y-%m-%d'; break;
  }

  const loginStats = await db('users')
    .select(db.raw(`DATE_FORMAT(last_login_at, '${dateFormat}') as period`))
    .count('* as count')
    .whereNotNull('last_login_at')
    .groupBy('period')
    .orderBy('period', 'desc')
    .limit(30);

  return { period, loginStats };
}

// 获取热门图片（浏览最多）
async function getTopImages(limit = 10) {
  return db('images')
    .orderBy('view_count', 'desc')
    .limit(limit)
    .select('id', 'filename', 'path', 'view_count');
}

// 获取热门 API 端点
async function getTopEndpoints(limit = 10) {
  return db('api_logs')
    .select('endpoint')
    .count('* as count')
    .groupBy('endpoint')
    .orderBy('count', 'desc')
    .limit(limit);
}

// 更新网站指标
async function updateMetric(key, value) {
  await db('site_metrics')
    .insert({ metric_key: key, metric_value: JSON.stringify(value) })
    .onConflict('metric_key')
    .merge({ metric_value: JSON.stringify(value), updated_at: db.fn.now() });
}

// 获取网站指标
async function getMetric(key) {
  const record = await db('site_metrics').where({ metric_key: key }).first();
  return record ? JSON.parse(record.metric_value) : null;
}

module.exports = {
  getOverallStats,
  getTodayStats,
  getApiStats,
  getUploadStats,
  getUserActivityStats,
  getTopImages,
  getTopEndpoints,
  updateMetric,
  getMetric
};
