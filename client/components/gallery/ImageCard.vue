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
      <div v-if="mode === 'grid'" class="view-badge">浏览{{ image.view_count || 0 }}</div>
      <div class="image-gradient"></div>
      <div class="image-info">
        <div v-if="mode === 'grid' && image.tags && image.tags.length > 0" class="tag-strip">
          <span v-for="tag in image.tags" :key="tagKey(tag)" class="tag-badge">{{ tag.display_name || tag.name }}</span>
          <span v-if="image.tags.length > 2" class="tag-more">...</span>
        </div>
        <div class="alt-title">{{ altText }}</div>
        <div v-if="uploaderText" class="alt-subtitle">{{ uploaderText }}</div>
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
const uploaderText = computed(() => props.image.uploader_name ? '来自 ' + props.image.uploader_name + ' 的图片' : '')

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
</script>

<style scoped>
.image-card {
  width: 100%;
  cursor: pointer;
  overflow: hidden;
  background: #111;
  border-radius: 3px;
  transform: translateZ(0);
}

.card-media {
  position: relative;
  width: 100%;
  aspect-ratio: var(--card-aspect);
  overflow: hidden;
  background: #111;
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
  top: 6px;
  left: 7px;
  z-index: 3;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
  padding: 4px 6px;
  border-radius: 3px;
  background: rgba(0,0,0,0.34);
  text-shadow: 0 1px 2px rgba(0,0,0,0.75);
}

.image-gradient {
  position: absolute;
  inset: auto 0 0;
  height: 42%;
  z-index: 1;
  background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.68));
  pointer-events: none;
}

.image-info {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  padding: 24px 8px 8px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.image-card.mode-waterfall .image-info,
.image-card.mode-waterfall .image-gradient {
  opacity: 0;
}

.image-card.mode-waterfall:hover .image-info,
.image-card.mode-waterfall:hover .image-gradient {
  opacity: 1;
}

.tag-strip {
  position: relative;
  display: flex;
  gap: 4px;
  align-items: center;
  overflow: hidden;
  white-space: nowrap;
  margin-bottom: 4px;
  padding-right: 22px;
}

.tag-badge {
  flex: 0 0 auto;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.22);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  backdrop-filter: blur(3px);
}

.tag-more {
  position: absolute;
  right: 0;
  bottom: 1px;
  width: 22px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  text-align: right;
  background: linear-gradient(90deg, rgba(0,0,0,0), rgba(0,0,0,0.55) 45%);
}

.alt-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.28;
}

.alt-subtitle {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.25;
}
</style>
