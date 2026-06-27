<template>
  <div class="gallery-grid" :class="['mode-' + safeMode]">
    <div class="waterfall-layout" ref="waterfallRef" :style="{ height: waterfallHeight + 'px' }">
      <div
        v-for="(image, index) in images"
        :key="image.id"
        class="waterfall-item"
        :style="getWaterfallItemStyle(index)"
      >
        <ImageCard :image="image" :mode="safeMode" @click="$emit('select', image)" />
      </div>
    </div>

    <div v-if="images.length === 0 && !loading" class="empty-state">
      <p>暂无图片</p>
    </div>

    <div v-if="loading" class="loading-state">
      <p>加载中...</p>
    </div>
  </div>
</template>

<script setup>
import ImageCard from './ImageCard.vue'

const props = defineProps({
  images: { type: Array, default: () => [] },
  mode: { type: String, default: 'grid' },
  loading: { type: Boolean, default: false }
})

defineEmits(['select'])

const waterfallRef = ref(null)
const waterfallItems = ref([])
const waterfallHeight = ref(0)
const gap = 10
const minGridColumnWidth = 190
const minWaterfallColumnWidth = 200
let resizeObserver = null

const safeMode = computed(() => props.mode === 'waterfall' ? 'waterfall' : 'grid')

const getImageAspect = (image) => {
  const width = Number(image.width) || 1
  const height = Number(image.height) || 1
  return width > 0 && height > 0 ? width / height : 1
}

const getDisplayAspect = (image) => {
  const aspect = getImageAspect(image)
  if (safeMode.value === 'waterfall') return aspect
  return aspect < 1 ? aspect : 1
}

const calculateWaterfall = () => {
  const width = waterfallRef.value?.clientWidth || 0
  if (!width || props.images.length === 0) {
    waterfallItems.value = []
    waterfallHeight.value = 0
    return
  }
  const minColumnWidth = safeMode.value === 'waterfall' ? minWaterfallColumnWidth : minGridColumnWidth
  let columns = Math.floor((width + gap) / (minColumnWidth + gap))
  columns = Math.max(width <= 560 ? 2 : 1, columns)
  const columnWidth = (width - (columns - 1) * gap) / columns
  const heights = new Array(columns).fill(0)
  waterfallItems.value = props.images.map(image => {
    const itemHeight = columnWidth / Math.max(getDisplayAspect(image), 0.25)
    const top = Math.min(...heights)
    const columnIndex = heights.indexOf(top)
    const left = columnIndex * (columnWidth + gap)
    heights[columnIndex] = top + itemHeight + gap
    return { left, top, width: columnWidth, height: itemHeight }
  })
  waterfallHeight.value = Math.max(0, ...heights)
}

const scheduleLayout = () => requestAnimationFrame(calculateWaterfall)

const getWaterfallItemStyle = (index) => {
  const item = waterfallItems.value[index]
  if (!item) return { opacity: 0 }
  return {
    width: item.width + 'px',
    height: item.height + 'px',
    transform: 'translate3d(' + item.left + 'px,' + item.top + 'px,0)'
  }
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => scheduleLayout())
  if (waterfallRef.value) resizeObserver.observe(waterfallRef.value)
  scheduleLayout()
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
})

watch(() => props.images, async () => { await nextTick(); scheduleLayout() }, { deep: true })
watch(safeMode, async () => { await nextTick(); scheduleLayout() })
</script>

<style scoped>
.gallery-grid { width: 100%; }
.waterfall-layout { position: relative; width: 100%; min-height: 220px; }
.waterfall-item { position: absolute; left: 0; top: 0; transition: transform 0.22s ease, opacity 0.18s ease; }
.empty-state, .loading-state {
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-2xl);
  color: var(--taotu-text-muted);
  border: 1px dashed rgba(248, 95, 154, 0.24);
  border-radius: var(--taotu-radius-lg);
  background: rgba(255,255,255,0.44);
}
</style>
