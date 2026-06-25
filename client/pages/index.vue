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
        <!-- 批量操作栏 -->
        <div v-if="gallerySource === 'mine' && selectedIds.length > 0" class="batch-bar">
          <span class="batch-count">已选 {{ selectedIds.length }} 张</span>
          <button class="fluent-btn fluent-btn-secondary" @click="selectAllCurrent">全选当前页</button>
          <button class="fluent-btn fluent-btn-secondary" @click="selectedIds = []">取消选择</button>
          <button class="fluent-btn fluent-btn-secondary delete-btn" @click="batchDelete">批量删除</button>
          <button class="fluent-btn fluent-btn-primary" @click="showMoveModal = true">移动到相册</button>
        </div>

        <!-- 图片网格（带多选框） -->
        <div class="gallery-with-select">
          <div v-for="img in images" :key="img.id" class="gallery-item-wrapper" :class="{ selected: selectedIds.includes(img.id) }" @click="handleItemClick(img)">
            <div class="select-checkbox" v-if="gallerySource === 'mine'" @click.stop="toggleSelect(img.id)">
              <img :src="selectedIds.includes(img.id) ? '/icons/选中.png' : '/icons/未选中.png'" class="check-icon" />
            </div>
            <ImageCard :image="img" :showInfo="true" :clickDisabled="selectedIds.length > 0" />
          </div>
        </div>

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

    <!-- 移动到相册弹窗 -->
    <div v-if="showMoveModal" class="modal-overlay" @click.self="showMoveModal = false">
      <div class="modal fluent-card">
        <h3>移动到相册</h3>
        <p class="modal-desc">将选中的 {{ selectedIds.length }} 张图片移动到：</p>
        <div class="form-group">
          <select v-model="moveToAlbumId" class="fluent-select">
            <option :value="null">请选择相册</option>
            <option v-for="a in albums" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>或新建相册</label>
          <input v-model="newAlbumName" class="fluent-input" placeholder="输入新相册名" />
        </div>
        <div class="modal-actions">
          <button class="fluent-btn fluent-btn-primary" @click="moveToAlbum" :disabled="!moveToAlbumId && !newAlbumName">确认移动</button>
          <button class="fluent-btn fluent-btn-secondary" @click="showMoveModal = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import TagSelector from '~/components/tags/TagSelector.vue'
import SortFilter from '~/components/gallery/SortFilter.vue'
import ImageCard from '~/components/gallery/ImageCard.vue'

const { tags, selectedTagIds, fetchTags } = useTags()
const { images, total, page, loading, displayMode, sort, fetchImages, setDisplayMode, setSort } = useGallery()
const api = useApi()
const config = useRuntimeConfig()

const isLoggedIn = ref(false)
const isAdmin = ref(false)
const gallerySource = ref('public')
const selectedUserId = ref(null)
const users = ref([])

// 多选相关
const selectedIds = ref([])

// 移动相册相关
const showMoveModal = ref(false)
const moveToAlbumId = ref(null)
const newAlbumName = ref('')
const albums = ref([])

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
    const data = await api.get('/api/admin/users')
    users.value = data.users || []
  } catch {}
}

const loadAlbums = async () => {
  try {
    const data = await api.get('/api/albums')
    albums.value = data.albums || []
  } catch {}
}

const loadGallery = () => {
  selectedIds.value = []
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
  if (source === 'mine') loadAlbums()
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

// 点击图片：如果已有选中则切换选中状态，否则跳转详情
const handleItemClick = (image) => {
  if (gallerySource.value !== 'mine') {
    navigateTo(`/image/${image.id}`)
    return
  }
  if (selectedIds.value.length > 0) {
    toggleSelect(image.id)
  } else {
    navigateTo(`/image/${image.id}`)
  }
}

// 多选
const toggleSelect = (id) => {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

const selectAllCurrent = () => {
  selectedIds.value = images.value.map(img => img.id)
}

// 批量删除
const batchDelete = async () => {
  if (!confirm(`确定删除选中的 ${selectedIds.value.length} 张图片？`)) return
  let success = 0
  for (const id of selectedIds.value) {
    try { await api.del(`/api/admin/images/${id}`); success++ } catch {}
  }
  alert(`已删除 ${success} 张图片`)
  selectedIds.value = []
  await loadGallery()
}

// 移动到相册
const moveToAlbum = async () => {
  let albumId = moveToAlbumId.value

  // 新建相册
  if (!albumId && newAlbumName.value) {
    try {
      const album = await api.post('/api/admin/albums', { name: newAlbumName.value })
      albumId = album.id
    } catch (err) { alert('创建相册失败'); return }
  }

  if (!albumId) return alert('请选择或创建相册')

  let success = 0
  for (const id of selectedIds.value) {
    try { await api.put(`/api/admin/images/${id}`, { album_id: albumId }); success++ } catch {}
  }

  alert(`已移动 ${success} 张图片到相册`)
  selectedIds.value = []
  showMoveModal.value = false
  moveToAlbumId.value = null
  newAlbumName.value = ''
  await loadGallery()
}
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

/* 批量操作栏 */
.batch-bar { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-md); margin-bottom: var(--space-md); background: var(--fluent-blue-light); border-radius: var(--radius-sm); }
.batch-count { font-size: 13px; font-weight: 500; color: var(--fluent-blue); margin-right: var(--space-sm); }
.delete-btn:hover { color: #d13438; background: #fde7e9; }

/* 图片网格带多选 */
.gallery-with-select { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-md); }
.gallery-item-wrapper { position: relative; }
.gallery-item-wrapper.selected { outline: 2px solid var(--fluent-blue); border-radius: var(--radius-md); }
.select-checkbox { position: absolute; top: 8px; right: 8px; z-index: 10; cursor: pointer; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }
.check-icon { width: 18px; height: 18px; }

/* 弹窗 */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); }
.modal { width: 420px; padding: var(--space-xl); border-radius: var(--radius-lg); box-shadow: var(--shadow-3); }
.modal h3 { font-size: 18px; font-weight: 600; margin-bottom: var(--space-sm); }
.modal-desc { font-size: 14px; color: var(--fluent-text-secondary); margin-bottom: var(--space-lg); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-select { width: 100%; padding: 10px 14px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; background: white; }
.fluent-input { width: 100%; padding: 10px 14px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.fluent-input:focus { outline: none; border-color: var(--fluent-blue); }
.modal-actions { display: flex; gap: var(--space-md); justify-content: flex-end; }

@media (max-width: 768px) { .gallery-body { flex-direction: column; } .gallery-sidebar { width: 100%; } .sidebar-card { position: static; } .gallery-with-select { grid-template-columns: repeat(2, 1fr); } }
</style>
