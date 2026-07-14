function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: '未登录' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}

export default requireAdmin;
