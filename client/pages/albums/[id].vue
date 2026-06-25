<template>
  <div class="album-detail page-container">
    <div v-if="album" class="album-header">
      <h1 class="page-title">{{ album.name }}</h1>
      <p class="album-desc" v-if="album.description">{{ album.description }}</p>
      <p class="album-stats">{{ album.image_count || 0 }} 张图片</p>
    </div>

    <GalleryGrid
      :images="images"
      mode="grid"
      :loading="loading"
      @select="(img) => navigateTo(`/image/${img.id}`)"
    />

    <div v-if="!album && !loading" class="empty-state">相册不存在</div>
  </div>
</template>

<script setup>
import GalleryGrid from '~/components/gallery/GalleryGrid.vue'

const route = useRoute()
const config = useRuntimeConfig()

const album = ref(null)
const images = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const api = useApi()
    const data = await api.get(`/api/internal/albums/${route.params.id}`)
    album.value = data
    images.value = data.images || []
  } catch (err) {
    console.error('获取相册详情失败:', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.album-header {
  margin-bottom: var(--space-xl);
}

.page-title {
  font-size: 24px;
  font-weight: 600;
}

.album-desc {
  color: var(--fluent-text-secondary);
  margin-top: var(--space-sm);
}

.album-stats {
  font-size: 14px;
  color: var(--fluent-text-secondary);
  margin-top: var(--space-xs);
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--fluent-text-secondary);
}
</style>
