/**
 * 统计服务
 * 提供 API 调用量、上传活跃、用户活跃、总收录图片等统计数据
 */
const db = require('../db');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const packageInfo = require('../../package.json');
const imageService = require('./imageService');

const projectRoot = path.resolve(__dirname, '../..');

function toNumber(value) {
  return Number(value || 0);
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function toMysqlDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function startOfLocalDay(offset = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}

function dayRange(offset = 0) {
  const start = startOfLocalDay(offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return {
    start: toMysqlDateTime(start),
    end: toMysqlDateTime(end)
  };
}

async function countRows(table, where = null) {
  let query = db(table);
  if (where) query = query.where(where);
  const [row] = await query.count('* as count');
  return toNumber(row?.count);
}

async function countCreatedBetween(table, column, range, where = null) {
  let query = db(table).where(column, '>=', range.start).where(column, '<', range.end);
  if (where) query = query.where(where);
  const [row] = await query.count('* as count');
  return toNumber(row?.count);
}

function formatBytes(value) {
  const bytes = Math.max(0, toNumber(value));
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  if (unit === 0) return `${Math.round(size)} ${units[unit]}`;
  return `${size.toFixed(unit >= 3 ? 2 : 1)} ${units[unit]}`;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function getDiskUsage() {
  try {
    const output = execFileSync('df', ['-kP', projectRoot], { encoding: 'utf8', timeout: 1200 });
    const line = output.trim().split('\n')[1];
    if (!line) return null;
    const parts = line.trim().split(/\s+/);
    const total = toNumber(parts[1]) * 1024;
    const used = toNumber(parts[2]) * 1024;
    const percent = toNumber(String(parts[4] || '').replace('%', ''));
    if (!total) return null;
    return { used, total, percent: clampPercent(percent) };
  } catch {
    return null;
  }
}

function relativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚';
  const diff = Math.max(0, Date.now() - date.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  return `${Math.floor(diff / day)} 天前`;
}

function normalizeDate(value) {
  if (!value) return new Date(0);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function stripQuery(endpoint = '') {
  return String(endpoint || '').split('?')[0] || '/api';
}

function makeActivityId(prefix, id, value) {
  return `${prefix}-${id || new Date(value || 0).getTime()}`;
}

async function getDatabaseVersion() {
  try {
    const result = await db.raw('SELECT VERSION() as version');
    const rows = Array.isArray(result) ? result[0] : result;
    const version = Array.isArray(rows) ? rows[0]?.version : rows?.[0]?.version;
    return version ? `MySQL ${version}` : 'MySQL';
  } catch {
    return 'MySQL 状态未知';
  }
}

async function getApiHealthStatus() {
  const since = new Date(Date.now() - 30 * 60 * 1000);
  const [totalRow] = await db('api_logs')
    .where('created_at', '>=', toMysqlDateTime(since))
    .count('* as count');
  const [errorRow] = await db('api_logs')
    .where('created_at', '>=', toMysqlDateTime(since))
    .where('status_code', '>=', 500)
    .count('* as count');

  const total = toNumber(totalRow?.count);
  const errors = toNumber(errorRow?.count);
  if (total === 0) {
    return { value: '最近 30 分钟暂无外部 API 请求', badge: '暂无请求', badgeTone: 'muted' };
  }
  if (errors > 0) {
    return { value: `最近 30 分钟 ${total} 次请求，${errors} 次 5xx`, badge: '告警', badgeTone: 'warning' };
  }
  return { value: `最近 30 分钟 ${total} 次请求，0 次 5xx`, badge: '正常', badgeTone: 'success' };
}

function getQueueHealthStatus() {
  return {
    value: '当前未启用独立任务队列',
    badge: '未启用',
    badgeTone: 'muted'
  };
}

async function getOverviewCurrentUser(authUser = null) {
  if (!authUser?.id) {
    return { username: '管理员', avatar: null, role: 'admin' };
  }

  const user = await db('users')
    .where({ id: authUser.id })
    .select('id', 'username', 'avatar', 'role')
    .first();

  return {
    id: user?.id || authUser.id,
    username: user?.username || authUser.username || '管理员',
    avatar: user?.avatar || null,
    role: user?.role || authUser.role || 'admin'
  };
}

async function getDailyCounts(table, column, days = 10, where = null) {
  const start = startOfLocalDay(-(days - 1));
  let query = db(table)
    .select(db.raw(`DATE_FORMAT(${column}, '%Y-%m-%d') as day`))
    .count('* as count')
    .where(column, '>=', toMysqlDateTime(start))
    .groupBy('day')
    .orderBy('day', 'asc');
  if (where) query = query.where(where);

  const rows = await query;
  const counts = new Map(rows.map(row => [row.day, toNumber(row.count)]));
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    return counts.get(key) || 0;
  });
}

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

async function getOverviewSystemStatus() {
  const disk = getDiskUsage();
  const memoryTotal = os.totalmem();
  const memoryUsed = memoryTotal - os.freemem();
  const memoryPercent = memoryTotal > 0 ? clampPercent((memoryUsed / memoryTotal) * 100) : 0;
  const cpuCount = Math.max(1, os.cpus()?.length || 1);
  const cpuPercent = clampPercent(((os.loadavg()[0] || 0) / cpuCount) * 100);
  const [databaseVersion, apiStatus] = await Promise.all([
    getDatabaseVersion(),
    getApiHealthStatus()
  ]);
  const queueStatus = getQueueHealthStatus();

  return {
    rows: [
      { label: '系统版本', value: `v${packageInfo.version || '0.0.0'}` },
      { label: '运行环境', value: `${os.type()} ${os.release()} / Node.js ${process.version}` },
      { label: '数据库', value: databaseVersion },
      {
        label: '存储使用',
        value: disk ? `${formatBytes(disk.used)} / ${formatBytes(disk.total)}` : '未知',
        percent: disk ? `${disk.percent.toFixed(1)}%` : '',
        progress: disk ? disk.percent : 0
      },
      {
        label: '内存使用',
        value: `${formatBytes(memoryUsed)} / ${formatBytes(memoryTotal)}`,
        percent: `${memoryPercent.toFixed(1)}%`,
        progress: memoryPercent
      },
      {
        label: 'CPU 使用',
        value: `${cpuPercent.toFixed(1)}%`,
        percent: '',
        progress: cpuPercent
      },
      { label: 'API 状态', ...apiStatus },
      { label: '队列状态', ...queueStatus }
    ]
  };
}

async function getRecentActivities(limit = 7) {
  const [uploads, albums, registrations, logins, apiLogs] = await Promise.all([
    db('images as i')
      .leftJoin('users as u', 'i.uploader_id', 'u.id')
      .leftJoin('albums as a', 'i.album_id', 'a.id')
      .select(
        'i.id',
        'i.filename',
        'i.upload_source',
        'i.created_at',
        'u.username',
        'u.avatar',
        'a.name as album_name'
      )
      .orderBy('i.created_at', 'desc')
      .limit(8),
    db('albums as a')
      .leftJoin('users as u', 'a.user_id', 'u.id')
      .select(
        'a.id',
        'a.name',
        'a.created_at',
        'u.username',
        'u.avatar'
      )
      .orderBy('a.created_at', 'desc')
      .limit(5),
    db('users')
      .select('id', 'username', 'avatar', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(5),
    db('users')
      .select('id', 'username', 'avatar', 'last_login_at')
      .whereNotNull('last_login_at')
      .orderBy('last_login_at', 'desc')
      .limit(5),
    db('api_logs as l')
      .leftJoin('api_tokens as t', 'l.token_id', 't.id')
      .leftJoin('users as u', 't.user_id', 'u.id')
      .select(
        'l.id',
        'l.endpoint',
        'l.method',
        'l.status_code',
        'l.created_at',
        'u.username',
        'u.avatar'
      )
      .orderBy('l.created_at', 'desc')
      .limit(5)
  ]);

  const activities = [];

  for (const row of uploads) {
    const actor = row.username || '系统导入';
    activities.push({
      id: makeActivityId('image', row.id, row.created_at),
      kind: row.username ? 'user' : 'system',
      actor: row.username ? actor : '',
      message: row.album_name
        ? `${row.username ? '上传' : '收录'}了 1 张图片到相册「${row.album_name}」`
        : `${row.username ? '上传' : '收录'}了 1 张图片「${row.filename || `#${row.id}`}」`,
      avatar: row.avatar || null,
      icon: row.username ? null : '/icons/admin/image-management-64x64.png',
      createdAt: row.created_at
    });
  }

  for (const row of albums) {
    activities.push({
      id: makeActivityId('album', row.id, row.created_at),
      kind: row.username ? 'user' : 'system',
      actor: row.username || '',
      message: `创建了相册「${row.name || `#${row.id}`}」`,
      avatar: row.avatar || null,
      icon: row.username ? null : '/icons/admin/album-management-64x64.png',
      createdAt: row.created_at
    });
  }

  for (const row of registrations) {
    activities.push({
      id: makeActivityId('register', row.id, row.created_at),
      kind: 'user',
      actor: row.username || '用户',
      message: '注册了新账号',
      avatar: row.avatar || null,
      icon: null,
      createdAt: row.created_at
    });
  }

  for (const row of logins) {
    activities.push({
      id: makeActivityId('login', row.id, row.last_login_at),
      kind: 'user',
      actor: row.username || '用户',
      message: '登录了账号',
      avatar: row.avatar || null,
      icon: null,
      createdAt: row.last_login_at
    });
  }

  for (const row of apiLogs) {
    const isUserAction = Boolean(row.username);
    activities.push({
      id: makeActivityId('api', row.id, row.created_at),
      kind: isUserAction ? 'user' : 'system',
      actor: row.username || '',
      message: `调用了 API ${row.method || 'GET'} ${stripQuery(row.endpoint)}，状态 ${row.status_code || '-'}`,
      avatar: row.avatar || null,
      icon: isUserAction ? null : '/icons/admin/api-settings-64x64.png',
      createdAt: row.created_at
    });
  }

  return activities
    .filter(item => item.createdAt)
    .sort((a, b) => normalizeDate(b.createdAt) - normalizeDate(a.createdAt))
    .slice(0, limit)
    .map(item => ({
      ...item,
      time: relativeTime(item.createdAt)
    }));
}

async function getOverviewDashboard(authUser = null) {
  const today = dayRange(0);
  const yesterday = dayRange(-1);

  const [
    totalImages,
    totalAlbums,
    totalUsers,
    totalTags,
    imageGrowth,
    albumGrowth,
    userGrowth,
    todayApiCalls,
    yesterdayApiCalls,
    imageTrend,
    albumTrend,
    userTrend,
    apiTrend,
    system,
    activities,
    currentUser
  ] = await Promise.all([
    countRows('images'),
    countRows('albums'),
    countRows('users'),
    countRows('tags'),
    countCreatedBetween('images', 'created_at', today),
    countCreatedBetween('albums', 'created_at', today),
    countCreatedBetween('users', 'created_at', today),
    countCreatedBetween('api_logs', 'created_at', today),
    countCreatedBetween('api_logs', 'created_at', yesterday),
    getDailyCounts('images', 'created_at'),
    getDailyCounts('albums', 'created_at'),
    getDailyCounts('users', 'created_at'),
    getDailyCounts('api_logs', 'created_at'),
    getOverviewSystemStatus(),
    getRecentActivities(),
    getOverviewCurrentUser(authUser)
  ]);

  return {
    currentUser,
    stats: {
      totalImages: { value: totalImages, change: imageGrowth },
      totalAlbums: { value: totalAlbums, change: albumGrowth },
      totalUsers: { value: totalUsers, change: userGrowth },
      todayApiCalls: { value: todayApiCalls, change: todayApiCalls - yesterdayApiCalls },
      totalTags: { value: totalTags }
    },
    trends: {
      totalImages: imageTrend,
      totalAlbums: albumTrend,
      totalUsers: userTrend,
      todayApiCalls: apiTrend
    },
    system,
    activities
  };
}

async function getOperationsDashboard() {
  const today = dayRange(0);
  const yesterday = dayRange(-1);

  const [
    totalImages,
    totalAlbums,
    totalUsers,
    todayApiCalls,
    yesterdayApiCalls,
    todayUploads,
    yesterdayUploads,
    imageGrowth,
    albumGrowth,
    userGrowth,
    apiTrend,
    topImages
  ] = await Promise.all([
    countRows('images'),
    countRows('albums'),
    countRows('users'),
    countCreatedBetween('api_logs', 'created_at', today),
    countCreatedBetween('api_logs', 'created_at', yesterday),
    countCreatedBetween('upload_logs', 'created_at', today, { status: 'success' }),
    countCreatedBetween('upload_logs', 'created_at', yesterday, { status: 'success' }),
    countCreatedBetween('images', 'created_at', today),
    countCreatedBetween('albums', 'created_at', today),
    countCreatedBetween('users', 'created_at', today),
    getDailyCounts('api_logs', 'created_at', 30),
    getTopImages(10)
  ]);

  const start = startOfLocalDay(-29);
  const apiTrendLabels = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return `${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  });

  return {
    cards: {
      totalImages: { value: totalImages, change: imageGrowth },
      totalAlbums: { value: totalAlbums, change: albumGrowth },
      totalUsers: { value: totalUsers, change: userGrowth },
      todayApiCalls: { value: todayApiCalls, change: todayApiCalls - yesterdayApiCalls },
      todayUploads: { value: todayUploads, change: todayUploads - yesterdayUploads }
    },
    apiTrend: {
      labels: apiTrendLabels,
      values: apiTrend
    },
    topImages
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
  const rows = await db('images')
    .orderBy('view_count', 'desc')
    .limit(limit)
    .select('id', 'filename', 'hash_path', 'view_count');

  return rows.map((image) => ({
    ...image,
    ...imageService.buildImageUrls(image),
    like_count: 0
  }));
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
  getOverviewDashboard,
  getOperationsDashboard,
  getTopImages,
  getTopEndpoints,
  updateMetric,
  getMetric
};
