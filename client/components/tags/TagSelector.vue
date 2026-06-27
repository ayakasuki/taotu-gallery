<template>
  <div class="tag-selector">
    <div class="tag-section" v-if="tags.combinable && tags.combinable.length > 0">
      <h4 class="section-title">可组合标签</h4>
      <div class="tag-list">
        <span
          v-for="tag in tags.combinable"
          :key="tag.id"
          class="tag-badge"
          :class="{ selected: isSelected(tag.id) }"
          @click="toggleTag(tag.id)"
        >
          {{ tag.display_name || tag.name }}
        </span>
      </div>
    </div>

    <div class="tag-section" v-if="tags.nonCombinable && tags.nonCombinable.length > 0">
      <h4 class="section-title">不可组合标签（互斥）</h4>
      <div class="tag-list">
        <span
          v-for="tag in tags.nonCombinable"
          :key="tag.id"
          class="tag-badge"
          :class="{
            selected: isSelected(tag.id),
            disabled: isDisabled(tag)
          }"
          :title="isDisabled(tag) ? '因互斥标签已被选择，当前不可选' : ''"
          @click="handleNonCombinableClick(tag)"
        >
          {{ tag.display_name || tag.name }}
        </span>
      </div>
    </div>

    <div class="tag-actions" v-if="selectedTagIds.length > 0">
      <span class="selected-count">已选 {{ selectedTagIds.length }} 个标签</span>
      <button class="fluent-btn fluent-btn-secondary" @click="clearSelection">清除</button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  tags: { type: Object, default: () => ({ combinable: [], nonCombinable: [] }) },
  selectedTagIds: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:selectedTagIds'])

const allTags = computed(() => {
  return [...(props.tags.combinable || []), ...(props.tags.nonCombinable || [])]
})

const isSelected = (tagId) => props.selectedTagIds.includes(tagId)

const getMutualIds = (tag) => {
  if (!tag.mutually_exclusive_with) return []
  return String(tag.mutually_exclusive_with)
    .split(/[,，.。\s]+/)
    .map(id => id.trim())
    .filter(Boolean)
    .map(id => /^u\d+$/i.test(id) ? 'u' + parseInt(id.slice(1)) : (/^\d+$/.test(id) ? Number(id) : null))
    .filter(id => id !== null)
}

const isDisabled = (tag) => {
  return getMutualIds(tag).some(id => props.selectedTagIds.includes(id)) && !isSelected(tag.id)
}

const toggleTag = (tagId) => {
  const newSelection = [...props.selectedTagIds]
  const idx = newSelection.indexOf(tagId)
  if (idx >= 0) {
    newSelection.splice(idx, 1)
  } else {
    newSelection.push(tagId)
  }
  emit('update:selectedTagIds', newSelection)
}

const handleNonCombinableClick = (tag) => {
  if (isDisabled(tag)) return

  const newSelection = [...props.selectedTagIds]
  const idx = newSelection.indexOf(tag.id)

  if (idx >= 0) {
    // 取消选择
    newSelection.splice(idx, 1)
  } else {
    // 选择时移除互斥标签
    for (const mutualId of getMutualIds(tag)) {
      const conflictIdx = newSelection.indexOf(mutualId)
      if (conflictIdx >= 0) newSelection.splice(conflictIdx, 1)
    }
    newSelection.push(tag.id)
  }

  emit('update:selectedTagIds', newSelection)
}

const clearSelection = () => {
  emit('update:selectedTagIds', [])
}
</script>

<style scoped>
.tag-selector {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 900;
  color: var(--taotu-text-muted);
  margin-bottom: 8px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(238, 210, 226, 0.62);
  border-radius: var(--taotu-radius-sm);
  background: rgba(255, 255, 255, 0.58);
}

.selected-count {
  font-size: 13px;
  color: var(--taotu-text-muted);
  font-weight: 800;
}
</style>
