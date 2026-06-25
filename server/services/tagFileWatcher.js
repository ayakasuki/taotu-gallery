/**
 * 标签/条件监听服务
 * 现在所有配置存储在数据库，不再监听 JSON 文件
 * 保留定时扫描功能
 */
const config = require('../config');
const configService = require('./configService');
const conditionTagService = require('./conditionTagService');
const logger = require('../config/logger');

let periodicTimer = null;

// 启动定时扫描
async function startWatching() {
  startPeriodicScan();
  logger.info('标签监听服务已启动（数据库模式，无文件监听）');
}

// 启动定时条件标签扫描
async function startPeriodicScan() {
  if (periodicTimer) clearInterval(periodicTimer);

  const siteConfig = await configService.readSiteConfig();
  const intervalMinutes = (siteConfig.tagDelayMinutes || 5) * 60 * 1000;

  periodicTimer = setInterval(async () => {
    try {
      const conditions = await configService.readConditions();
      const enabledConditions = conditions.filter(c => c.is_enabled !== false);
      if (enabledConditions.length === 0) return;

      logger.info('定时条件标签扫描开始...');
      const result = await conditionTagService.tagImagesByConditions(null, null, false);
      if (result.tagged > 0) {
        logger.info(`定时扫描完成: 新标记 ${result.tagged} 张图片`);
      }
    } catch (err) {
      logger.error(`定时条件标签扫描失败: ${err.message}`);
    }
  }, intervalMinutes);

  logger.info(`定时条件标签扫描已启动，间隔 ${intervalMinutes / 60000} 分钟`);
}

// 停止监听
function stopWatching() {
  if (periodicTimer) clearInterval(periodicTimer);
  logger.info('标签监听服务已停止');
}

// 立即执行条件标签
async function forceConditionTagNow() {
  logger.info('手动触发条件标签执行...');
  const result = await conditionTagService.tagImagesByConditions(null, null, true);
  logger.info(`条件标签执行完成: 处理 ${result.processed} 张, 标记 ${result.tagged} 张`);
  return result;
}

module.exports = {
  startWatching,
  stopWatching,
  forceConditionTagNow
};
