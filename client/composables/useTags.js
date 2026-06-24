/**
 * 标签组合式函数
 */
export function useTags() {
  const tags = useState('tags', () => ({ combinable: [], nonCombinable: [] }))
  const selectedTagIds = useState('selected_tags', () => [])
  const loading = useState('tags_loading', () => false)

  const fetchTags = async () => {
    loading.value = true
    try {
      const api = useApi()
      const data = await api.get('/api/tags')
      tags.value = data
    } catch (err) {
      console.error('获取标签失败:', err)
    } finally {
      loading.value = false
    }
  }

  const allTags = computed(() => {
    return [...(tags.value.combinable || []), ...(tags.value.nonCombinable || [])]
  })

  // 切换标签选择（处理互斥逻辑）
  const toggleTag = (tagId) => {
    const tag = allTags.value.find(t => t.id === tagId)
    if (!tag) return

    const idx = selectedTagIds.value.indexOf(tagId)
    if (idx >= 0) {
      // 取消选择
      selectedTagIds.value = selectedTagIds.value.filter(id => id !== tagId)
    } else {
      // 不可组合标签互斥检查
      if (!tag.combinable && tag.mutually_exclusive_with) {
        selectedTagIds.value = selectedTagIds.value.filter(id => id !== tag.mutually_exclusive_with)
      }
      selectedTagIds.value = [...selectedTagIds.value, tagId]
    }
  }

  const isSelected = (tagId) => selectedTagIds.value.includes(tagId)

  const clearSelection = () => {
    selectedTagIds.value = []
  }

  return { tags, selectedTagIds, loading, allTags, fetchTags, toggleTag, isSelected, clearSelection }
}
