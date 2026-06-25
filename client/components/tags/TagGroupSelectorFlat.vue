<template>
  <div class="tag-group-selector">
    <!-- 分组选择区 -->
    <div class="selector-section">
      <label class="section-label">主分组</label>
      <div class="chip-list">
        <span v-for="g in groups" :key="g.id" class="tag-chip group-chip"
          :class="{ selected: selectedGroupIds.includes(g.id) }"
          @click="toggleGroup(g.id)">
          {{ g.name }}
        </span>
        <span v-if="groups.length === 0" class="empty-hint">暂无分组</span>
      </div>
    </div>

    <!-- 子分组选择区 -->
    <div class="selector-section" v-if="availableSubgroups.length > 0">
      <label class="section-label">子分组</label>
      <div class="chip-list">
        <span v-for="sg in availableSubgroups" :key="sg.sid" class="tag-chip subgroup-chip"
          :class="{ selected: selectedSids.includes(sg.sid), disabled: isSubgroupDisabled(sg) }"
          @click="toggleSubgroup(sg)">
          <span class="chip-parent">{{ getGroupName(sg._groupId) }}/</span>{{ sg.name }}
        </span>
      </div>
    </div>

    <!-- 标签选择区 -->
    <div class="selector-section" v-if="availableTags.length > 0">
      <label class="section-label">标签</label>
      <div class="chip-list">
        <span v-for="tag in availableTags" :key="tag.id" class="tag-chip"
          :class="{ selected: selectedTagIds.includes(tag.id), disabled: isTagDisabled(tag) }"
          @click="toggleTag(tag)">
          {{ tag.display_name || tag.name }}
        </span>
      </div>
    </div>

    <!-- 已选摘要 -->
    <div class="selection-summary" v-if="hasSelection">
      <span class="summary-label">已选:</span>
      <span v-for="id in selectedGroupIds" :key="'g'+id" class="summary-chip group">
        {{ getGroupName(id) }} <button @click="toggleGroup(id)">×</button>
      </span>
      <span v-for="sid in selectedSids" :key="'s'+sid" class="summary-chip subgroup">
        {{ getSubgroupName(sid) }} <button @click="removeSid(sid)">×</button>
      </span>
      <span v-for="id in selectedTagIds" :key="'t'+id" class="summary-chip tag">
        {{ getTagName(id) }} <button @click="toggleTagById(id)">×</button>
      </span>
      <button class="clear-all" @click="clearAll">清除全部</button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  tags: { type: Object, default: () => ({ combinable: [], nonCombinable: [] }) },
  selectedGroupIds: { type: Array, default: () => [] },
  selectedSids: { type: Array, default: () => [] },
  selectedTagIds: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'update:selectedGroupIds',
  'update:selectedSids',
  'update:selectedTagIds'
])

const api = useApi()
const groups = ref([])

const allTags = computed(() => [...(props.tags.combinable || []), ...(props.tags.nonCombinable || [])])

onMounted(async () => {
  try {
    const data = await api.get('/api/tag-groups')
    groups.value = (data.groups || []).map(g => ({
      ...g,
      subgroups: (g.subgroups || []).map(sg => ({ ...sg, _groupId: g.id }))
    }))
  } catch {}
})

// 计算被主分组覆盖的子分组 sid 集合
const coveredSids = computed(() => {
  const sids = new Set()
  for (const gid of props.selectedGroupIds) {
    const g = groups.value.find(g => g.id === gid)
    if (g) {
      for (const sg of (g.subgroups || [])) sids.add(sg.sid)
    }
  }
  return sids
})

// 计算被主分组/子分组覆盖的标签 ID 集合
const coveredTagIds = computed(() => {
  const ids = new Set()
  // 被主分组覆盖
  for (const gid of props.selectedGroupIds) {
    const g = groups.value.find(g => g.id === gid)
    if (g) {
      for (const tid of (g.tagIds || [])) ids.add(tid)
      for (const sg of (g.subgroups || [])) {
        for (const tid of (sg.tagIds || [])) ids.add(tid)
      }
    }
  }
  // 被子分组覆盖
  for (const sid of props.selectedSids) {
    for (const g of groups.value) {
      const sg = (g.subgroups || []).find(s => s.sid === sid)
      if (sg) {
        for (const tid of (sg.tagIds || [])) ids.add(tid)
      }
    }
  }
  return ids
})

// 可选子分组（排除已被主分组覆盖的）
const availableSubgroups = computed(() => {
  const list = []
  for (const g of groups.value) {
    if (props.selectedGroupIds.includes(g.id)) continue // 主分组已选，跳过其子分组
    for (const sg of (g.subgroups || [])) {
      list.push(sg)
    }
  }
  return list
})

// 可选标签（排除已被主分组/子分组覆盖的）
const availableTags = computed(() => {
  return allTags.value.filter(t => !coveredTagIds.value.has(t.id))
})

const hasSelection = computed(() => {
  return props.selectedGroupIds.length > 0 || props.selectedSids.length > 0 || props.selectedTagIds.length > 0
})

// 主分组切换
const toggleGroup = (id) => {
  const newIds = [...props.selectedGroupIds]
  const idx = newIds.indexOf(id)
  if (idx >= 0) newIds.splice(idx, 1)
  else newIds.push(id)
  emit('update:selectedGroupIds', newIds)
}

// 子分组切换
const isSubgroupDisabled = (sg) => coveredSids.value.has(sg.sid)

const toggleSubgroup = (sg) => {
  if (isSubgroupDisabled(sg)) return
  const newSids = [...props.selectedSids]
  const idx = newSids.indexOf(sg.sid)
  if (idx >= 0) newSids.splice(idx, 1)
  else newSids.push(sg.sid)
  emit('update:selectedSids', newSids)
}

const removeSid = (sid) => {
  emit('update:selectedSids', props.selectedSids.filter(s => s !== sid))
}

// 标签切换
const isTagDisabled = (tag) => coveredTagIds.value.has(tag.id)

const toggleTag = (tag) => {
  if (isTagDisabled(tag)) return
  const newIds = [...props.selectedTagIds]
  const idx = newIds.indexOf(tag.id)
  if (idx >= 0) newIds.splice(idx, 1)
  else newIds.push(tag.id)
  emit('update:selectedTagIds', newIds)
}

const toggleTagById = (id) => {
  emit('update:selectedTagIds', props.selectedTagIds.filter(t => t !== id))
}

const clearAll = () => {
  emit('update:selectedGroupIds', [])
  emit('update:selectedSids', [])
  emit('update:selectedTagIds', [])
}

// 辅助
const getGroupName = (id) => groups.value.find(g => g.id === id)?.name || ''
const getSubgroupName = (sid) => {
  for (const g of groups.value) {
    const sg = (g.subgroups || []).find(s => s.sid === sid)
    if (sg) return `${g.name}/${sg.name}`
  }
  return ''
}
const getTagName = (id) => allTags.value.find(t => t.id === id)?.display_name || allTags.value.find(t => t.id === id)?.name || ''
</script>

<style scoped>
.tag-group-selector { display: flex; flex-direction: column; gap: var(--space-md); }
.selector-section { }
.section-label { display: block; font-size: 12px; font-weight: 600; color: var(--fluent-text-secondary); margin-bottom: var(--space-sm); text-transform: uppercase; letter-spacing: 0.5px; }
.chip-list { display: flex; flex-wrap: wrap; gap: 6px; }
.tag-chip { padding: 4px 12px; border: 1px solid var(--fluent-border); border-radius: 14px; font-size: 13px; cursor: pointer; transition: all var(--transition-fast); user-select: none; }
.tag-chip:hover:not(.disabled) { background: var(--fluent-hover); }
.tag-chip.selected { background: var(--fluent-blue); color: white; border-color: var(--fluent-blue); }
.tag-chip.disabled { opacity: 0.35; cursor: not-allowed; text-decoration: line-through; }
.group-chip { font-weight: 600; }
.subgroup-chip { font-size: 12px; }
.chip-parent { opacity: 0.6; font-size: 11px; }
.empty-hint { font-size: 13px; color: var(--fluent-text-secondary); }

.selection-summary { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; padding: var(--space-sm) var(--space-md); background: var(--fluent-blue-light); border-radius: var(--radius-sm); margin-top: var(--space-sm); }
.summary-label { font-size: 12px; font-weight: 600; color: var(--fluent-blue); }
.summary-chip { font-size: 12px; padding: 2px 8px; border-radius: 10px; display: flex; align-items: center; gap: 4px; }
.summary-chip.group { background: var(--fluent-blue); color: white; }
.summary-chip.subgroup { background: #e8daef; color: #6c3483; }
.summary-chip.tag { background: #e6f4ea; color: #107c10; }
.summary-chip button { background: none; border: none; cursor: pointer; font-size: 14px; padding: 0; line-height: 1; opacity: 0.7; }
.summary-chip button:hover { opacity: 1; }
.clear-all { font-size: 12px; color: #d13438; background: none; border: none; cursor: pointer; margin-left: auto; }
</style>
