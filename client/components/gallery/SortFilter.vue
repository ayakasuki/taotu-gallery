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
  { label: '瀑布流', value: 'waterfall' }
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
  gap: 14px;
  flex-wrap: wrap;
  padding: 8px;
  border-radius: var(--taotu-radius-md);
  background: rgba(255, 255, 255, 0.54);
  border: 1px solid rgba(255,255,255,0.7);
  backdrop-filter: blur(16px);
}

.sort-group, .mode-group {
  display: flex;
  align-items: center;
  gap: 7px;
}

.sort-label {
  font-size: 12px;
  color: var(--taotu-text-muted);
  font-weight: 900;
}

.sort-btn {
  min-height: 32px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
  border: 1px solid rgba(238, 210, 226, 0.74);
  background: rgba(255,255,255,0.66);
  color: var(--taotu-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sort-btn:hover {
  background: rgba(255,255,255,0.66);
  color: #000000;
}

.sort-btn.active {
  background: linear-gradient(135deg, var(--taotu-pink), var(--taotu-pink-2));
  color: white;
  border-color: transparent;
  box-shadow: 0 8px 20px rgba(248,95,154,0.18);
}
</style>
