<template>
  <div class="albums-workspace" :class="{ 'has-manage': managingAlbum }">
    <main class="albums-page">
      <section class="albums-heading">
      <div class="heading-copy">
        <h1>相册</h1>
        <p>管理和浏览您的图片相册</p>
      </div>

      <div class="albums-toolbar">
        <div class="album-tabs" aria-label="相册来源">
          <button
            v-for="tab in sourceTabs"
            :key="tab.key"
            type="button"
            class="album-tab"
            :class="{ active: source === tab.key }"
            @click="switchSource(tab.key)"
          >
            <img :src="tab.icon" class="tab-icon" alt="" />
            <span>{{ tab.label }}</span>
            <b>{{ tab.count }}</b>
          </button>
        </div>

        <div class="toolbar-right">
          <div class="album-search">
            <img src="/icons/albums/search-64x64.png" alt="" />
            <input v-model="search" type="search" placeholder="搜索相册名称、描述" @input="handleSearchInput" />
          </div>

          <div class="view-switch">
            <button
              type="button"
              class="view-btn"
              :class="{ active: viewMode === 'grid' }"
              title="网格"
              @click="viewMode = 'grid'"
            >
              <img src="/icons/albums/grid-view-64x64.png" alt="" />
            </button>
            <button
              type="button"
              class="view-btn"
              :class="{ active: viewMode === 'list' }"
              title="列表"
              @click="viewMode = 'list'"
            >
              <img src="/icons/albums/list-view-64x64.png" alt="" />
            </button>
          </div>

          <button v-if="isLoggedIn" type="button" class="create-btn" @click="openCreate">
            <img src="/icons/albums/create-plus-64x64.png" alt="" />
            <span>创建相册</span>
          </button>
        </div>
      </div>
    </section>

    <section v-if="loading" class="album-state">
      <img src="/icons/status/loading-64x64.png" alt="" />
      <span>加载中...</span>
    </section>

    <section v-else-if="albums.length === 0" class="album-state empty">
      <img src="/icons/empty/no-albums-256x256.png" alt="" />
      <span>暂无相册</span>
    </section>

    <section v-else class="album-wall" :class="`mode-${viewMode}`">
      <article v-for="album in albums" :key="album.id" class="album-card">
        <div class="album-cover" @click="navigateTo(`/albums/${album.id}`)">
          <img v-if="getCoverUrl(album)" :src="getCoverUrl(album)" :alt="album.name" loading="lazy" />
          <div v-else class="no-cover">
            <img src="/icons/albums/album-empty-256x256.png" alt="" />
            <span>无封面</span>
          </div>
        </div>

        <div class="album-meta">
          <div class="meta-line title-line">
            <h2 @click="navigateTo(`/albums/${album.id}`)">{{ album.name }}</h2>
            <span class="visibility-pill" :class="{ public: album.is_public }">{{ album.is_public ? '公开' : '私有' }}</span>
          </div>

          <p class="image-count">{{ album.image_count || 0 }} 张图片</p>

          <div class="meta-line owner-line">
            <span class="album-owner">
              <img v-if="ownerAvatar(album)" :src="ownerAvatar(album)" alt="" />
              <i v-else>{{ ownerInitial(album) }}</i>
              <span>{{ album.owner_name || '系统' }}</span>
            </span>

            <span class="card-actions">
              <button type="button" class="enter-btn" @click="navigateTo(`/albums/${album.id}`)">进入相册</button>
              <button v-if="isOwner(album)" type="button" class="manage-btn" title="管理相册" @click="openManage(album)">
                <img src="/icons/albums/manage-64x64.png" alt="" />
              </button>
            </span>
          </div>
        </div>
      </article>
    </section>

    <footer v-if="total > 0" class="album-pagination">
      <span>共 {{ total }} 个相册</span>
      <div class="page-controls">
        <button type="button" class="page-arrow" :disabled="page <= 1" @click="loadPage(page - 1)">
          <img src="/icons/albums/pagination-prev-64x64.png" alt="" />
        </button>
        <button
          v-for="item in paginationItems"
          :key="item.key"
          type="button"
          class="page-number"
          :class="{ active: item.value === page, ellipsis: item.ellipsis }"
          :disabled="item.ellipsis"
          @click="!item.ellipsis && loadPage(item.value)"
        >
          {{ item.label }}
        </button>
        <button type="button" class="page-arrow" :disabled="page >= totalPages" @click="loadPage(page + 1)">
          <img src="/icons/albums/pagination-next-64x64.png" alt="" />
        </button>
      </div>
      <span class="pagination-spacer"></span>
    </footer>

    <div v-if="showCreate" class="album-modal-layer" @click.self="closeCreate">
      <section class="create-modal">
        <button type="button" class="modal-close" @click="closeCreate">
          <img src="/icons/actions/close-64x64.png" alt="" />
        </button>
        <h3>创建相册</h3>

        <label class="field-block">
          <span>相册名称</span>
          <div class="input-wrap">
            <input v-model="createForm.name" maxlength="50" placeholder="请输入相册名称" />
            <b>{{ createForm.name.length }}/50</b>
          </div>
        </label>

        <label class="field-block">
          <span>相册描述（可选）</span>
          <div class="textarea-wrap">
            <textarea v-model="createForm.description" maxlength="200" placeholder="请输入相册描述"></textarea>
            <b>{{ createForm.description.length }}/200</b>
          </div>
        </label>

        <label class="field-block">
          <span>公开设置</span>
          <TaotuSelect v-model="createForm.visibility" :options="visibilityOptions" />
        </label>

        <div class="create-actions">
          <button type="button" class="ghost-action" @click="closeCreate">取消</button>
          <button type="button" class="pink-action" :disabled="!createForm.name.trim()" @click="createAlbum">创建</button>
        </div>
      </section>
      </div>
    </main>

    <aside v-if="managingAlbum" class="manage-panel">
      <button type="button" class="panel-close" @click="closeManage">
        <img src="/icons/actions/close-64x64.png" alt="" />
      </button>

      <h3>管理相册</h3>

      <div class="manage-summary">
        <div class="summary-cover">
          <img v-if="getCoverUrl(managingAlbum)" :src="getCoverUrl(managingAlbum)" :alt="managingAlbum.name" />
          <img v-else src="/icons/albums/album-empty-256x256.png" alt="" />
        </div>
        <div class="summary-main">
          <strong>{{ managingAlbum.name }}</strong>
          <span>{{ managingAlbum.image_count || manageImages.length || 0 }} 张图片 · {{ managingAlbum.is_public ? '公开' : '私有' }}</span>
          <span>创建者：{{ managingAlbum.owner_name || '系统' }}</span>
        </div>
        <button type="button" class="summary-edit" @click="activeManageTab = 'settings'">编辑信息</button>
      </div>

      <div class="manage-quick">
        <button type="button" @click="activeManageTab = 'settings'">
          <img src="/icons/albums/edit-info-64x64.png" alt="" />
          编辑名称
        </button>
        <button type="button" class="danger" @click="deleteAlbum">
          <img src="/icons/actions/trash-64x64.png" alt="" />
          删除相册
        </button>
      </div>

      <div class="manage-tabs">
        <button type="button" :class="{ active: activeManageTab === 'images' }" @click="activeManageTab = 'images'">图片管理</button>
        <button type="button" :class="{ active: activeManageTab === 'settings' }" @click="activeManageTab = 'settings'">相册设置</button>
      </div>

      <template v-if="activeManageTab === 'images'">
        <div class="manage-list-head">
          <span>图片列表（共 {{ manageImages.length }} 张）</span>
          <button type="button" @click="toggleSelectAllManage">{{ allManageSelected ? '取消全选' : '批量管理' }}</button>
        </div>

        <div v-if="manageImages.length > 0" class="manage-image-grid">
          <button
            v-for="img in manageImages"
            :key="img.id"
            type="button"
            class="manage-image"
            :class="{ selected: selectedManageIds.includes(img.id), cover: managingAlbum.cover_image_id === img.id }"
            @click="toggleManageImage(img.id)"
          >
            <img :src="getThumbUrl(img)" :alt="img.filename" loading="lazy" />
            <span class="select-mark"></span>
            <button type="button" class="set-cover-btn" @click.stop="setCover(img)">设为封面</button>
          </button>
        </div>
        <div v-else class="manage-empty">相册内暂无图片</div>

        <button type="button" class="remove-selected" :disabled="selectedManageIds.length === 0" @click="removeSelectedFromAlbum">
          <img src="/icons/actions/trash-64x64.png" alt="" />
          从相册移除（已选 {{ selectedManageIds.length }} 张）
        </button>
      </template>

      <template v-else>
        <div class="settings-form">
          <label class="field-block">
            <span>相册名称</span>
            <div class="input-wrap">
              <input v-model="editForm.name" maxlength="50" />
              <b>{{ editForm.name.length }}/50</b>
            </div>
          </label>

          <label class="field-block">
            <span>相册描述</span>
            <div class="textarea-wrap">
              <textarea v-model="editForm.description" maxlength="200"></textarea>
              <b>{{ editForm.description.length }}/200</b>
            </div>
          </label>

          <div class="setting-row">
            <div>
              <strong>公开相册</strong>
              <span>开启后所有人可查看此相册</span>
            </div>
            <button type="button" class="pink-switch" :class="{ active: editForm.isPublic }" @click="editForm.isPublic = !editForm.isPublic">
              <i></i>
            </button>
          </div>

          <div class="setting-row image-public-row">
            <div>
              <strong>公开所有图片</strong>
              <span>公开该相册所有图片</span>
              <small class="setting-warning">
                <img src="/icons/status/warning-64x64.png" alt="" />
                该操作会覆盖相册已有公开属性，操作前请知悉！
              </small>
            </div>
            <button
              type="button"
              class="pink-switch"
              :class="{ active: editForm.imagesPublic }"
              :disabled="imagePublicSaving"
              @click="toggleAlbumImagesPublic"
            >
              <i></i>
            </button>
          </div>

          <button type="button" class="pink-action full" @click="saveAlbumSettings">保存设置</button>
        </div>
      </template>
    </aside>

    <ConfirmDeleteDialog
      :show="deleteDialog.show"
      :title="deleteDialog.title"
      :message="deleteDialog.message"
      :description="deleteDialog.description"
      :effects="deleteDialog.effects"
      :avatar-text="deleteDialog.avatarText"
      :loading="deleteDialog.loading"
      @confirm="confirmDeleteDialog"
      @cancel="closeDeleteDialog"
    />
  </div>
</template>

<script setup>
const api = useApi()
const config = useRuntimeConfig()

const albums = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 9
const loading = ref(true)
const search = ref('')
const source = ref('all')
const viewMode = ref('list')
const counts = reactive({ all: 0, public: 0, mine: 0 })
const isLoggedIn = ref(false)
const isAdmin = ref(false)
const currentUserId = ref(null)
let searchTimer = null

const showCreate = ref(false)
const createForm = reactive({ name: '', description: '', visibility: 'public' })
const visibilityOptions = [
  { label: '公开 所有人可查看此相册', value: 'public' },
  { label: '私有 仅自己可查看此相册', value: 'private' }
]

const managingAlbum = ref(null)
const manageImages = ref([])
const selectedManageIds = ref([])
const activeManageTab = ref('images')
const editForm = reactive({ name: '', description: '', isPublic: false, imagesPublic: false })
const imagePublicSaving = ref(false)
const deleteDialog = reactive({
  show: false,
  type: '',
  payload: null,
  title: '确认删除',
  message: '',
  description: '此操作不可恢复，请谨慎操作。',
  effects: [],
  avatarText: '删',
  loading: false
})

const sourceTabs = computed(() => [
  { key: 'all', label: '全部相册', count: counts.all, icon: '/icons/albums/album-64x64.png' },
  { key: 'public', label: '公共相册', count: counts.public, icon: '/icons/albums/public-64x64.png' },
  { key: 'mine', label: '我的相册', count: counts.mine, icon: '/icons/albums/private-64x64.png' }
])

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const allManageSelected = computed(() => manageImages.value.length > 0 && selectedManageIds.value.length === manageImages.value.length)

const paginationItems = computed(() => {
  const last = totalPages.value
  const current = page.value
  const pages = new Set([1, current - 1, current, current + 1, last].filter(num => num >= 1 && num <= last))
  const sorted = [...pages].sort((a, b) => a - b)
  const result = []
  sorted.forEach((num, index) => {
    if (index > 0 && num - sorted[index - 1] > 1) {
      result.push({ key: `ellipsis-${num}`, label: '...', ellipsis: true })
    }
    result.push({ key: `page-${num}`, label: String(num), value: num })
  })
  return result
})

onMounted(async () => {
  const token = localStorage.getItem('jwt_token')
  isLoggedIn.value = !!token
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      currentUserId.value = payload.id
      isAdmin.value = payload.role === 'admin'
    } catch {}
  }
  await Promise.all([loadCounts(), loadAlbums()])
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

const normalizeAssetUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${config.public.apiBase || ''}${url}`
}

const getAlbumParams = (overrides = {}) => {
  const params = {
    page: overrides.page || page.value,
    limit: pageSize,
    sort: 'created_at',
    order: 'desc'
  }
  if (source.value === 'public') params.public = 'true'
  if (source.value === 'mine') params.mine = 'true'
  if (search.value.trim()) params.search = search.value.trim()
  return params
}

const loadAlbums = async (targetPage = page.value) => {
  loading.value = true
  page.value = targetPage
  try {
    const data = await api.get('/api/internal/albums', getAlbumParams({ page: targetPage }))
    albums.value = data.albums || []
    total.value = Number(data.total || 0)
    if (page.value > totalPages.value) page.value = totalPages.value
  } catch {
    albums.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const loadCounts = async () => {
  const readCount = async (params = {}) => {
    try {
      const data = await api.get('/api/internal/albums', { page: 1, limit: 1, ...params })
      return Number(data.total || 0)
    } catch {
      return 0
    }
  }
  counts.all = await readCount()
  counts.public = await readCount({ public: 'true' })
  counts.mine = isLoggedIn.value ? await readCount({ mine: 'true' }) : 0
}

const switchSource = async (nextSource) => {
  if (nextSource === 'mine' && !isLoggedIn.value) return
  source.value = nextSource
  await loadAlbums(1)
}

const handleSearchInput = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadAlbums(1), 260)
}

const loadPage = (targetPage) => {
  if (targetPage < 1 || targetPage > totalPages.value || targetPage === page.value) return
  loadAlbums(targetPage)
}

const getCoverUrl = (album) => {
  const cover = album.cover_image
  return normalizeAssetUrl(cover?.medium_url || cover?.thumb_url || cover?.url)
}

const getThumbUrl = (img) => normalizeAssetUrl(img.thumb_url || img.medium_url || img.url)
const ownerAvatar = (album) => normalizeAssetUrl(album.owner_avatar)
const ownerInitial = (album) => (album.owner_name || '系').slice(0, 1).toUpperCase()

const isOwner = (album) => {
  if (!currentUserId.value) return false
  return isAdmin.value || album.user_id === currentUserId.value || !album.user_id
}

const openCreate = () => {
  createForm.name = ''
  createForm.description = ''
  createForm.visibility = 'public'
  showCreate.value = true
}

const closeCreate = () => {
  showCreate.value = false
}

const createAlbum = async () => {
  if (!createForm.name.trim()) return
  try {
    await api.post('/api/admin/albums', {
      name: createForm.name.trim(),
      description: createForm.description.trim(),
      is_public: createForm.visibility === 'public'
    })
    closeCreate()
    await Promise.all([loadCounts(), loadAlbums(1)])
  } catch (err) {
    alert('创建失败: ' + (err.data?.error || err.message))
  }
}

const openManage = async (album) => {
  managingAlbum.value = { ...album }
  activeManageTab.value = 'images'
  selectedManageIds.value = []
  editForm.name = album.name || ''
  editForm.description = album.description || ''
  editForm.isPublic = !!album.is_public
  editForm.imagesPublic = !!album.all_picture_public
  await loadManageImages(album.id)
}

const closeManage = () => {
  managingAlbum.value = null
  manageImages.value = []
  selectedManageIds.value = []
}

const loadManageImages = async (albumId) => {
  try {
    const data = await api.get(`/api/internal/albums/${albumId}`)
    manageImages.value = data.images || []
    managingAlbum.value = {
      ...managingAlbum.value,
      ...data,
      images: undefined
    }
    editForm.name = managingAlbum.value.name || ''
    editForm.description = managingAlbum.value.description || ''
    editForm.isPublic = !!managingAlbum.value.is_public
    editForm.imagesPublic = !!managingAlbum.value.all_picture_public
  } catch {
    manageImages.value = []
  }
}

const toggleManageImage = (id) => {
  selectedManageIds.value = selectedManageIds.value.includes(id)
    ? selectedManageIds.value.filter(item => item !== id)
    : [...selectedManageIds.value, id]
}

const toggleSelectAllManage = () => {
  selectedManageIds.value = allManageSelected.value ? [] : manageImages.value.map(img => img.id)
}

const setCover = async (img) => {
  try {
    const updated = await api.put(`/api/admin/albums/${managingAlbum.value.id}`, { cover_image_id: img.id })
    managingAlbum.value = { ...managingAlbum.value, ...updated }
    await Promise.all([loadAlbums(page.value), loadManageImages(managingAlbum.value.id)])
  } catch (err) {
    alert('设置封面失败: ' + (err.data?.error || err.message))
  }
}

const removeSelectedFromAlbum = async () => {
  if (selectedManageIds.value.length === 0) return
  openDeleteDialog({
    type: 'remove-images',
    payload: [...selectedManageIds.value],
    title: '确认移除图片',
    message: `从相册移除已选 ${selectedManageIds.value.length} 张图片？`,
    description: '图片只会离开当前相册，不会删除图片文件。',
    effects: ['相册图片数量会更新', '图片本身和标签数据会保留'],
    avatarText: String(selectedManageIds.value.length)
  })
}

const removeSelectedFromAlbumNow = async (ids) => {
  try {
    await Promise.all(ids.map(id => api.put(`/api/admin/images/${id}`, { album_id: null })))
    selectedManageIds.value = []
    await Promise.all([loadAlbums(page.value), loadManageImages(managingAlbum.value.id), loadCounts()])
  } catch (err) {
    alert('移除失败: ' + (err.data?.error || err.message))
  }
}

const saveAlbumSettings = async () => {
  if (!editForm.name.trim()) return alert('请输入相册名称')
  try {
    const updated = await api.put(`/api/admin/albums/${managingAlbum.value.id}`, {
      name: editForm.name.trim(),
      description: editForm.description.trim(),
      is_public: editForm.isPublic
    })
    managingAlbum.value = { ...managingAlbum.value, ...updated }
    await Promise.all([loadAlbums(page.value), loadCounts()])
  } catch (err) {
    alert('保存失败: ' + (err.data?.error || err.message))
  }
}

const toggleAlbumImagesPublic = async () => {
  if (!managingAlbum.value || imagePublicSaving.value) return
  const nextValue = !editForm.imagesPublic
  imagePublicSaving.value = true
  try {
    const result = await api.put(`/api/admin/albums/${managingAlbum.value.id}/images-public`, { is_public: nextValue })
    editForm.imagesPublic = nextValue
    managingAlbum.value = { ...managingAlbum.value, all_picture_public: nextValue }
    manageImages.value = manageImages.value.map(img => ({ ...img, is_public: nextValue }))
    alert(`已${nextValue ? '公开' : '取消公开'}相册内 ${result.updated || 0} 张图片`)
    await loadManageImages(managingAlbum.value.id)
  } catch (err) {
    alert('批量设置失败: ' + (err.data?.error || err.message))
  } finally {
    imagePublicSaving.value = false
  }
}

const deleteAlbum = async () => {
  openDeleteDialog({
    type: 'album',
    payload: managingAlbum.value,
    title: '确认删除相册',
    message: `删除相册 "${managingAlbum.value.name}"？`,
    description: '相册内图片不会被删除。',
    effects: ['相册记录会被删除', '图片会保留并脱离该相册'],
    avatarText: '册'
  })
}

const deleteAlbumNow = async (album) => {
  try {
    await api.del(`/api/admin/albums/${album.id}`)
    closeManage()
    await Promise.all([loadAlbums(1), loadCounts()])
  } catch (err) {
    alert('删除失败: ' + (err.data?.error || err.message))
  }
}

const openDeleteDialog = (options) => {
  deleteDialog.show = true
  deleteDialog.type = options.type
  deleteDialog.payload = options.payload
  deleteDialog.title = options.title
  deleteDialog.message = options.message
  deleteDialog.description = options.description || '此操作不可恢复，请谨慎操作。'
  deleteDialog.effects = options.effects || []
  deleteDialog.avatarText = options.avatarText || '删'
}

const closeDeleteDialog = () => {
  if (deleteDialog.loading) return
  deleteDialog.show = false
  deleteDialog.type = ''
  deleteDialog.payload = null
  deleteDialog.effects = []
}

const confirmDeleteDialog = async () => {
  if (deleteDialog.loading) return
  deleteDialog.loading = true
  try {
    if (deleteDialog.type === 'remove-images') await removeSelectedFromAlbumNow(deleteDialog.payload || [])
    else if (deleteDialog.type === 'album') await deleteAlbumNow(deleteDialog.payload)
    deleteDialog.loading = false
    closeDeleteDialog()
  } finally {
    deleteDialog.loading = false
  }
}
</script>

<style scoped>
.albums-workspace {
  width: min(100%, 1490px);
  min-height: calc(100vh - 190px);
  display: flex;
  align-items: stretch;
  gap: 18px;
  margin: 0 auto;
}

.albums-page {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 28px 18px 0;
}

.albums-heading {
  margin-bottom: 24px;
}

.heading-copy {
  margin-bottom: 22px;
}

.heading-copy h1 {
  color: #2e374f;
  font-size: 30px;
  font-weight: 900;
  line-height: 1.15;
}

.heading-copy p {
  margin-top: 3px;
  color: #7e879d;
  font-size: 14px;
  font-weight: 700;
}

.albums-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-width: 0;
}

.album-tabs,
.toolbar-right,
.view-switch {
  display: flex;
  align-items: center;
  gap: 10px;
}

.album-tabs,
.toolbar-right {
  min-width: 0;
}

.album-tabs {
  flex: 0 0 auto;
}

.toolbar-right {
  flex: 1 1 auto;
  justify-content: flex-end;
}

.album-tab {
  height: 40px;
  min-width: 116px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid rgba(230, 219, 236, 0.86);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.68);
  color: #596278;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
  box-shadow: 0 8px 24px rgba(86, 76, 110, 0.04);
}

.album-tab.active {
  border-color: rgba(255, 191, 213, 0.78);
  background: rgba(255, 236, 246, 0.86);
  color: #f15c96;
}

.tab-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.album-tab b {
  color: inherit;
  font-size: 13px;
}

.album-search {
  flex: 1 1 288px;
  width: auto;
  min-width: 148px;
  max-width: 288px;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid rgba(230, 219, 236, 0.86);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.85), 0 8px 24px rgba(86, 76, 110, 0.04);
}

.album-search img {
  width: 16px;
  height: 16px;
  object-fit: contain;
  opacity: 0.7;
}

.album-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #384157;
  font-size: 14px;
  font-weight: 700;
}

.album-search input::placeholder {
  color: #b4bbcb;
}

.view-switch {
  gap: 8px;
}

.view-btn {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(230, 219, 236, 0.86);
  border-radius: 8px;
  background: rgba(255,255,255,0.74);
  cursor: pointer;
}

.view-btn.active {
  background: rgba(255,255,255,0.46);
  backdrop-filter: blur(16px);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.72);
}

.view-btn img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.create-btn {
  height: 40px;
  min-width: 124px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, #f85f9a, #f27aae);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
  box-shadow: 0 12px 26px rgba(248, 95, 154, 0.24);
}

.create-btn img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.album-wall {
  display: grid;
  gap: 18px;
}

.album-wall.mode-list {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.albums-workspace.has-manage .album-wall.mode-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.album-wall.mode-grid {
  grid-template-columns: repeat(auto-fill, minmax(235px, 1fr));
}

.album-card {
  overflow: hidden;
  border: 1px solid rgba(236, 223, 234, 0.8);
  border-radius: 8px;
  background: rgba(255,255,255,0.72);
  box-shadow: 0 12px 30px rgba(78, 72, 105, 0.07);
}

.album-cover {
  height: 152px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(245, 248, 255, 0.86);
}

.mode-grid .album-cover {
  height: auto;
  aspect-ratio: 1.18 / 1;
}

.album-cover > img,
.no-cover {
  width: 100%;
  height: 100%;
}

.album-cover > img {
  display: block;
  object-fit: cover;
  transition: transform 180ms ease;
}

.album-card:hover .album-cover > img {
  transform: scale(1.025);
}

.no-cover {
  display: grid;
  place-items: center;
  gap: 8px;
  color: #c3c8d5;
  font-size: 13px;
  border: 1px dashed rgba(201, 207, 223, 0.78);
}

.no-cover img {
  width: 54px;
  height: 54px;
  object-fit: contain;
  opacity: 0.62;
}

.album-meta {
  min-height: 118px;
  padding: 12px 16px 13px;
}

.meta-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.title-line h2 {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #2f3850;
  cursor: pointer;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.3;
}

.visibility-pill {
  flex: 0 0 auto;
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(239, 226, 255, 0.84);
  color: #ad65ff;
  font-size: 12px;
  font-weight: 900;
}

.visibility-pill.public {
  background: rgba(217, 251, 239, 0.92);
  color: #2dc69a;
}

.image-count {
  margin-top: 6px;
  color: #8b93a7;
  font-size: 13px;
  font-weight: 800;
}

.owner-line {
  margin-top: 11px;
}

.album-owner {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #788198;
  font-size: 13px;
  font-weight: 900;
}

.album-owner img,
.album-owner i {
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  border-radius: 50%;
}

.album-owner img {
  object-fit: cover;
}

.album-owner i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ffdce9;
  color: #f15c96;
  font-size: 11px;
  font-style: normal;
}

.card-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.enter-btn,
.manage-btn {
  height: 32px;
  border: 1px solid rgba(230, 219, 236, 0.86);
  border-radius: 8px;
  background: rgba(255,255,255,0.74);
  color: #4f586f;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
}

.enter-btn {
  min-width: 92px;
  padding: 0 16px;
}

.manage-btn {
  width: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.manage-btn img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.album-state {
  min-height: 360px;
  display: grid;
  place-items: center;
  gap: 12px;
  color: #8b93a7;
  font-weight: 900;
}

.album-state img {
  width: 96px;
  height: 96px;
  object-fit: contain;
}

.album-pagination {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 18px;
  margin-top: auto;
  padding-top: 24px;
  padding-bottom: 2px;
  color: #8a92a7;
  font-size: 14px;
  font-weight: 800;
}

.page-controls {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.page-arrow,
.page-number {
  min-width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #697187;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

.page-arrow {
  width: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.page-arrow img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.page-number.active {
  background: #ffe6f0;
  color: #f15c96;
}

.page-number.ellipsis,
.page-arrow:disabled {
  cursor: default;
  opacity: 0.42;
}

.album-modal-layer {
  position: fixed;
  inset: 0;
  z-index: 1600;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.create-modal {
  position: relative;
  width: 382px;
  padding: 28px 32px 26px;
  border: 1px solid rgba(234, 224, 236, 0.92);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 24px 72px rgba(84, 76, 104, 0.18);
  backdrop-filter: blur(24px);
}

.modal-close,
.panel-close {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.modal-close {
  position: absolute;
  top: 24px;
  right: 24px;
}

.modal-close img,
.panel-close img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.create-modal h3,
.manage-panel h3 {
  color: #2f3850;
  font-size: 20px;
  font-weight: 900;
}

.field-block {
  display: block;
  margin-top: 20px;
}

.field-block > span {
  display: block;
  margin-bottom: 8px;
  color: #626b82;
  font-size: 13px;
  font-weight: 900;
}

.input-wrap,
.textarea-wrap {
  position: relative;
  border: 1px solid rgba(226, 218, 234, 0.9);
  border-radius: 8px;
  background: rgba(255,255,255,0.72);
}

.input-wrap input,
.textarea-wrap textarea {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #364056;
  font-size: 14px;
  font-weight: 800;
}

.input-wrap input {
  height: 38px;
  padding: 0 54px 0 14px;
}

.textarea-wrap textarea {
  min-height: 78px;
  resize: none;
  padding: 12px 54px 24px 14px;
}

.input-wrap b,
.textarea-wrap b {
  position: absolute;
  right: 12px;
  bottom: 8px;
  color: #aab1c2;
  font-size: 12px;
}

.create-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 22px;
}

.ghost-action,
.pink-action {
  height: 42px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

.ghost-action {
  border: 1px solid rgba(226, 218, 234, 0.9);
  background: rgba(255,255,255,0.72);
  color: #4f586f;
}

.pink-action {
  border: 0;
  background: linear-gradient(135deg, #f85f9a, #f27aae);
  color: #fff;
}

.pink-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.pink-action.full {
  width: 100%;
  margin-top: 18px;
}

.manage-panel {
  position: sticky;
  top: 18px;
  z-index: 5;
  flex: 0 0 430px;
  width: 430px;
  max-height: calc(100vh - 180px);
  align-self: flex-start;
  padding: 26px 28px;
  overflow-y: auto;
  border: 1px solid rgba(234, 224, 236, 0.92);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 24px 72px rgba(84, 76, 104, 0.16);
  backdrop-filter: blur(24px);
}

.panel-close {
  position: absolute;
  top: 24px;
  right: 24px;
}

.manage-summary {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  margin-top: 26px;
}

.summary-cover {
  width: 78px;
  height: 78px;
  overflow: hidden;
  border-radius: 8px;
  background: #f4f7ff;
}

.summary-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.summary-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-main strong {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #2f3850;
  font-size: 17px;
}

.summary-main span {
  color: #8b93a7;
  font-size: 13px;
  font-weight: 800;
}

.summary-edit {
  height: 36px;
  padding: 0 15px;
  border: 1px solid rgba(226, 218, 234, 0.9);
  border-radius: 8px;
  background: rgba(255,255,255,0.7);
  color: #4f586f;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
}

.manage-quick {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 22px;
}

.manage-quick button {
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(226, 218, 234, 0.9);
  border-radius: 8px;
  background: rgba(255,255,255,0.72);
  color: #4f586f;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
}

.manage-quick button img {
  width: 16px;
  height: 16px;
}

.manage-quick .danger {
  color: #f15c96;
}

.manage-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 22px -28px 0;
  border-bottom: 1px solid rgba(226, 218, 234, 0.8);
}

.manage-tabs button {
  height: 46px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #8b93a7;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

.manage-tabs button.active {
  border-bottom-color: #f15c96;
  color: #f15c96;
}

.manage-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  color: #8b93a7;
  font-size: 13px;
  font-weight: 900;
}

.manage-list-head button {
  height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(226, 218, 234, 0.9);
  border-radius: 8px;
  background: rgba(255,255,255,0.72);
  color: #8b93a7;
  cursor: pointer;
  font-weight: 900;
}

.manage-image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
  margin-top: 12px;
}

.manage-image {
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: 8px;
  background: #f5f7ff;
  cursor: pointer;
}

.manage-image.selected {
  border-color: #f15c96;
}

.manage-image img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.select-mark {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255,255,255,0.86);
  border-radius: 6px;
  background: rgba(255,255,255,0.26);
}

.manage-image.selected .select-mark {
  background: #f15c96;
}

.manage-image.selected .select-mark::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.set-cover-btn {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 10px;
  height: 28px;
  border: 0;
  border-radius: 7px;
  background: rgba(255,255,255,0.9);
  color: #f15c96;
  cursor: pointer;
  opacity: 0;
  font-size: 12px;
  font-weight: 900;
}

.manage-image:hover .set-cover-btn,
.manage-image.cover .set-cover-btn {
  opacity: 1;
}

.manage-image.cover .set-cover-btn {
  background: #f15c96;
  color: #fff;
}

.remove-selected {
  width: 100%;
  height: 54px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 18px;
  border: 1px solid rgba(226, 218, 234, 0.9);
  border-radius: 10px;
  background: rgba(255,255,255,0.72);
  color: #f15c96;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

.remove-selected:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.remove-selected img {
  width: 17px;
  height: 17px;
}

.manage-empty {
  padding: 36px 0;
  color: #a2a9bb;
  text-align: center;
  font-weight: 900;
}

.settings-form {
  padding-top: 2px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 22px;
  padding: 14px;
  border: 1px solid rgba(226, 218, 234, 0.9);
  border-radius: 10px;
  background: rgba(255,255,255,0.6);
}

.setting-row div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-row strong {
  color: #2f3850;
  font-size: 14px;
}

.setting-row span {
  color: #8b93a7;
  font-size: 12px;
  font-weight: 800;
}

.image-public-row {
  align-items: flex-start;
}

.setting-warning {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 7px 9px;
  border: 1px solid rgba(248, 95, 154, 0.2);
  border-radius: 8px;
  background: rgba(255, 239, 246, 0.72);
  color: #f15c96;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.4;
}

.setting-warning img {
  width: 15px;
  height: 15px;
  object-fit: contain;
}

.pink-switch {
  flex: 0 0 auto;
  width: 48px;
  min-width: 48px;
  height: 26px;
  min-height: 26px;
  padding: 3px;
  border: 0;
  border-radius: 999px;
  background: #d8dce8;
  box-sizing: border-box;
  cursor: pointer;
  transition: background 180ms ease;
}

.pink-switch i {
  width: 20px;
  height: 20px;
  display: block;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 4px 12px rgba(66, 59, 86, 0.16);
  transition: transform 180ms ease;
}

.pink-switch.active {
  background: var(--taotu-button-active-bg, #f15c96);
}

.pink-switch.active i {
  transform: translateX(22px);
}

@media (max-width: 1120px) {
  .albums-workspace {
    flex-direction: column;
  }

  .toolbar-right {
    flex-wrap: nowrap;
  }

  .album-search {
    min-width: 112px;
  }

  .album-wall.mode-list,
  .albums-workspace.has-manage .album-wall.mode-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .manage-panel {
    position: relative;
    top: auto;
    width: 100%;
    max-height: none;
    flex: 0 0 auto;
  }
}

@media (max-width: 760px) {
  .albums-workspace {
    min-height: calc(100vh - 176px);
  }

  .albums-page {
    padding: 20px 14px 0;
  }

  .albums-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .album-tabs,
  .toolbar-right {
    width: 100%;
    flex-wrap: wrap;
  }

  .album-tab,
  .album-search,
  .create-btn {
    flex: 1 1 100%;
    width: 100%;
  }

  .album-wall.mode-list,
  .album-wall.mode-grid {
    grid-template-columns: 1fr;
  }

  .album-pagination {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .manage-panel {
    width: 100%;
  }
}
</style>
