/**
 * API 调用日志中间件
 * 记录每次 API 调用到 api_logs 表
 */
import db from '../db/index.js';

function apiLogger(req, res, next) {
  const startTime = Date.now();

  // 响应完成后记录日志
  res.on('finish', async () => {
    try {
      await db('api_logs').insert({
        endpoint: req.originalUrl || req.url,
        method: req.method,
        source_ip: req.ip || req.connection.remoteAddress,
        token_id: req.apiToken ? req.apiToken.id : null,
        status_code: res.statusCode
      });
    } catch (err) {
      // 日志记录失败不应影响请求
    }
  });

  next();
}

export default apiLogger;
