const { createClient } = require('redis');
const logger = require('../config/logger');

let client = null;
let connecting = null;

function getRedisConfig() {
  const host = process.env.REDIS_HOST || process.env.redis_host || '';
  if (!host) return null;
  const port = parseInt(process.env.REDIS_PORT || process.env.redis_port || '6379');
  const username = process.env.REDIS_USERNAME || process.env.redis_username || undefined;
  const password = process.env.REDIS_PASSWORD || process.env.redis_password || undefined;
  const database = parseInt(process.env.REDIS_DB || process.env.redis_db || '0');
  return { socket: { host, port }, username, password, database };
}

async function getClient() {
  const config = getRedisConfig();
  if (!config) {
    const err = new Error('Redis 未配置');
    err.statusCode = 500;
    throw err;
  }
  if (client && client.isOpen) return client;
  if (!client) {
    client = createClient(config);
    client.on('error', err => logger.error('Redis 错误: ' + err.message));
  }
  if (!connecting) connecting = client.connect().finally(() => { connecting = null; });
  await connecting;
  return client;
}

async function setEx(key, seconds, value) {
  const redis = await getClient();
  await redis.setEx(key, seconds, value);
}

async function get(key) {
  const redis = await getClient();
  return redis.get(key);
}

async function del(key) {
  const redis = await getClient();
  return redis.del(key);
}

module.exports = { getClient, setEx, get, del };
