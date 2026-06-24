<template>
  <div class="gallery-page page-container">
    <div class="gallery-header">
      <div class="gallery-title-row">
        <h1 class="page-title">图库</h1>
        <div class="gallery-source-toggle">
          <button class="source-btn" :class="{ active: gallerySource === 'public' }" @click="switchSource('public')">公共图库</button>
          <button v-if="isLoggedIn" class="source-btn" :class="{ active: gallerySource === 'mine' }" @click="switchSource('mine')">我的图库</button>
          <button v-if="isAdmin" class="source-btn" :class="{ active: gallerySource === 'user' }" @click="switchSource('user')">用户图库</button>
          <select v-if="gallerySource === 'user'" v-model="selectedUserId" class="user-select" @change="loadGallery">
            <option :value="null">全部用户</option>
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.username }}</option>
          </select>
        </div>
      </div>
      <div class="gallery-controls">
        <SortFilter :currentSort="sort" :currentMode="displayMode" @update:sort="handleSortChange" @update:mode="handleModeChange" />
      </div>
    </div>

    <div class="gallery-body">
      <aside class="gallery-sidebar">
        <div class="sidebar-card fluent-card">
          <h3 class="sidebar-title">标签筛选</h3>
          <TagSelector :tags="tags" :selectedTagIds="selectedTagIds" @update:selectedTagIds="handleTagSelection" />
        </div>
      </aside>

      <div class="gallery-main">
        <GalleryGrid :images="images" :mode="displayMode" :loading="loading" @select="handleImageSelect" />

        <div v-if="images.length === 0 && !loading" class="empty-state">
          <p>{{ emptyText }}</p>
        </div>

        <div class="pagination" v-if="total > 20">
          <button class="fluent-btn fluent-btn-secondary" :disabled="page <= 1" @click="handlePageChange(page - 1)">上一页</button>
          <span class="page-info">第 {{ page }} 页 / 共 {{ Math.ceil(total / 20) }} 页</span>
          <button class="fluent-btn fluent-btn-secondary" :disabled="page >= Math.ceil(total / 20)" @click="handlePageChange(page + 1)">下一页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import TagSelector from '~/components/tags/TagSelector.vue'
import SortFilter from '~/components/gallery/SortFilter.vue'
import GalleryGrid from '~/components/gallery/GalleryGrid.vue'

const { tags, selectedTagIds, fetchTags } = useTags()
const { images, total, page, loading, displayMode, sort, fetchImages, setDisplayMode, setSort } = useGallery()

const isLoggedIn = ref(false)
const isAdmin = ref(false)
const gallerySource = ref('public')
const selectedUserId = ref(null)
const users = ref([])

const emptyText = computed(() => {
  if (gallerySource.value === 'mine') return '您还没有上传图片'
  if (gallerySource.value === 'user') return selectedUserId.value ? '该用户暂无图片' : '暂无图片'
  return '暂无公共图片'
})

onMounted(async () => {
  const token = localStorage.getItem('jwt_token')
  isLoggedIn.value = !!token
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      isAdmin.value = payload.role === 'admin'
    } catch {}
  }
  await fetchTags()
  if (isAdmin.value) await loadUsers()
  await loadGallery()
})

const loadUsers = async () => {
  try {
    const api = useApi()
    const data = await api.get('/api/admin/users')
    users.value = data.users || []
  } catch {}
}

const loadGallery = () => {
  const params = {
    tags: selectedTagIds.value.length > 0 ? selectedTagIds.value.join(',') : undefined,
    page: 1
  }
  if (gallerySource.value === 'mine') {
    params.mine = 'true'
  } else if (gallerySource.value === 'user') {
    if (selectedUserId.value) params.userId = selectedUserId.value
  } else {
    params.public = 'true'
  }
  fetchImages(params)
}

const switchSource = (source) => {
  gallerySource.value = source
  if (source !== 'user') selectedUserId.value = null
  loadGallery()
}

const handleTagSelection = (newTagIds) => {
  selectedTagIds.value = newTagIds
  loadGallery()
}

const handleSortChange = (newSort) => {
  setSort(newSort)
  loadGallery()
}

const handleModeChange = (mode) => setDisplayMode(mode)

const handlePageChange = (newPage) => {
  const params = { page: newPage, tags: selectedTagIds.value.length > 0 ? selectedTagIds.value.join(',') : undefined }
  if (gallerySource.value === 'mine') params.mine = 'true'
  else if (gallerySource.value === 'user') { if (selectedUserId.value) params.userId = selectedUserId.value }
  else params.public = 'true'
  fetchImages(params)
}

const handleImageSelect = (image) => navigateTo(`/image/${image.id}`)
</script>

<style scoped>
.gallery-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); flex-wrap: wrap; gap: var(--space-md); }
.gallery-title-row { display: flex; align-items: center; gap: var(--space-lg); flex-wrap: wrap; }
.page-title { font-size: 24px; font-weight: 600; }
.gallery-source-toggle { display: flex; gap: 2px; background: var(--fluent-hover); border-radius: var(--radius-sm); padding: 2px; align-items: center; }
.source-btn { padding: 6px 16px; border: none; background: transparent; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; transition: all var(--transition-fast); color: var(--fluent-text-secondary); }
.source-btn.active { background: white; box-shadow: var(--shadow-1); font-weight: 500; color: var(--fluent-blue); }
.user-select { margin-left: 6px; padding: 4px 8px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 12px; background: white; }
.gallery-body { display: flex; gap: var(--space-lg); }
.gallery-sidebar { width: 280px; flex-shrink: 0; }
.sidebar-card { position: sticky; top: 72px; }
.sidebar-title { font-size: 15px; font-weight: 600; margin-bottom: var(--space-md); }
.gallery-main { flex: 1; min-width: 0; }
.pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-md); padding: var(--space-xl) 0; }
.page-info { font-size: 13px; color: var(--fluent-text-secondary); }
.empty-state { text-align: center; padding: var(--space-2xl); color: var(--fluent-text-secondary); }
@media (max-width: 768px) { .gallery-body { flex-direction: column; } .gallery-sidebar { width: 100%; } .sidebar-card { position: static; } }
</style>
