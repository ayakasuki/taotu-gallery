<template>
  <div class="sort-filter">
    <div class="sort-group">
      <label class="sort-label">排序:</label>
      <button
        v-for="opt in sortOptions"
        :key="opt.value"
        class="sort-btn"
        :class="{ active: currentSort === opt.value }"
        @click="setSort(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <div class="mode-group">
      <label class="sort-label">展示:</label>
      <button
        v-for="opt in modeOptions"
        :key="opt.value"
        class="sort-btn"
        :class="{ active: currentMode === opt.value }"
        @click="setMode(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  currentSort: { type: String, default: 'created_at' },
  currentOrder: { type: String, default: 'desc' },
  currentMode: { type: String, default: 'grid' }
})

const emit = defineEmits(['update:sort', 'update:order', 'update:mode'])

const sortOptions = [
  { label: '最新', value: 'created_at' },
  { label: '最热门', value: 'view_count' },
  { label: '文件名', value: 'filename' }
]

const modeOptions = [
  { label: '网格', value: 'grid' },
  { label: '瀑布流', value: 'waterfall' },
  { label: '静态', value: 'static' },
  { label: '轮播', value: 'carousel' }
]

const setSort = (value) => {
  emit('update:sort', value)
}

const setMode = (value) => {
  emit('update:mode', value)
}
</script>

<style scoped>
.sort-filter {
  display: flex;
  align-items: center;
  gap: var(--space-xl);
  padding: var(--space-md) 0;
}

.sort-group, .mode-group {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.sort-label {
  font-size: 13px;
  color: var(--fluent-text-secondary);
  font-weight: 500;
}

.sort-btn {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  border: 1px solid var(--fluent-border);
  background: transparent;
  color: var(--fluent-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sort-btn:hover {
  background: var(--fluent-hover);
}

.sort-btn.active {
  background: var(--fluent-blue);
  color: white;
  border-color: var(--fluent-blue);
}
</style>
