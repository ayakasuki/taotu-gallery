<template>
  <div class="tag-group-selector">
    <div class="group-selectors">
      <div v-for="(slot, idx) in slots" :key="idx" class="group-slot">
        <select v-model="slot.groupId" class="group-select" @change="onGroupChange(idx)">
          <option :value="null">选择分组 {{ idx + 1 }}</option>
          <option v-for="g in availableGroups(idx)" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>
      </div>
    </div>

    <div class="group-panels" v-if="hasSelection">
      <div v-for="(slot, idx) in slots" :key="idx" class="group-panel" v-show="slot.groupId">
        <div class="panel-header">
          <span class="panel-title group-tag" :class="{ selected: isGroupSelected(slot.groupId) }" @click="toggleGroup(slot.groupId)">
            {{ getGroupName(slot.groupId) }}
          </span>
          <button class="clear-btn" @click="clearSlot(idx)">×</button>
        </div>
        <div class="panel-body">
          <div v-for="sg in getSubgroups(slot.groupId)" :key="sg.sid" class="subgroup">
            <div class="subgroup-header">
              <span class="expand-icon" @click="sg._expanded = !sg._expanded">{{ sg._expanded ? '▾' : '▸' }}</span>
              <span class="subgroup-tag" :class="{ selected: isSubgroupSelected(sg) }" @click="toggleSubgroup(sg)">
                {{ sg.name }}
              </span>
              <span class="subgroup-count">({{ getFilteredTagIds(sg.tagIds).length }})</span>
            </div>
            <div v-if="sg._expanded" class="subgroup-tags">
              <div v-if="getCombinableTags(sg.tagIds).length > 0" class="tag-section">
                <span class="section-label">可组合</span>
                <div class="tag-list">
                  <span v-for="tag in getCombinableTags(sg.tagIds)" :key="tag.id" class="tag-chip"
                    :class="{ selected: isSelected(tag.id) }" @click="toggle(tag.id)">
                    {{ tag.display_name || tag.name }}
                  </span>
                </div>
              </div>
              <div v-if="getNonCombinableTags(sg.tagIds).length > 0" class="tag-section">
                <span class="section-label">互斥</span>
                <div class="tag-list">
                  <span v-for="tag in getNonCombinableTags(sg.tagIds)" :key="tag.id" class="tag-chip non-combinable"
                    :class="{ selected: isSelected(tag.id), disabled: isDisabled(tag) }" @click="handleNonCombinable(tag)">
                    {{ tag.display_name || tag.name }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div v-if="getGroupDirectTags(slot.groupId).length > 0" class="direct-tags">
            <div v-if="getCombinableTags(getGroupTagIds(slot.groupId)).length > 0" class="tag-section">
              <span class="section-label">可组合</span>
              <div class="tag-list">
                <span v-for="tag in getCombinableTags(getGroupTagIds(slot.groupId))" :key="tag.id" class="tag-chip"
                  :class="{ selected: isSelected(tag.id) }" @click="toggle(tag.id)">
                  {{ tag.display_name || tag.name }}
                </span>
              </div>
            </div>
            <div v-if="getNonCombinableTags(getGroupTagIds(slot.groupId)).length > 0" class="tag-section">
              <span class="section-label">互斥</span>
              <div class="tag-list">
                <span v-for="tag in getNonCombinableTags(getGroupTagIds(slot.groupId))" :key="tag.id" class="tag-chip non-combinable"
                  :class="{ selected: isSelected(tag.id), disabled: isDisabled(tag) }" @click="handleNonCombinable(tag)">
                  {{ tag.display_name || tag.name }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  tags: { type: Object, default: () => ({ combinable: [], nonCombinable: [] }) },
  selectedTagIds: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:selectedTagIds'])

const api = useApi()
const groups = ref([])

const STORAGE_KEY = 'taotu_tag_group_slots'
const savedSlots = import.meta.client ? JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') : null
const slots = ref(savedSlots || [
  { groupId: null }, { groupId: null }, { groupId: null },
  { groupId: null }, { groupId: null }
])

watch(slots, (val) => {
  if (import.meta.client) localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
}, { deep: true })

const hasSelection = computed(() => slots.value.some(s => s.groupId))
const allTags = computed(() => [...(props.tags.combinable || []), ...(props.tags.nonCombinable || [])])

onMounted(async () => {
  try {
    const data = await api.get('/api/tag-groups')
    groups.value = (data.groups || []).map(g => ({
      ...g,
      _expanded: false,
      subgroups: (g.subgroups || []).map(sg => ({ ...sg, _expanded: false }))
    }))
  } catch {}
})

const availableGroups = (currentIdx) => {
  const selectedIds = slots.value.map(s => s.groupId).filter(Boolean)
  return groups.value.filter(g => !selectedIds.includes(g.id) || slots.value[currentIdx].groupId === g.id)
}

const getGroupName = (id) => groups.value.find(g => g.id === id)?.name || ''
const getSubgroups = (id) => groups.value.find(g => g.id === id)?.subgroups || []
const getGroupTagIds = (id) => groups.value.find(g => g.id === id)?.tagIds || []
const getGroupDirectTags = (id) => allTags.value.filter(t => getGroupTagIds(id).includes(t.id))
const getFilteredTagIds = (tagIds) => (tagIds || []).filter(id => allTags.value.some(t => t.id === id))
const getCombinableTags = (tagIds) => getFilteredTagIds(tagIds).map(id => allTags.value.find(t => t.id === id)).filter(Boolean).filter(t => t.combinable !== false)
const getNonCombinableTags = (tagIds) => getFilteredTagIds(tagIds).map(id => allTags.value.find(t => t.id === id)).filter(Boolean).filter(t => t.combinable === false)
const isSelected = (id) => props.selectedTagIds.includes(id)

const parseMutualIds = (value) => {
  if (!value) return []
  return String(value)
    .split(/[,，.。\s]+/)
    .map(id => id.trim())
    .filter(Boolean)
    .map(id => /^u\d+$/i.test(id) ? `u${parseInt(id.slice(1))}` : (/^\d+$/.test(id) ? Number(id) : null))
    .filter(id => id !== null)
}

const mutualIdKey = (id) => /^u\d+$/i.test(String(id)) ? `u${parseInt(String(id).slice(1))}` : String(id)
const selectedKeys = computed(() => new Set(props.selectedTagIds.map(mutualIdKey)))
const hasMutualConflict = (tag, keys = selectedKeys.value) => parseMutualIds(tag.mutually_exclusive_with).some(id => keys.has(mutualIdKey(id)))
const isDisabled = (tag) => hasMutualConflict(tag) && !isSelected(tag.id)

const addSelectableTag = (nextIds, nextKeys, id) => {
  const tag = allTags.value.find(t => t.id === id)
  if (!tag || (hasMutualConflict(tag, nextKeys) && !nextKeys.has(mutualIdKey(id)))) return
  if (!nextIds.includes(id)) nextIds.push(id)
  nextKeys.add(mutualIdKey(id))
}

const toggle = (id) => {
  const tag = allTags.value.find(t => t.id === id)
  if (tag && isDisabled(tag)) return
  const newIds = [...props.selectedTagIds]
  const idx = newIds.indexOf(id)
  if (idx >= 0) newIds.splice(idx, 1)
  else newIds.push(id)
  emit('update:selectedTagIds', newIds)
}

const handleNonCombinable = (tag) => {
  if (isDisabled(tag)) return
  const newIds = [...props.selectedTagIds]
  const idx = newIds.indexOf(tag.id)
  if (idx >= 0) {
    newIds.splice(idx, 1)
  } else {
    for (const mutualId of parseMutualIds(tag.mutually_exclusive_with)) {
      const midx = newIds.findIndex(id => mutualIdKey(id) === mutualIdKey(mutualId))
      if (midx >= 0) newIds.splice(midx, 1)
    }
    newIds.push(tag.id)
  }
  emit('update:selectedTagIds', newIds)
}

const getGroupAllTagIds = (groupId) => {
  const group = groups.value.find(g => g.id === groupId)
  if (!group) return []
  const ids = [...(group.tagIds || [])]
  for (const sg of group.subgroups || []) ids.push(...(sg.tagIds || []))
  return getFilteredTagIds([...new Set(ids)])
}

const isGroupSelected = (groupId) => {
  const groupTagIds = getGroupAllTagIds(groupId)
  return groupTagIds.length > 0 && groupTagIds.every(id => props.selectedTagIds.includes(id))
}

const toggleGroup = (groupId) => {
  const groupTagIds = getGroupAllTagIds(groupId)
  if (isGroupSelected(groupId)) {
    emit('update:selectedTagIds', props.selectedTagIds.filter(id => !groupTagIds.includes(id)))
  } else {
    const nextIds = [...props.selectedTagIds]
    const nextKeys = new Set(nextIds.map(mutualIdKey))
    for (const id of groupTagIds) addSelectableTag(nextIds, nextKeys, id)
    emit('update:selectedTagIds', nextIds)
  }
}

const isSubgroupSelected = (sg) => {
  const sgTagIds = getFilteredTagIds(sg.tagIds || [])
  return sgTagIds.length > 0 && sgTagIds.every(id => props.selectedTagIds.includes(id))
}

const toggleSubgroup = (sg) => {
  const sgTagIds = getFilteredTagIds(sg.tagIds || [])
  if (isSubgroupSelected(sg)) {
    emit('update:selectedTagIds', props.selectedTagIds.filter(id => !sgTagIds.includes(id)))
  } else {
    const nextIds = [...props.selectedTagIds]
    const nextKeys = new Set(nextIds.map(mutualIdKey))
    for (const id of sgTagIds) addSelectableTag(nextIds, nextKeys, id)
    emit('update:selectedTagIds', nextIds)
  }
}

const onGroupChange = () => {}
</script>

<style scoped>
.tag-group-selector { display: flex; flex-direction: column; gap: var(--space-md); }
.group-selectors { display: flex; gap: var(--space-sm); flex-wrap: wrap; }
.group-slot { flex: 1; min-width: 120px; }
.group-select { width: 100%; padding: 6px 10px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 13px; background: white; }
.group-panels { display: flex; gap: var(--space-md); flex-wrap: wrap; }
.group-panel { flex: 1; min-width: 200px; max-width: 300px; border: 1px solid var(--fluent-border); border-radius: var(--radius-md); overflow: hidden; }
.panel-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--fluent-hover); font-size: 13px; font-weight: 600; }
.group-tag { padding: 3px 12px; border: 1px solid var(--fluent-border); border-radius: 14px; cursor: pointer; transition: all var(--transition-fast); font-size: 13px; }
.group-tag:hover { background: var(--fluent-blue-light); border-color: var(--fluent-blue); }
.group-tag.selected { background: var(--fluent-blue); color: white; border-color: var(--fluent-blue); }
.clear-btn { background: none; border: none; font-size: 16px; cursor: pointer; color: var(--fluent-text-secondary); padding: 0 4px; }
.clear-btn:hover { color: #d13438; }
.panel-body { max-height: 300px; overflow-y: auto; padding: var(--space-sm); }
.subgroup { margin-bottom: var(--space-xs); }
.subgroup-header { display: flex; align-items: center; gap: 4px; padding: 4px 6px; font-size: 13px; font-weight: 500; border-radius: var(--radius-sm); }
.subgroup-header:hover { background: var(--fluent-hover); }
.expand-icon { font-size: 11px; width: 14px; cursor: pointer; }
.subgroup-tag { padding: 2px 10px; border: 1px solid var(--fluent-border); border-radius: 12px; cursor: pointer; transition: all var(--transition-fast); font-size: 12px; }
.subgroup-tag:hover { background: var(--fluent-blue-light); border-color: var(--fluent-blue); }
.subgroup-tag.selected { background: var(--fluent-blue); color: white; border-color: var(--fluent-blue); }
.subgroup-count { font-size: 11px; color: var(--fluent-text-secondary); margin-left: 2px; }
.subgroup-tags { padding-left: 20px; }
.tag-section { margin-bottom: var(--space-xs); }
.section-label { font-size: 10px; color: var(--fluent-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.tag-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.tag-chip { padding: 2px 8px; border: 1px solid var(--fluent-border); border-radius: 12px; font-size: 12px; cursor: pointer; transition: all var(--transition-fast); }
.tag-chip:hover { background: var(--fluent-hover); }
.tag-chip.selected { background: var(--fluent-blue); color: white; border-color: var(--fluent-blue); }
.tag-chip.non-combinable { border-style: dashed; }
.tag-chip.disabled { opacity: 0.4; cursor: not-allowed; }
.direct-tags { padding-top: var(--space-sm); border-top: 1px solid var(--fluent-border); margin-top: var(--space-sm); }
</style>
