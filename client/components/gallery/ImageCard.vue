<template>
  <div class="image-card" @click="$emit('click', image)">
    <div class="card-image">
      <img
        :src="imageUrl"
        :alt="image.filename"
        loading="lazy"
        @load="loaded = true"
        :class="{ loaded }"
      />
      <div class="card-overlay" v-if="showOverlay">
        <span class="view-count">{{ image.view_count || 0 }} 浏览</span>
      </div>
    </div>
    <div class="card-info" v-if="showInfo">
      <p class="card-filename">{{ image.filename }}</p>
      <div class="card-tags" v-if="image.tags && image.tags.length > 0">
        <span v-for="tag in image.tags.slice(0, 3)" :key="tag.id" class="tag-badge">
          {{ tag.display_name || tag.name }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  image: { type: Object, required: true },
  showInfo: { type: Boolean, default: true },
  showOverlay: { type: Boolean, default: true }
})

defineEmits(['click'])

const loaded = ref(false)

const config = useRuntimeConfig()
const imageUrl = computed(() => {
  const url = props.image.thumb_url || props.image.url
  return url ? `${config.public.apiBase}${url}` : ''
})
</script>

<style scoped>
.image-card {
  background: var(--fluent-bg-card);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-1);
  transition: all var(--transition-normal);
  cursor: pointer;
}

.image-card:hover {
  box-shadow: var(--shadow-3);
  transform: translateY(-2px);
}

.card-image {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1;
  background: var(--fluent-hover);
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.card-image img.loaded {
  opacity: 1;
}

.card-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-sm);
  background: linear-gradient(transparent, rgba(0,0,0,0.5));
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.image-card:hover .card-overlay {
  opacity: 1;
}

.view-count {
  color: white;
  font-size: 12px;
}

.card-info {
  padding: var(--space-sm) var(--space-md);
}

.card-filename {
  font-size: 13px;
  color: var(--fluent-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.card-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
</style>
