/**
 * 标签请求校验
 */
function validateTagCreate(req, res, next) {
  const { name, display_name } = req.body;
  if (!name) {
    return res.status(400).json({ error: '标签名称不能为空' });
  }
  if (name.length > 100) {
    return res.status(400).json({ error: '标签名称不能超过 100 个字符' });
  }
  next();
}

function validateTagConflict(tag, allTags) {
  // 校验不可组合标签互斥冲突
  if (!tag.combinable && tag.mutually_exclusive_with) {
    const conflictTag = allTags.find(t => t.id === tag.mutually_exclusive_with);
    if (conflictTag && !conflictTag.combinable) {
      return { valid: false, error: `标签 "${tag.name}" 与 "${conflictTag.name}" 互斥` };
    }
  }
  return { valid: true };
}

export default { validateTagCreate, validateTagConflict };
