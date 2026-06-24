<template>
  <div class="admin-images">
    <h1 class="page-title">图片管理</h1>

    <div class="fluent-card">
      <div class="section-header">
        <div class="title-row">
          <h3>图片列表</h3>
          <button class="fluent-btn fluent-btn-secondary multi-toggle" :class="{ active: multiMode }" @click="toggleMultiMode">
            {{ multiMode ? '退出多选' : '多选' }}
          </button>
          <template v-if="multiMode">
            <button class="fluent-btn fluent-btn-secondary" @click="selectAllCurrent">全选当前页</button>
            <button class="fluent-btn fluent-btn-secondary" @click="deselectAll">取消全选</button>
            <span class="selected-count" v-if="selectedIds.length > 0">已选 {{ selectedIds.length }} 张</span>
          </template>
        </div>
        <div class="filters">
          <div class="source-toggle">
            <button class="source-btn" :class="{ active: imgSource === 'all' }" @click="switchSource('all')">全部</button>
            <button class="source-btn" :class="{ active: imgSource === 'public' }" @click="switchSource('public')">公共图库</button>
            <button class="source-btn" :class="{ active: imgSource === 'mine' }" @click="switchSource('mine')">我的图库</button>
            <button class="source-btn" :class="{ active: imgSource === 'user' }" @click="switchSource('user')">用户图库</button>
            <select v-if="imgSource === 'user'" v-model="filterUserId" class="user-select" @change="loadImages()">
              <option :value="null">全部用户</option>
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.username }}</option>
            </select>
          </div>
          <input v-model="search" class="fluent-input search-input" placeholder="搜索文件名..." @keyup.enter="loadImages" />
          <button class="fluent-btn fluent-btn-secondary" @click="loadImages">搜索</button>
        </div>
      </div>

      <!-- 批量操作栏 -->
      <div v-if="multiMode && selectedIds.length > 0" class="batch-bar">
        <button class="fluent-btn fluent-btn-secondary" @click="batchSetPublic(true)">设为公共</button>
        <button class="fluent-btn fluent-btn-secondary" @click="batchSetPublic(false)">取消公共</button>
        <button class="fluent-btn fluent-btn-secondary delete-btn" @click="batchDelete">批量删除</button>
      </div>

      <div class="image-grid">
        <div v-for="img in images" :key="img.id" class="image-item" :class="{ selected: selectedIds.includes(img.id) }">
          <div class="image-checkbox" v-if="multiMode">
            <input type="checkbox" :checked="selectedIds.includes(img.id)" @change="toggleSelect(img.id)" />
          </div>
          <div class="image-thumb">
            <img :src="getThumbUrl(img)" :alt="img.filename" loading="lazy" />
          </div>
          <div class="image-info">
            <p class="image-name">{{ img.filename }}</p>
            <p class="image-meta">{{ img.width }}×{{ img.height }} · {{ formatSize(img.size_bytes) }}</p>
            <div class="image-tags" v-if="img.tags && img.tags.length > 0">
              <span v-for="tag in img.tags.slice(0, 3)" :key="tag.id" class="tag-mini">{{ tag.display_name || tag.name }}</span>
            </div>
          </div>
          <div class="image-actions">
            <label class="public-toggle" title="公共图片">
              <input type="checkbox" :checked="img.is_public" @change="togglePublic(img)" />
              <span>公共</span>
            </label>
            <button class="fluent-btn fluent-btn-secondary" @click="openEdit(img)">编辑</button>
            <button class="fluent-btn fluent-btn-secondary delete-btn" @click="deleteImage(img)">删除</button>
          </div>
        </div>
      </div>

      <div v-if="images.length === 0 && !loading" class="empty-msg">暂无图片</div>

      <div class="pagination" v-if="total > 20">
        <button class="fluent-btn fluent-btn-secondary" :disabled="page <= 1" @click="loadImages(page - 1)">上一页</button>
        <span>第 {{ page }} 页 / 共 {{ Math.ceil(total / 20) }} 页</span>
        <button class="fluent-btn fluent-btn-secondary" :disabled="page >= Math.ceil(total / 20)" @click="loadImages(page + 1)">下一页</button>
      </div>
    </div>

    <!-- 编辑图片弹窗 -->
    <div v-if="editingImage" class="modal-overlay" @click.self="editingImage = null">
      <div class="modal fluent-card">
        <h3>编辑图片</h3>
        <div class="edit-preview">
          <img :src="getThumbUrl(editingImage)" />
          <div>
            <p><strong>{{ editingImage.filename }}</strong></p>
            <p>{{ editingImage.width }}×{{ editingImage.height }}</p>
          </div>
        </div>
        <div class="form-group">
          <label>标签（选择要应用的标签）</label>
          <TagSelector :tags="tags" :selectedTagIds="editTagIds" @update:selectedTagIds="editTagIds = $event" />
        </div>
        <div class="modal-actions">
          <button class="fluent-btn fluent-btn-primary" @click="saveEdit">保存</button>
          <button class="fluent-btn fluent-btn-secondary" @click="editingImage = null">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import TagSelector from '~/components/tags/TagSelector.vue'

definePageMeta({ layout: 'admin' })

const api = useApi()
const config = useRuntimeConfig()
const { tags, fetchTags } = useTags()

const images = ref([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const search = ref('')
const editingImage = ref(null)
const editTagIds = ref([])
const imgSource = ref('all')
const filterUserId = ref(null)
const users = ref([])

// 多选相关
const multiMode = ref(false)
const selectedIds = ref([])

const toggleMultiMode = () => {
  multiMode.value = !multiMode.value
  if (!multiMode.value) selectedIds.value = []
}

const toggleSelect = (id) => {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

const selectAllCurrent = () => {
  selectedIds.value = images.value.map(img => img.id)
}

const deselectAll = () => {
  selectedIds.value = []
}

onMounted(async () => {
  await fetchTags()
  await loadUsers()
  await loadImages()
})

const loadUsers = async () => {
  try {
    const data = await api.get('/api/admin/users')
    users.value = data.users || []
  } catch {}
}

const switchSource = (source) => {
  imgSource.value = source
  if (source !== 'user') filterUserId.value = null
  loadImages()
}

const loadImages = async (p = 1) => {
  loading.value = true
  page.value = p
  selectedIds.value = []
  try {
    const params = { page: p, limit: 20, search: search.value || undefined }
    if (imgSource.value === 'public') params.public = 'true'
    else if (imgSource.value === 'mine') params.mine = 'true'
    else if (imgSource.value === 'user' && filterUserId.value) params.userId = filterUserId.value
    const data = await api.get('/api/images', params)
    images.value = data.images || []
    total.value = data.total || 0
  } catch {} finally { loading.value = false }
}

const getThumbUrl = (img) => {
  const url = img.thumb_url || img.url
  return url ? `${config.public.apiBase || ''}${url}` : ''
}

const formatSize = (bytes) => {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const openEdit = (img) => {
  editingImage.value = img
  editTagIds.value = (img.tags || []).map(t => t.id)
}

const saveEdit = async () => {
  try {
    await api.post('/api/admin/tags/run/manual', {
      imageIds: [editingImage.value.id], tagIds: editTagIds.value, overwrite: true
    })
    editingImage.value = null
    await loadImages(page.value)
  } catch (err) { alert('保存失败: ' + err.message) }
}

const deleteImage = async (img) => {
  if (!confirm(`确定删除图片 "${img.filename}"？`)) return
  try {
    await api.del(`/api/admin/images/${img.id}`)
    await loadImages(page.value)
  } catch (err) { alert('删除失败: ' + err.message) }
}

const togglePublic = async (img) => {
  try {
    await api.put(`/api/admin/images/${img.id}`, { is_public: !img.is_public })
    img.is_public = !img.is_public
  } catch (err) { alert('操作失败') }
}

// 批量操作
const batchDelete = async () => {
  if (!confirm(`确定删除选中的 ${selectedIds.value.length} 张图片？`)) return
  let success = 0, fail = 0
  for (const id of selectedIds.value) {
    try { await api.del(`/api/admin/images/${id}`); success++ } catch { fail++ }
  }
  alert(`删除完成: ${success} 成功, ${fail} 失败`)
  selectedIds.value = []
  await loadImages(page.value)
}

const batchSetPublic = async (isPublic) => {
  let success = 0
  for (const id of selectedIds.value) {
    try { await api.put(`/api/admin/images/${id}`, { is_public: isPublic }); success++ } catch {}
  }
  alert(`已${isPublic ? '设为公共' : '取消公共'}: ${success} 张`)
  selectedIds.value = []
  await loadImages(page.value)
}
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.section-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-lg); flex-wrap: wrap; gap: var(--space-md); }
.title-row { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }
.title-row h3 { margin: 0; }
.multi-toggle.active { background: var(--fluent-blue); color: white; border-color: var(--fluent-blue); }
.selected-count { font-size: 13px; color: var(--fluent-blue); font-weight: 500; }
.filters { display: flex; gap: var(--space-sm); align-items: center; flex-wrap: wrap; }
.search-input { width: 200px; }
.source-toggle { display: flex; gap: 2px; background: var(--fluent-hover); border-radius: var(--radius-sm); padding: 2px; }
.source-btn { padding: 4px 12px; border: none; background: transparent; border-radius: var(--radius-sm); cursor: pointer; font-size: 12px; transition: all var(--transition-fast); color: var(--fluent-text-secondary); }
.source-btn.active { background: white; box-shadow: var(--shadow-1); font-weight: 500; color: var(--fluent-blue); }
.user-select { margin-left: 4px; padding: 3px 6px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 11px; background: white; }
.batch-bar { display: flex; gap: var(--space-sm); padding: var(--space-md); margin-bottom: var(--space-md); background: var(--fluent-blue-light); border-radius: var(--radius-sm); }
.image-grid { display: flex; flex-direction: column; gap: var(--space-sm); }
.image-item { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm); border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); transition: all var(--transition-fast); }
.image-item.selected { background: var(--fluent-blue-light); border-color: var(--fluent-blue); }
.image-checkbox { flex-shrink: 0; }
.image-checkbox input { width: 16px; height: 16px; cursor: pointer; }
.image-thumb { width: 64px; height: 64px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; background: var(--fluent-hover); }
.image-thumb img { width: 100%; height: 100%; object-fit: cover; }
.image-info { flex: 1; min-width: 0; }
.image-name { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.image-meta { font-size: 12px; color: var(--fluent-text-secondary); }
.image-tags { display: flex; gap: 4px; margin-top: 4px; }
.tag-mini { font-size: 11px; padding: 1px 6px; background: var(--fluent-blue-light); color: var(--fluent-blue); border-radius: 8px; }
.image-actions { display: flex; gap: 6px; align-items: center; }
.public-toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; color: var(--fluent-text-secondary); }
.public-toggle input { margin: 0; }
.delete-btn:hover { color: #d13438; background: #fde7e9; }
.empty-msg { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
.pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-md); padding: var(--space-lg) 0; font-size: 13px; color: var(--fluent-text-secondary); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 500px; padding: var(--space-xl); max-height: 80vh; overflow-y: auto; }
.modal h3 { margin-bottom: var(--space-lg); }
.edit-preview { display: flex; gap: var(--space-md); align-items: center; margin-bottom: var(--space-lg); padding-bottom: var(--space-lg); border-bottom: 1px solid var(--fluent-border); }
.edit-preview img { width: 80px; height: 80px; object-fit: cover; border-radius: var(--radius-sm); }
.modal-actions { display: flex; gap: var(--space-md); justify-content: flex-end; margin-top: var(--space-lg); }
</style>
