<template>
  <div class="image-card" :class="['mode-' + mode]" :style="cardStyle" @click="$emit('click', image)">
    <div class="card-media">
      <img
        :src="imageUrl"
        :alt="altText"
        loading="lazy"
        @load="loaded = true"
        :class="{ loaded }"
      />
      <div v-if="mode === 'grid'" class="view-badge">
        <img src="/icons/gallery/views-64x64.png" class="view-icon" alt="" />
        {{ formatViews(image.view_count || 0) }}
      </div>
      <div class="image-gradient"></div>
      <div class="image-info">
        <div class="alt-title">{{ altText }}</div>
        <div v-if="mode === 'grid' && uploaderText" class="alt-subtitle">@ {{ uploaderText }}</div>
        <div v-if="mode === 'grid' && displayTags.length > 0" class="tag-strip">
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
  showInfo: { type: Boolean, default: true },
  showOverlay: { type: Boolean, default: true }
})

defineEmits(['click'])

const loaded = ref(false)
const config = useRuntimeConfig()

const imageUrl = computed(() => {
  const url = props.image.medium_url || props.image.url || props.image.thumb_url
  return url ? (config.public.apiBase || '') + url : ''
})

const altText = computed(() => props.image.alt || props.image.title || props.image.filename || '图片')
const uploaderText = computed(() => props.image.uploader_name || props.image.username || '')
const displayTags = computed(() => (props.image.tags || []).slice(0, 4))
const hasMoreTags = computed(() => (props.image.tags || []).length > 4)

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
  transform: translateZ(0);
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
}

.image-card:hover {
  transform: translateY(-2px);
  border-color: rgba(248, 95, 154, 0.58);
  box-shadow: 0 16px 40px rgba(248, 95, 154, 0.16);
}

.card-media {
  position: relative;
  width: 100%;
  aspect-ratio: var(--card-aspect);
  overflow: hidden;
  background: rgba(255, 240, 246, 0.72);
}

.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transition: opacity 0.25s ease, transform 0.28s ease;
}

.card-media img.loaded { opacity: 1; }
.image-card:hover .card-media img { transform: scale(1.025); }

.view-badge {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(22, 26, 38, 0.5);
  text-shadow: 0 1px 2px rgba(0,0,0,0.75);
  backdrop-filter: blur(8px);
}

.view-badge .view-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  filter: brightness(0) invert(1);
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
}

.image-card.mode-grid:hover .image-info,
.image-card.mode-grid:hover .image-gradient {
  opacity: 1;
  transform: translateY(0);
}

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
  position: relative;
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
  max-height: 24px;
  overflow: hidden;
  margin-top: 7px;
}

.tag-badge {
  flex: 0 0 auto;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.2);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  backdrop-filter: blur(6px);
}

.alt-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 15px;
  font-weight: 900;
  line-height: 1.28;
}

.alt-subtitle {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.25;
}

.image-card.mode-waterfall .alt-subtitle,
.image-card.mode-waterfall .tag-strip {
  display: none;
}
</style>
