/**
 * 标签文件监听服务
 * 监听 tags.json 和 conditions.json 变化
 * 支持定时执行条件标签
 */
const chokidar = require('chokidar');
const config = require('../config');
const configService = require('./configService');
const tagService = require('./tagService');
const conditionTagService = require('./conditionTagService');
const logger = require('../config/logger');

let tagWatcher = null;
let condWatcher = null;
let tagSyncTimer = null;
let condSyncTimer = null;
let periodicTimer = null;

// 启动监听
function startWatching() {
  // 监听 tags.json
  if (!tagWatcher) {
    tagWatcher = chokidar.watch(config.tagsFile, {
      persistent: true, ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
    });

    tagWatcher.on('change', async () => {
      logger.info('检测到标签文件变化');
      const siteConfig = await configService.readSiteConfig();
      const delayMinutes = siteConfig.tagDelayMinutes || config.tagDelayMinutes;

      if (tagSyncTimer) clearTimeout(tagSyncTimer);
      tagSyncTimer = setTimeout(async () => {
        try {
          const newTags = await configService.readTags();
          await tagService.syncTagConfig(newTags);
        } catch (err) {
          logger.error(`标签同步失败: ${err.message}`);
        }
      }, delayMinutes * 60 * 1000);
      logger.info(`标签同步将在 ${delayMinutes} 分钟后执行`);
    });
    logger.info('开始监听标签文件: tags.json');
  }

  // 监听 conditions.json
  if (!condWatcher) {
    const conditionsFile = config.conditionsFile || (config.configDir + '/conditions.json');
    condWatcher = chokidar.watch(conditionsFile, {
      persistent: true, ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
    });

    condWatcher.on('change', async () => {
      logger.info('检测到条件配置变化，准备执行条件标签');
      const siteConfig = await configService.readSiteConfig();
      const delayMinutes = siteConfig.tagDelayMinutes || config.tagDelayMinutes;

      if (condSyncTimer) clearTimeout(condSyncTimer);
      condSyncTimer = setTimeout(async () => {
        try {
          logger.info('开始执行条件标签扫描...');
          const result = await conditionTagService.tagImagesByConditions(null, null, true);
          logger.info(`条件标签执行完成: 处理 ${result.processed} 张, 标记 ${result.tagged} 张`);
        } catch (err) {
          logger.error(`条件标签执行失败: ${err.message}`);
        }
      }, delayMinutes * 60 * 1000);
      logger.info(`条件标签将在 ${delayMinutes} 分钟后执行`);
    });
    logger.info('开始监听条件文件: conditions.json');
  }

  // 启动定时执行（每 N 分钟扫描一次未标签的图片）
  startPeriodicScan();
}

// 启动定时条件标签扫描
async function startPeriodicScan() {
  if (periodicTimer) clearInterval(periodicTimer);

  const siteConfig = await configService.readSiteConfig();
  const intervalMinutes = (siteConfig.tagDelayMinutes || config.tagDelayMinutes) * 60 * 1000;

  periodicTimer = setInterval(async () => {
    try {
      const conditions = await configService.readConditions();
      const enabledConditions = conditions.filter(c => c.is_enabled !== false);
      if (enabledConditions.length === 0) return;

      logger.info('定时条件标签扫描开始...');
      // 只扫描未标记过条件标签的图片
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
  if (tagSyncTimer) clearTimeout(tagSyncTimer);
  if (condSyncTimer) clearTimeout(condSyncTimer);
  if (periodicTimer) clearInterval(periodicTimer);
  if (tagWatcher) { tagWatcher.close(); tagWatcher = null; }
  if (condWatcher) { condWatcher.close(); condWatcher = null; }
  logger.info('标签/条件文件监听已停止');
}

// 立即执行标签同步
async function forceSyncNow() {
  const newTags = await configService.readTags();
  return await tagService.syncTagConfig(newTags);
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
  forceSyncNow,
  forceConditionTagNow
};
