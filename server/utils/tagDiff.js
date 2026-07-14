/**
 * 标签配置差异计算工具
 * 对比两份 tags.json 配置，返回新增、修改、删除的标签
 */
import logger from '../config/logger.js';

// 计算标签配置差异
function computeTagDiff(oldTags, newTags) {
  const oldAll = [...(oldTags.combinable || []), ...(oldTags.nonCombinable || [])];
  const newAll = [...(newTags.combinable || []), ...(newTags.nonCombinable || [])];

  const oldMap = new Map(oldAll.map(t => [t.id, t]));
  const newMap = new Map(newAll.map(t => [t.id, t]));

  const added = [];
  const modified = [];
  const removed = [];

  // 新增和修改
  for (const [id, newTag] of newMap) {
    if (!oldMap.has(id)) {
      added.push(newTag);
    } else {
      const oldTag = oldMap.get(id);
      if (JSON.stringify(oldTag) !== JSON.stringify(newTag)) {
        modified.push({ old: oldTag, new: newTag });
      }
    }
  }

  // 删除
  for (const [id, oldTag] of oldMap) {
    if (!newMap.has(id)) {
      removed.push(oldTag);
    }
  }

  return { added, modified, removed };
}

// 判断差异是否"出入过大"
function isDiffExcessive(oldTags, newTags, threshold = 0.5) {
  const diff = computeTagDiff(oldTags, newTags);
  const oldCount = (oldTags.combinable || []).length + (oldTags.nonCombinable || []).length;
  const changeCount = diff.added.length + diff.modified.length + diff.removed.length;

  if (oldCount === 0) return false;
  const changeRatio = changeCount / oldCount;

  logger.info(`标签配置差异: 变更 ${changeCount}/${oldCount} (${(changeRatio * 100).toFixed(1)}%), 阈值 ${(threshold * 100).toFixed(1)}%`);
  return changeRatio > threshold;
}

export { computeTagDiff, isDiffExcessive };

export default { computeTagDiff, isDiffExcessive };
