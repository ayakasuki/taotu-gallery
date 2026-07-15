import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../db/index.js';
import logger from '../config/logger.js';

const REQUIRED_ENV = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
const DEFAULT_JWT_SECRET = 'change_this_to_a_random_string';

function hasEnv(name) {
  return Object.prototype.hasOwnProperty.call(process.env, name) && String(process.env[name]).trim() !== '';
}

function validateRequiredEnv() {
  const missing = REQUIRED_ENV.filter(name => !hasEnv(name));
  if (missing.length > 0) {
    throw new Error('缺少必要环境变量: ' + missing.join(', ') + '。请先配置 .env 后再启动服务。');
  }

  if (process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
    throw new Error('JWT_SECRET 仍为示例值，请修改为随机长字符串后再启动服务。');
  }
}

function getDbConfig() {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: Object.prototype.hasOwnProperty.call(process.env, 'DB_PASSWORD') ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME
  };
}

function escapeIdentifier(name) {
  return '`' + String(name).replace(/`/g, '``') + '`';
}

async function ensureDatabaseExists() {
  const config = getDbConfig();
  let connection;
  try {
    connection = await mysql.createConnection(config);
    logger.info('数据库已就绪: ' + config.database);
    return;
  } catch (err) {
    if (err.code !== 'ER_BAD_DB_ERROR') {
      throw new Error('数据库连接失败: ' + err.message + '。请确认 DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME。');
    }
  } finally {
    if (connection) await connection.end();
  }

  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      multipleStatements: false
    });
    await connection.query('CREATE DATABASE ' + escapeIdentifier(config.database) + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    logger.info('数据库不存在，已自动创建: ' + config.database);
  } catch (err) {
    throw new Error('数据库不存在且自动创建失败: ' + err.message + '。请手动创建 DB_NAME 指定的数据库，或授予当前 MySQL 用户建库权限。');
  } finally {
    if (connection) await connection.end();
  }
}

async function runMigrations() {
  try {
    const [batchNo, migrations] = await db.migrate.latest();
    if (migrations.length > 0) {
      logger.info('数据库迁移完成: batch ' + batchNo + ', ' + migrations.length + ' 个迁移');
    } else {
      logger.info('数据库迁移已是最新');
    }
  } catch (err) {
    throw new Error('数据库迁移失败: ' + err.message);
  }
}

function randomInitialPassword() {
  return crypto.randomBytes(18).toString('base64url');
}

async function ensureDefaultAdmin() {
  const row = await db('users').count({ count: '*' }).first();
  const userCount = Number(row && row.count ? row.count : 0);
  if (userCount > 0) return;

  const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const generated = !hasEnv('DEFAULT_ADMIN_PASSWORD');
  const password = generated ? randomInitialPassword() : process.env.DEFAULT_ADMIN_PASSWORD;
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
  const passwordHash = await bcrypt.hash(password, 10);
  const defaultGroup = await db('user_groups').where({ is_default: true }).first().catch(() => null);

  await db('users').insert({
    username,
    password_hash: passwordHash,
    email,
    role: 'admin',
    user_group_id: defaultGroup?.id || null
  });

  logger.warn('检测到空用户表，已创建首个管理员账号: ' + username);
  if (generated) {
    logger.warn('首个管理员随机密码: ' + password + '。请立即登录修改密码；也可在 .env 设置 DEFAULT_ADMIN_PASSWORD 指定初始密码。');
  } else {
    logger.warn('首个管理员使用 .env 中的 DEFAULT_ADMIN_PASSWORD。请首次登录后修改密码。');
  }
}

async function bootstrap() {
  validateRequiredEnv();
  await ensureDatabaseExists();
  await runMigrations();
  await ensureDefaultAdmin();
}

export { bootstrap, validateRequiredEnv };

export default { bootstrap, validateRequiredEnv };
