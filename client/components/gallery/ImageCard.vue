<template>
  <div
    class="image-card"
    :class="['mode-' + mode, { 'is-active': infoActive }]"
    :style="cardStyle"
    @mouseenter="infoActive = true"
    @mouseleave="infoActive = false"
    @focusin="infoActive = true"
    @focusout="infoActive = false"
    @click="$emit('click', image)"
  >
    <div ref="mediaRef" class="card-media" :style="mediaStyle">
      <img
        v-if="loadedSrc"
        :src="loadedSrc"
        :alt="altText"
        loading="eager"
        decoding="async"
        class="loaded"
      />
      <div v-if="!loadedSrc" class="image-loading-shimmer"></div>
      <div v-if="mode === 'grid'" class="view-badge">
        <TaotuIcon name="views" class="view-icon" />
        {{ formatViews(image.view_count || 0) }}
      </div>
      <div v-if="shouldRenderInfo" class="image-gradient"></div>
      <div v-if="shouldRenderInfo" class="image-info">
        <div class="alt-title">{{ altText }}</div>
        <div v-if="showGridDetails && uploaderText" class="alt-subtitle">@ {{ uploaderText }}</div>
        <div v-if="showGridDetails && displayTags.length > 0" class="tag-strip">
          <span v-for="(tag, idx) in displayTags" :key="tagKey(tag)" class="tag-badge">
            {{ tag.display_name || tag.name }}{{ idx === displayTags.length - 1 && hasMoreTags ? '...' : '' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  image: { type: Object, required: true },
  mode: { type: String, default: 'grid' },
  shouldLoadImage: { type: Boolean, default: true },
  showInfo: { type: Boolean, default: true },
  showOverlay: { type: Boolean, default: true }
})

defineEmits(['click'])

const mediaRef = ref(null)
const loadedSrc = ref('')
const isNearViewport = ref(false)
const infoActive = ref(false)
const config = useRuntimeConfig()
let observer = null
let cancelled = false

const galleryImageQueue = import.meta.client
  ? (window.__taotuGalleryImageQueue ||= {
      running: false,
      items: [],
      seen: new Map(),
      enqueue(task) {
        if (this.seen.has(task.src)) return this.seen.get(task.src)
        const promise = new Promise((resolve, reject) => {
          this.items.push({ ...task, resolve, reject })
          this.run()
        })
        this.seen.set(task.src, promise)
        return promise
      },
      async run() {
        if (this.running) return
        this.running = true
        while (this.items.length) {
          const task = this.items.shift()
          try {
            await new Promise(resolve => setTimeout(resolve, 10))
            await new Promise((resolve, reject) => {
              const img = new Image()
              img.decoding = 'async'
              img.onload = async () => {
                try { if (img.decode) await img.decode() } catch {}
                task.resolve(task.src)
                resolve()
              }
              img.onerror = () => {
                const error = new Error('图片加载失败')
                task.reject(error)
                reject(error)
              }
              img.src = task.src
            })
          } catch (err) {
            if (!String(err?.message || '').includes('图片加载失败')) task.reject(err)
          }
        }
        this.running = false
      }
    })
  : null

const imageUrl = computed(() => {
  const url = props.image.medium_url || props.image.thumb_url || props.image.url
  return url ? (config.public.apiBase || '') + url : ''
})

const placeholderColor = computed(() => {
  const color = String(props.image.avg_color || '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#f7dce8'
})

const altText = computed(() => props.image.alt || props.image.title || props.image.filename || '图片')
const uploaderText = computed(() => props.image.uploader_name || props.image.username || '')
const displayTags = computed(() => (props.image.tags || []).slice(0, 4))
const hasMoreTags = computed(() => (props.image.tags || []).length > 4)
const showGridDetails = computed(() => props.mode === 'grid' && infoActive.value)
const shouldRenderInfo = computed(() => props.mode === 'waterfall' || infoActive.value)

const naturalAspect = computed(() => {
  const width = Number(props.image.width) || 1
  const height = Number(props.image.height) || 1
  return width > 0 && height > 0 ? width / height : 1
})

const displayAspect = computed(() => {
  if (props.mode === 'waterfall') return naturalAspect.value
  return naturalAspect.value < 1 ? naturalAspect.value : 1
})

const cardStyle = computed(() => ({
  '--card-aspect': Math.max(displayAspect.value, 0.25) + ' / 1'
}))

const mediaStyle = computed(() => ({
  backgroundColor: placeholderColor.value
}))

const shouldQueueLoad = computed(() => props.shouldLoadImage && isNearViewport.value && Boolean(imageUrl.value) && !loadedSrc.value)

const queueLoad = async () => {
  if (!galleryImageQueue || !shouldQueueLoad.value) return
  const src = imageUrl.value
  try {
    const loaded = await galleryImageQueue.enqueue({ src })
    if (!cancelled && loaded === imageUrl.value) {
      loadedSrc.value = loaded
      if (observer) {
        observer.disconnect()
        observer = null
      }
    }
  } catch {}
}

const setupObserver = () => {
  if (!import.meta.client || !mediaRef.value) return
  if (observer) observer.disconnect()
  observer = new IntersectionObserver((entries) => {
    isNearViewport.value = entries.some(entry => entry.isIntersecting)
  }, { root: null, rootMargin: '1200px 0px', threshold: 0.01 })
  observer.observe(mediaRef.value)
}

watch(shouldQueueLoad, (value) => {
  if (value) queueLoad()
}, { immediate: true })

watch(imageUrl, () => {
  loadedSrc.value = ''
  nextTick(() => queueLoad())
})

onMounted(async () => {
  await nextTick()
  setupObserver()
  queueLoad()
})

onBeforeUnmount(() => {
  cancelled = true
  if (observer) observer.disconnect()
})

const tagKey = (tag) => (tag.source || 'tag') + '-' + (tag.id || tag.name)
const formatViews = (count) => {
  const n = Number(count) || 0
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return n
}
</script>

<style scoped>
.image-card {
  width: 100%;
  cursor: pointer;
  overflow: hidden;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.56);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(60, 68, 96, 0.12);
  transition: box-shadow 0.18s ease, border-color 0.18s ease;
  contain: layout paint style;
}

.image-card.mode-grid {
  box-shadow: 0 6px 18px rgba(60, 68, 96, 0.1);
  transform: translateZ(0);
  backface-visibility: hidden;
}

.image-card:hover {
  border-color: rgba(248, 95, 154, 0.58);
  box-shadow: 0 16px 40px rgba(248, 95, 154, 0.16);
}

.card-media {
  position: relative;
  width: 100%;
  aspect-ratio: var(--card-aspect);
  overflow: hidden;
  background: rgba(255, 240, 246, 0.72);
  contain: paint;
  transform: translateZ(0);
}

.card-media > img.loaded {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 1;
  animation: imageFadeIn 0.28s ease both;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.image-loading-shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.22) 46%, rgba(255,255,255,0.02) 92%);
  animation: placeholderBreath 1.6s ease-in-out infinite;
  pointer-events: none;
}

@keyframes imageFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes placeholderBreath {
  0%, 100% { opacity: 0.28; }
  50% { opacity: 0.72; }
}

.view-badge {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 4px;
  width: max-content;
  max-width: calc(100% - 16px);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  padding: 5px 8px;
  border-radius: 999px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  background: rgba(22, 26, 38, 0.5);
  text-shadow: 0 1px 2px rgba(0,0,0,0.75);
}

.view-badge .view-icon {
  width: 14px;
  height: 14px;

  opacity: 0.92;
}

.image-gradient {
  position: absolute;
  inset: auto 0 0;
  height: 56%;
  z-index: 1;
  background: linear-gradient(180deg, rgba(0,0,0,0), rgba(36,39,54,0.72));
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s ease;
  will-change: opacity;
}

.image-info {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  padding: 46px 10px 12px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  will-change: opacity, transform;
}

.image-card.mode-grid:hover .image-info,
.image-card.mode-grid:hover .image-gradient,
.image-card.mode-waterfall:hover .image-info,
.image-card.mode-waterfall:hover .image-gradient {
  opacity: 1;
  transform: translateY(0);
}

.image-card.mode-waterfall .image-gradient {
  height: 40%;
}

.image-card.mode-waterfall .image-info {
  padding-top: 34px;
}

.tag-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
  max-height: 46px;
  overflow: hidden;
}

.tag-badge {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 3px 6px;
  border-radius: 999px;
  background: rgba(255,255,255,0.24);
  color: #fff;
  font-size: 11px;
  line-height: 1.1;
  font-weight: 800;
  white-space: nowrap;
}

.alt-title {
  font-weight: 800;
  font-size: 13px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alt-subtitle {
  margin-top: 4px;
  color: rgba(255,255,255,0.82);
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-card.mode-waterfall .alt-subtitle,
.image-card.mode-waterfall .tag-strip {
  display: none;
}
</style>
