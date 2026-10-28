import logger from '../config/logger.js';
import { repairRootAdmin } from '../services/startupService.js';

try {
  await repairRootAdmin();
  logger.info('保底管理员修复命令完成。');
  process.exitCode = 0;
} catch (error) {
  logger.error('保底管理员修复失败: ' + error.message);
  process.exitCode = 1;
} finally {
  await (await import('../db/index.js')).default.destroy();
}
