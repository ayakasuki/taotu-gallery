<template>
  <div class="albums-page page-container">
    <div class="albums-header">
      <h1 class="page-title">相册</h1>
      <button v-if="isLoggedIn" class="fluent-btn fluent-btn-primary" @click="showCreate = true">创建相册</button>
    </div>

    <div class="albums-grid" v-if="albums.length > 0">
      <div v-for="album in albums" :key="album.id" class="album-card fluent-card">
        <div class="album-cover" @click="navigateTo(`/albums/${album.id}`)">
          <img v-if="getCoverUrl(album)" :src="getCoverUrl(album)" :alt="album.name" />
          <div v-else class="no-cover">暂无封面</div>
        </div>
        <div class="album-info">
          <h3 class="album-name" @click="navigateTo(`/albums/${album.id}`)">{{ album.name }}</h3>
          <p class="album-count">{{ album.image_count || 0 }} 张图片</p>
          <div class="album-actions">
            <label class="public-toggle" v-if="isOwner(album)">
              <input type="checkbox" :checked="album.is_public" @change="toggleAlbumPublic(album)" />
              <span>公共</span>
            </label>
            <button v-if="isOwner(album)" class="fluent-btn fluent-btn-secondary" @click="openManage(album)">管理</button>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="loading" class="loading-state">加载中...</div>
    <div v-else class="empty-state">暂无相册</div>

    <!-- 创建相册弹窗 -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal fluent-card">
        <h3>创建相册</h3>
        <div class="form-group"><label>相册名称</label><input v-model="createForm.name" class="fluent-input" /></div>
        <div class="form-group"><label>描述</label><input v-model="createForm.description" class="fluent-input" /></div>
        <div class="form-group"><label><input type="checkbox" v-model="createForm.isPublic" /> 设为公共相册</label></div>
        <div class="modal-actions">
          <button class="fluent-btn fluent-btn-primary" @click="createAlbum">创建</button>
          <button class="fluent-btn fluent-btn-secondary" @click="showCreate = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 相册管理弹窗 -->
    <div v-if="managingAlbum" class="modal-overlay" @click.self="managingAlbum = null">
      <div class="modal modal-lg fluent-card">
        <div class="manage-header">
          <h3>管理相册: {{ managingAlbum.name }}</h3>
          <div class="manage-actions">
            <button class="fluent-btn fluent-btn-secondary" @click="editAlbumName">编辑名称</button>
            <button class="fluent-btn fluent-btn-secondary delete-btn" @click="deleteAlbum">删除相册</button>
          </div>
        </div>

        <div class="manage-images" v-if="manageImages.length > 0">
          <div v-for="img in manageImages" :key="img.id" class="manage-image-item">
            <div class="manage-img-thumb">
              <img :src="getThumbUrl(img)" loading="lazy" />
            </div>
            <div class="manage-img-info">
              <p class="manage-img-name">{{ img.filename }}</p>
              <p class="manage-img-meta">{{ img.width }}×{{ img.height }}</p>
            </div>
            <button class="fluent-btn fluent-btn-secondary delete-btn" @click="removeFromAlbum(img)">移出相册</button>
          </div>
        </div>
        <div v-else class="empty-msg">相册内暂无图片</div>
      </div>
    </div>
  </div>
</template>

<script setup>
const api = useApi()
const config = useRuntimeConfig()

const albums = ref([])
const loading = ref(true)
const isLoggedIn = ref(false)
const currentUserId = ref(null)

const showCreate = ref(false)
const createForm = reactive({ name: '', description: '', isPublic: false })

const managingAlbum = ref(null)
const manageImages = ref([])

onMounted(async () => {
  const token = localStorage.getItem('jwt_token')
  isLoggedIn.value = !!token
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      currentUserId.value = payload.id
    } catch {}
  }
  await loadAlbums()
})

const loadAlbums = async () => {
  loading.value = true
  try {
    const data = await api.get('/api/albums')
    albums.value = data.albums || []
  } catch {} finally { loading.value = false }
}

const getCoverUrl = (album) => {
  if (album.cover_image?.thumb_url) return `${config.public.apiBase || ''}${album.cover_image.thumb_url}`
  return null
}

const getThumbUrl = (img) => {
  const url = img.thumb_url || img.url
  return url ? `${config.public.apiBase || ''}${url}` : ''
}

const isOwner = (album) => {
  return currentUserId.value && (album.user_id === currentUserId.value || !album.user_id)
}

const createAlbum = async () => {
  if (!createForm.name) return alert('请输入相册名称')
  try {
    await api.post('/api/admin/albums', {
      name: createForm.name,
      description: createForm.description,
      is_public: createForm.isPublic
    })
    showCreate.value = false
    createForm.name = ''; createForm.description = ''; createForm.isPublic = false
    await loadAlbums()
  } catch (err) { alert('创建失败: ' + err.message) }
}

const toggleAlbumPublic = async (album) => {
  try {
    await api.put(`/api/admin/albums/${album.id}`, { is_public: !album.is_public })
    album.is_public = !album.is_public
  } catch (err) { alert('操作失败') }
}

const openManage = async (album) => {
  managingAlbum.value = album
  try {
    const data = await api.get(`/api/albums/${album.id}`)
    manageImages.value = data.images || []
  } catch { manageImages.value = [] }
}

const editAlbumName = async () => {
  const newName = prompt('输入新相册名称', managingAlbum.value.name)
  if (!newName || newName === managingAlbum.value.name) return
  try {
    await api.put(`/api/admin/albums/${managingAlbum.value.id}`, { name: newName })
    managingAlbum.value.name = newName
    await loadAlbums()
  } catch (err) { alert('修改失败') }
}

const deleteAlbum = async () => {
  if (!confirm(`确定删除相册 "${managingAlbum.value.name}"？相册内的图片不会被删除。`)) return
  try {
    await api.del(`/api/admin/albums/${managingAlbum.value.id}`)
    managingAlbum.value = null
    await loadAlbums()
  } catch (err) { alert('删除失败') }
}

const removeFromAlbum = async (img) => {
  if (!confirm(`将图片 "${img.filename}" 移出相册？`)) return
  try {
    await api.put(`/api/admin/images/${img.id}`, { album_id: null })
    manageImages.value = manageImages.value.filter(i => i.id !== img.id)
    await loadAlbums()
  } catch (err) { alert('操作失败') }
}
</script>

<style scoped>
.albums-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-xl); }
.page-title { font-size: 24px; font-weight: 600; }
.albums-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-lg); }
.album-card { padding: 0; overflow: hidden; cursor: default; }
.album-cover { aspect-ratio: 16/10; background: var(--fluent-hover); overflow: hidden; cursor: pointer; }
.album-cover img { width: 100%; height: 100%; object-fit: cover; }
.no-cover { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--fluent-text-secondary); font-size: 14px; }
.album-info { padding: var(--space-md); }
.album-name { font-size: 16px; font-weight: 600; cursor: pointer; }
.album-name:hover { color: var(--fluent-blue); }
.album-count { font-size: 13px; color: var(--fluent-text-secondary); margin: 4px 0 var(--space-sm); }
.album-actions { display: flex; align-items: center; gap: var(--space-sm); }
.public-toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; color: var(--fluent-text-secondary); }
.public-toggle input { margin: 0; }
.loading-state, .empty-state { text-align: center; padding: var(--space-2xl); color: var(--fluent-text-secondary); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 450px; padding: var(--space-xl); }
.modal-lg { width: 600px; max-height: 80vh; overflow-y: auto; }
.modal h3 { margin-bottom: var(--space-lg); }
.modal-actions { display: flex; gap: var(--space-md); justify-content: flex-end; margin-top: var(--space-lg); }
.manage-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); padding-bottom: var(--space-md); border-bottom: 1px solid var(--fluent-border); }
.manage-actions { display: flex; gap: var(--space-sm); }
.manage-images { display: flex; flex-direction: column; gap: var(--space-sm); }
.manage-image-item { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm); border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); }
.manage-img-thumb { width: 48px; height: 48px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; background: var(--fluent-hover); }
.manage-img-thumb img { width: 100%; height: 100%; object-fit: cover; }
.manage-img-info { flex: 1; min-width: 0; }
.manage-img-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.manage-img-meta { font-size: 12px; color: var(--fluent-text-secondary); }
.delete-btn { color: #d13438; }
.delete-btn:hover { background: #fde7e9; }
.empty-msg { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
</style>
