/**
 * 对外 API - 标签查询
 * 读取标签文件，返回可组合/不可组合/单/复合标签能力
 */
const express = require('express');
const configService = require('../../services/configService');
const tagService = require('../../services/tagService');

const router = express.Router();

// 获取所有标签
router.get('/', async (req, res, next) => {
  try {
    const tags = await configService.readTags();
    res.json({
      combinable: tags.combinable || [],
      nonCombinable: tags.nonCombinable || [],
      all: [...(tags.combinable || []), ...(tags.nonCombinable || [])]
    });
  } catch (err) {
    next(err);
  }
});

// 校验标签组合是否合法（不可组合标签互斥检测）
router.post('/validate', async (req, res, next) => {
  try {
    const { tagIds } = req.body;
    if (!tagIds || !Array.isArray(tagIds)) {
      return res.status(400).json({ error: '请提供 tagIds 数组' });
    }

    const allTags = await tagService.getAllTags();
    const validation = tagService.validateNonCombinableConflict(tagIds, allTags);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error, conflictTags: validation.conflictTags });
    }

    res.json({ valid: true, tagIds });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
