/**
 * 上传请求校验
 */
function validateUpload(req, res, next) {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '请选择要上传的文件' });
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
  for (const file of req.files) {
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: `不支持的文件类型: ${file.mimetype}` });
    }
  }

  next();
}

module.exports = { validateUpload };
