import db from '../db/index.js';

// API Token 认证中间件（对外 API 用）
// 支持两种方式：Authorization: Bearer <token> 或 ?tk=<token>
async function apiTokenMiddleware(req, res, next) {
  let token = null;

  // 优先从 header 读取
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 其次从 query 参数读取
  if (!token && req.query.tk) {
    token = req.query.tk;
  }

  if (!token) {
    return res.status(401).json({ error: '未提供 API Token（通过 Authorization header 或 ?tk= 参数）' });
  }

  try {
    const tokenRecord = await db('api_tokens').where({ token }).first();
    if (!tokenRecord) {
      return res.status(401).json({ error: '无效的 API Token' });
    }

    await db('api_tokens').where({ id: tokenRecord.id }).update({
      last_used_at: db.fn.now()
    });

    req.apiToken = tokenRecord;
    // 如果 token 关联了用户，设置 req.user
    if (tokenRecord.user_id) {
      req.apiTokenUserId = tokenRecord.user_id;
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Token 验证失败' });
  }
}

export default apiTokenMiddleware;
