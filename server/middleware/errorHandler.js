const logger = require('../config/logger');

// 全局错误处理中间件
function errorHandler(err, req, res, _next) {
  logger.error(`${err.message} - ${req.method} ${req.url}`);

  // Multer 文件上传错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: '文件大小超出限制' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({ error: '文件数量超出限制' });
  }

  // JWT 认证错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: '无效的认证令牌' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: '认证令牌已过期' });
  }

  // 数据库错误
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: '数据重复' });
  }

  // 自定义业务错误
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // 未知错误
  res.status(500).json({ error: '服务器内部错误' });
}

module.exports = errorHandler;
