<template>
  <div class="admin-image-page">
    <section class="image-panel">
      <header class="image-title-row">
        <div class="image-title">
          <img src="/icons/admin/image-management-64x64.png" alt="" />
          <h1>图片管理</h1>
        </div>
      </header>

      <section class="image-filter-row" :class="{ 'has-user-filter': imgSource === 'user' }">
        <div class="scope-tabs">
          <button type="button" :class="{ active: imgSource === 'all' }" @click="switchSource('all')">全部</button>
          <button type="button" :class="{ active: imgSource === 'public' }" @click="switchSource('public')">公共图库</button>
          <button type="button" :class="{ active: imgSource === 'mine' }" @click="switchSource('mine')">我的图库</button>
          <button type="button" :class="{ active: imgSource === 'user' }" @click="switchSource('user')">用户图库</button>
        </div>

        <select v-if="imgSource === 'user'" v-model="filterUserId" class="soft-select user-filter" @change="onUserFilterChange">
          <option :value="null">全部用户</option>
          <option v-for="userItem in users" :key="userItem.id" :value="userItem.id">{{ userItem.username }}</option>
        </select>

        <select v-model="filterAlbumId" class="soft-select album-filter" @change="loadImages(1)">
          <option :value="null">全部相册</option>
          <option v-for="album in albums" :key="album.id" :value="album.id">{{ album.name }}</option>
        </select>

        <input v-model="search" class="name-filter" placeholder="搜索文件名" @keyup.enter="loadImages(1)" />

        <div class="tag-filter-wrap">
          <button type="button" class="tag-filter-btn" :class="{ active: filterTagIds.length > 0 }" @click="tagFilterOpen = !tagFilterOpen">
            <img src="/icons/gallery/tag-add-64x64.png" alt="" />
            标签筛选
            <span v-if="filterTagIds.length > 0">{{ filterTagIds.length }}</span>
          </button>
          <div v-if="tagFilterOpen" class="tag-filter-popover">
            <TagSelector :tags="filterableTags" :selectedTagIds="filterTagIds" @update:selectedTagIds="onFilterTagsChange" />
          </div>
        </div>

        <button type="button" class="search-btn" @click="loadImages(1)">
          <img src="/icons/actions/search-64x64.png" alt="" />
          搜索
        </button>
      </section>

      <section class="image-table-shell">
        <div class="image-table">
          <div class="image-table-head image-table-row">
            <span class="check-col">
              <button type="button" class="check-box" :class="{ checked: allCurrentSelected }" @click="toggleSelectAllCurrent"></button>
            </span>
            <span>缩略图</span>
            <span>文件名</span>
            <span>图片元信息</span>
            <span>平台标签</span>
            <span>用户私有标签（摘要）</span>
            <span>公开</span>
            <span>操作</span>
          </div>

          <div class="image-table-body">
            <div v-for="img in images" :key="img.id" class="image-table-row image-data-row" :class="{ selected: selectedIds.includes(img.id) }">
              <span class="check-col">
                <button type="button" class="check-box" :class="{ checked: selectedIds.includes(img.id) }" @click="toggleSelect(img.id)"></button>
              </span>
              <span class="thumb-col">
                <img :src="getThumbUrl(img)" :alt="img.filename" loading="lazy" />
              </span>
              <span class="file-col">
                <strong>{{ img.filename }}</strong>
                <small>{{ formatDateTime(img.created_at) }}</small>
              </span>
              <span class="meta-col">
                <em>{{ img.width || '-' }} × {{ img.height || '-' }}</em>
                <b>{{ formatSize(img.size_bytes) }}</b>
                <b>{{ formatMime(img.mime_type || img.filename) }}</b>
                <b>sRGB</b>
              </span>
              <span class="tag-col">
                <template v-for="(tag, index) in platformTags(img).slice(0, 3)" :key="tagKey(tag, index)">
                  <i class="tag-pill" :class="tagTone(index)">{{ tag.display_name || tag.name }}</i>
                </template>
                <i v-if="platformTags(img).length > 3" class="tag-pill more">+{{ platformTags(img).length - 3 }}</i>
                <em v-if="platformTags(img).length === 0" class="empty-inline">无</em>
              </span>
              <span class="tag-col private-tag-col">
                <template v-for="(tag, index) in privateTags(img).slice(0, 3)" :key="tagKey(tag, index)">
                  <i class="tag-pill" :class="tagTone(index + 2)">{{ tag.display_name || tag.name }}</i>
                </template>
                <i v-if="privateTags(img).length > 3" class="tag-pill more">+{{ privateTags(img).length - 3 }}</i>
                <em v-if="privateTags(img).length === 0" class="empty-inline">无</em>
              </span>
              <span class="public-col">
                <button type="button" class="public-switch" :class="{ active: img.is_public }" @click="togglePublic(img)">
                  <i></i>
                </button>
              </span>
              <span class="action-col">
                <button type="button" class="icon-action edit" @click="openEdit(img)">
                  <img src="/icons/actions/edit-64x64.png" alt="编辑" />
                </button>
                <button type="button" class="icon-action delete" @click="deleteImage(img)">
                  <img src="/icons/actions/trash-64x64.png" alt="删除" />
                </button>
              </span>
            </div>

            <div v-if="images.length === 0 && !loading" class="empty-row">暂无图片</div>
            <div v-if="loading" class="empty-row">加载中...</div>
          </div>
        </div>
      </section>

      <footer class="image-pagination">
        <div class="total-count">共 {{ formatNumber(total) }} 条</div>
        <div class="page-center">
          <button type="button" class="page-arrow" :disabled="page <= 1" @click="loadImages(page - 1)">‹</button>
          <button
            v-for="item in pageItems"
            :key="item.key"
            type="button"
            class="page-number"
            :class="{ active: item.page === page, ellipsis: item.ellipsis }"
            :disabled="item.ellipsis"
            @click="!item.ellipsis && loadImages(item.page)"
          >
            {{ item.label }}
          </button>
          <button type="button" class="page-arrow" :disabled="page >= totalPages" @click="loadImages(page + 1)">›</button>
        </div>
        <div class="page-tools">
          <select v-model.number="pageSize" class="page-size-select" @change="onPageSizeChange">
            <option :value="20">20 条/页</option>
            <option :value="50">50 条/页</option>
            <option :value="100">100 条/页</option>
          </select>
          <span>跳至</span>
          <input v-model="jumpPage" class="jump-input" @keyup.enter="jumpToPage" />
          <span>页</span>
        </div>
      </footer>
    </section>

    <div v-if="editingImage" class="modal-overlay" @click.self="closeEdit">
      <section class="edit-modal">
        <header class="edit-modal-title">
          <h2>编辑图片信息</h2>
          <button type="button" @click="closeEdit">×</button>
        </header>

        <div class="edit-modal-body">
          <aside class="preview-pane">
            <h3>图片预览</h3>
            <img class="preview-image" :src="getPreviewUrl(editingImage)" :alt="editingImage.filename" />
            <strong>{{ editingImage.filename }}</strong>
            <p>{{ editingImage.width || '-' }} × {{ editingImage.height || '-' }} <span>{{ formatMime(editingImage.mime_type || editingImage.filename) }}</span> <span>{{ formatSize(editingImage.size_bytes) }}</span></p>
            <p>上传时间：{{ formatDateTime(editingImage.created_at) }}</p>
            <p>上传者：{{ editImageOwnerName }}</p>
          </aside>

          <section class="edit-form-pane">
            <div class="edit-field">
              <div class="edit-label-row">
                <label>平台标签 <span>（可多选）</span></label>
              </div>
              <div class="edit-select-box platform-select-box" @click="openEditDropdown = 'platform'">
                <button v-for="tag in selectedPlatformTags" :key="tag.id" type="button" class="selected-chip" :class="tagToneById(tag.id)" @click.stop="removeEditTag('platform', tag.id)">
                  {{ tag.display_name || tag.name }} ×
                </button>
                <input
                  v-model="editPlatformTagDraft"
                  placeholder="选择或创建标签"
                  @click.stop="openEditDropdown = 'platform'"
                  @focus="openEditDropdown = 'platform'"
                  @keyup.enter.prevent="createPlatformTagFromDraft"
                />
                <img src="/icons/nav/chevron-down-64x64.png" alt="" />
              </div>
              <div v-if="openEditDropdown === 'platform'" class="edit-options-popover">
                <button
                  v-for="tag in allPlatformTagOptions"
                  :key="tag.id"
                  type="button"
                  :class="{ selected: editTagIds.includes(tag.id), disabled: isTagDisabled(tag, editTagIds) }"
                  @click="toggleEditTag('platform', tag)"
                >
                  {{ tag.display_name || tag.name }}
                </button>
              </div>
            </div>

            <div class="edit-field">
              <label>用户私有标签 <span>（该图片所有者的私有标签）</span></label>
              <div class="edit-select-box private-select-box" @click="openEditDropdown = 'private'">
                <button v-for="tag in selectedPrivateTags" :key="tag.id" type="button" class="selected-chip private-chip" @click.stop="removeEditTag('private', tag.id)">
                  {{ tag.display_name || tag.name }} ×
                </button>
                <input
                  v-model="editPrivateTagDraft"
                  :disabled="!editUserTagOwnerId"
                  placeholder="选择或创建标签"
                  @click.stop="openEditDropdown = 'private'"
                  @focus="openEditDropdown = 'private'"
                  @keyup.enter.prevent="createPrivateTagFromDraft"
                />
                <img src="/icons/nav/chevron-down-64x64.png" alt="" />
              </div>
              <div v-if="openEditDropdown === 'private'" class="edit-options-popover private-options">
                <button
                  v-for="tag in allPrivateTagOptions"
                  :key="tag.id"
                  type="button"
                  :class="{ selected: editUserTagIds.includes(tag.id), disabled: isTagDisabled(tag, editUserTagIds) }"
                  @click="toggleEditTag('private', tag)"
                >
                  {{ tag.display_name || tag.name }}
                </button>
                <em v-if="!editUserTagOwnerId">系统导入图片没有用户私有标签</em>
                <em v-else-if="allPrivateTagOptions.length === 0">暂无私有标签，可输入后回车创建</em>
              </div>
            </div>

            <div class="private-warning">
              <img src="/icons/status/warning-64x64.png" alt="" />
              <p><strong>不会影响或删除其他用户的私有标签</strong>此处仅管理该图片所属用户名下的私有标签，不会影响其他用户的同名标签。</p>
            </div>
          </section>
        </div>

        <footer class="edit-modal-footer">
          <button type="button" class="cancel-btn" @click="closeEdit">取消</button>
          <button type="button" class="save-btn" @click="saveEdit">保存</button>
        </footer>
      </section>
    </div>
  </div>
</template>

<script setup>
import TagSelector from '~/components/tags/TagSelector.vue'

definePageMeta({ layout: 'admin' })

const api = useApi()
const config = useRuntimeConfig()
const { tags, fetchTags } = useTags()
const { showAdminToast } = useAdminToast()

const images = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(50)
const jumpPage = ref('')
const loading = ref(false)
const search = ref('')
const imgSource = ref('all')
const filterUserId = ref(null)
const filterAlbumId = ref(null)
const filterTagIds = ref([])
const tagFilterOpen = ref(false)
const users = ref([])
const albums = ref([])
const selectedIds = ref([])

const editingImage = ref(null)
const editTagIds = ref([])
const editUserTagIds = ref([])
const editUserTagOwnerId = ref(null)
const editUserTagOwnerName = ref('系统导入')
const editUserTagOptions = ref({ combinable: [], nonCombinable: [] })
const editPlatformTagDraft = ref('')
const editPrivateTagDraft = ref('')
const openEditDropdown = ref('')

const filterableTags = computed(() => {
  const keepSelectable = tag => !tag.isSystemTag
  return {
    combinable: (tags.value.combinable || []).filter(keepSelectable),
    nonCombinable: (tags.value.nonCombinable || []).filter(keepSelectable)
  }
})

const editablePlatformTags = computed(() => {
  const keepPlatformTag = tag => !(tag.isSystemTag || tag.isUserTag || tag.isPublicUserTag || (typeof tag.id === 'string' && (tag.id.startsWith('u') || tag.id.startsWith('__'))))
  return {
    combinable: (tags.value.combinable || []).filter(keepPlatformTag),
    nonCombinable: (tags.value.nonCombinable || []).filter(keepPlatformTag)
  }
})

const allPlatformTagOptions = computed(() => [...(editablePlatformTags.value.combinable || []), ...(editablePlatformTags.value.nonCombinable || [])])
const allPrivateTagOptions = computed(() => [...(editUserTagOptions.value.combinable || []), ...(editUserTagOptions.value.nonCombinable || [])])
const selectedPlatformTags = computed(() => allPlatformTagOptions.value.filter(tag => editTagIds.value.includes(tag.id)))
const selectedPrivateTags = computed(() => allPrivateTagOptions.value.filter(tag => editUserTagIds.value.includes(tag.id)))
const totalPages = computed(() => Math.max(1, Math.ceil((total.value || 0) / Number(pageSize.value || 50))))
const pageItems = computed(() => buildPageItems(page.value, totalPages.value))
const allCurrentSelected = computed(() => images.value.length > 0 && images.value.every(img => selectedIds.value.includes(img.id)))
const editImageOwnerName = computed(() => editingImage.value?.uploader_name || editUserTagOwnerName.value)

onMounted(async () => {
  await fetchTags()
  await loadUsers()
  await loadAlbums()
  await loadImages()
})

async function loadUsers() {
  try {
    const data = await api.get('/api/admin/users', { all: true })
    users.value = data.users || []
  } catch {}
}

async function loadAlbums() {
  try {
    const params = { limit: 500 }
    if (imgSource.value === 'public') params.public = 'true'
    if (imgSource.value === 'mine') params.mine = 'true'
    if (imgSource.value === 'user' && filterUserId.value) params.userId = filterUserId.value
    if (imgSource.value === 'user' && !filterUserId.value) params.userGallery = 'true'
    const data = await api.get('/api/admin/albums', params)
    albums.value = data.albums || []
    if (filterAlbumId.value && !albums.value.some(album => String(album.id) === String(filterAlbumId.value))) {
      filterAlbumId.value = null
    }
  } catch {}
}

async function switchSource(source) {
  imgSource.value = source
  if (source !== 'user') filterUserId.value = null
  filterAlbumId.value = null
  await loadAlbums()
  await loadImages(1)
}

async function onUserFilterChange() {
  filterAlbumId.value = null
  await loadAlbums()
  await loadImages(1)
}

async function loadImages(targetPage = 1) {
  loading.value = true
  page.value = Number(targetPage) || 1
  selectedIds.value = []
  try {
    const params = {
      page: page.value,
      limit: Number(pageSize.value || 50),
      search: search.value.trim() || undefined
    }
    if (filterAlbumId.value) params.album = filterAlbumId.value
    if (filterTagIds.value.length > 0) params.tags = filterTagIds.value.join(',')
    if (imgSource.value === 'public') params.public = 'true'
    else if (imgSource.value === 'mine') params.mine = 'true'
    else if (imgSource.value === 'user') {
      if (filterUserId.value) params.userId = filterUserId.value
      else params.userGallery = 'true'
    }

    const data = await api.get('/api/internal/images', params)
    images.value = data.images || []
    total.value = Number(data.total || 0)
  } catch (err) {
    showAdminToast('加载图片失败: ' + (err.data?.error || err.message), 'error')
  } finally {
    loading.value = false
  }
}

function onFilterTagsChange(nextIds) {
  filterTagIds.value = nextIds
  loadImages(1)
}

function getThumbUrl(img) {
  const url = img.thumb_url || img.medium_url || img.url
  return url ? `${config.public.apiBase || ''}${url}` : ''
}

function getPreviewUrl(img) {
  const url = img.medium_url || img.url || img.thumb_url
  return url ? `${config.public.apiBase || ''}${url}` : ''
}

function platformTags(img) {
  return (img.tags || []).filter(tag => !isUserAppliedTag(tag))
}

function privateTags(img) {
  return (img.tags || []).filter(isUserAppliedTag)
}

function isUserAppliedTag(tag) {
  return tag.source === 'user' || tag.user_tag_id || tag.user_id || (typeof tag.id === 'string' && tag.id.startsWith('u'))
}

function toUserTagId(tag) {
  const rawId = tag.user_tag_id || tag.id
  return typeof rawId === 'string' && rawId.startsWith('u') ? rawId : `u${rawId}`
}

function mapUserTagsForSelector(tagList) {
  const mapped = tagList.map(tag => ({
    id: `u${tag.id}`,
    name: tag.name,
    display_name: tag.display_name || tag.name,
    combinable: tag.combinable !== false,
    mutually_exclusive_with: tag.mutually_exclusive_with,
    isUserTag: true
  }))
  return {
    combinable: mapped.filter(tag => tag.combinable !== false),
    nonCombinable: mapped.filter(tag => tag.combinable === false)
  }
}

async function loadEditUserTags(userId) {
  editUserTagOptions.value = { combinable: [], nonCombinable: [] }
  if (!userId) return
  try {
    const data = await api.get(`/api/admin/users/${userId}/tags`)
    editUserTagOptions.value = mapUserTagsForSelector(data.tags || [])
  } catch {}
}

async function openEdit(img) {
  editingImage.value = img
  openEditDropdown.value = ''
  editPlatformTagDraft.value = ''
  editPrivateTagDraft.value = ''
  editTagIds.value = platformTags(img).map(tag => tag.id).filter(id => typeof id === 'number')
  const appliedPrivateTags = privateTags(img)
  editUserTagIds.value = appliedPrivateTags.map(toUserTagId)
  editUserTagOwnerId.value = img.uploader_id || appliedPrivateTags[0]?.user_id || null
  const owner = users.value.find(user => String(user.id) === String(editUserTagOwnerId.value))
  editUserTagOwnerName.value = img.uploader_name || owner?.username || (editUserTagOwnerId.value ? `用户 ${editUserTagOwnerId.value}` : '系统导入')
  await loadEditUserTags(editUserTagOwnerId.value)
}

function closeEdit() {
  editingImage.value = null
  editTagIds.value = []
  editUserTagIds.value = []
  editUserTagOwnerId.value = null
  editUserTagOwnerName.value = '系统导入'
  editUserTagOptions.value = { combinable: [], nonCombinable: [] }
  editPlatformTagDraft.value = ''
  editPrivateTagDraft.value = ''
  openEditDropdown.value = ''
}

async function saveEdit() {
  if (!editingImage.value) return
  try {
    await api.post('/api/admin/tags/run/manual', {
      imageIds: [editingImage.value.id],
      tagIds: editTagIds.value,
      overwrite: true
    })
    if (editUserTagOwnerId.value) {
      await api.post('/api/admin/tags/run/user-private', {
        imageIds: [editingImage.value.id],
        userId: editUserTagOwnerId.value,
        tagIds: editUserTagIds.value,
        overwrite: true
      })
    }
    closeEdit()
    await loadImages(page.value)
    showAdminToast('图片信息已保存', 'success')
  } catch (err) {
    showAdminToast('保存失败: ' + (err.data?.error || err.message), 'error')
  }
}

async function createPrivateTagFromDraft() {
  const label = editPrivateTagDraft.value.trim()
  if (!label || !editUserTagOwnerId.value) return
  const existing = allPrivateTagOptions.value.find(tag => [tag.name, tag.display_name].filter(Boolean).some(value => String(value).toLowerCase() === label.toLowerCase()))
  if (existing) {
    if (!editUserTagIds.value.includes(existing.id)) editUserTagIds.value.push(existing.id)
    editPrivateTagDraft.value = ''
    return
  }
  try {
    const data = await api.post(`/api/admin/users/${editUserTagOwnerId.value}/tags`, {
      name: label,
      display_name: label,
      combinable: true
    })
    await loadEditUserTags(editUserTagOwnerId.value)
    const id = `u${data.id}`
    if (!editUserTagIds.value.includes(id)) editUserTagIds.value.push(id)
    editPrivateTagDraft.value = ''
    showAdminToast('标签已创建', 'success')
  } catch (err) {
    showAdminToast('创建标签失败: ' + (err.data?.error || err.message), 'error')
  }
}

async function createPlatformTagFromDraft() {
  const label = editPlatformTagDraft.value.trim()
  if (!label) return
  const existing = allPlatformTagOptions.value.find(tag => [tag.name, tag.display_name].filter(Boolean).some(value => String(value).toLowerCase() === label.toLowerCase()))
  if (existing) {
    if (!editTagIds.value.includes(existing.id)) editTagIds.value.push(existing.id)
    editPlatformTagDraft.value = ''
    return
  }
  try {
    const data = await api.post('/api/admin/tags/create', {
      name: label,
      display_name: label,
      combinable: true
    })
    await fetchTags()
    if (!editTagIds.value.includes(data.id)) editTagIds.value.push(data.id)
    editPlatformTagDraft.value = ''
    showAdminToast('平台标签已创建', 'success')
  } catch (err) {
    showAdminToast('创建平台标签失败: ' + (err.data?.error || err.message), 'error')
  }
}

function toggleEditTag(scope, tag) {
  const target = scope === 'platform' ? editTagIds : editUserTagIds
  if (isTagDisabled(tag, target.value)) return
  const idx = target.value.indexOf(tag.id)
  if (idx >= 0) {
    target.value.splice(idx, 1)
    return
  }
  for (const mutualId of parseMutualIds(tag.mutually_exclusive_with)) {
    const conflictIndex = target.value.findIndex(id => tagIdKey(id) === tagIdKey(mutualId))
    if (conflictIndex >= 0) target.value.splice(conflictIndex, 1)
  }
  target.value.push(tag.id)
}

function removeEditTag(scope, tagId) {
  const target = scope === 'platform' ? editTagIds : editUserTagIds
  target.value = target.value.filter(id => id !== tagId)
}

function isTagDisabled(tag, selectedIdsForScope) {
  return parseMutualIds(tag.mutually_exclusive_with).some(id => selectedIdsForScope.some(selectedId => tagIdKey(selectedId) === tagIdKey(id))) && !selectedIdsForScope.some(id => tagIdKey(id) === tagIdKey(tag.id))
}

function parseMutualIds(value) {
  if (!value) return []
  return String(value).split(/[,，.。\s]+/).map(item => item.trim()).filter(Boolean).map(id => /^u\d+$/i.test(id) ? `u${parseInt(id.slice(1))}` : (/^\d+$/.test(id) ? Number(id) : null)).filter(id => id !== null)
}

function tagIdKey(id) {
  return /^u\d+$/i.test(String(id)) ? `u${parseInt(String(id).slice(1))}` : String(Number(id))
}

async function togglePublic(img) {
  try {
    await api.put(`/api/admin/images/${img.id}`, { is_public: !img.is_public })
    img.is_public = !img.is_public
  } catch (err) {
    showAdminToast('操作失败: ' + (err.data?.error || err.message), 'error')
  }
}

async function deleteImage(img) {
  if (!confirm(`确定删除图片 "${img.filename}"？`)) return
  try {
    await api.del(`/api/admin/images/${img.id}`)
    await loadImages(page.value)
    showAdminToast('图片已删除', 'success')
  } catch (err) {
    showAdminToast('删除失败: ' + (err.data?.error || err.message), 'error')
  }
}

function toggleSelect(id) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter(item => item !== id)
    : [...selectedIds.value, id]
}

function toggleSelectAllCurrent() {
  selectedIds.value = allCurrentSelected.value ? [] : images.value.map(img => img.id)
}

function onPageSizeChange() {
  loadImages(1)
}

function jumpToPage() {
  const target = Math.max(1, Math.min(Number(jumpPage.value) || 1, totalPages.value))
  jumpPage.value = ''
  loadImages(target)
}

function buildPageItems(current, totalPageCount) {
  const items = []
  const pushPage = pageNumber => items.push({ key: `p-${pageNumber}`, label: pageNumber, page: pageNumber })
  const pushEllipsis = key => items.push({ key, label: '...', ellipsis: true })
  if (totalPageCount <= 7) {
    for (let index = 1; index <= totalPageCount; index++) pushPage(index)
    return items
  }
  if (current <= 4) {
    for (let index = 1; index <= 5; index++) pushPage(index)
    pushEllipsis('e-right')
    pushPage(totalPageCount)
    return items
  }
  if (current >= totalPageCount - 3) {
    pushPage(1)
    pushEllipsis('e-left')
    for (let index = totalPageCount - 4; index <= totalPageCount; index++) pushPage(index)
    return items
  }
  pushPage(1)
  pushEllipsis('e-left')
  pushPage(current - 1)
  pushPage(current)
  pushPage(current + 1)
  pushEllipsis('e-right')
  pushPage(totalPageCount)
  return items
}

function formatSize(bytes) {
  const size = Number(bytes || 0)
  if (!size) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatMime(value) {
  const text = String(value || '')
  if (text.includes('/')) return text.split('/').pop().toUpperCase().replace('JPEG', 'JPG')
  const ext = text.split('.').pop()
  return ext ? ext.toUpperCase() : '-'
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

function tagKey(tag, index) {
  return `${tag.source || 'tag'}-${tag.id || tag.user_tag_id || tag.name}-${index}`
}

function tagTone(index) {
  return ['tone-pink', 'tone-mint', 'tone-violet', 'tone-blue', 'tone-orange'][index % 5]
}

function tagToneById(id) {
  const number = parseInt(String(id).replace(/^u/, '')) || 0
  return tagTone(number)
}
</script>

<style scoped>
.admin-image-page {
  height: calc(100vh - 108px);
  min-height: 640px;
  overflow: hidden;
  color: #59677f;
}

.admin-image-page::before {
  content: '';
  position: fixed;
  inset: 64px 0 0 220px;
  z-index: -1;
  pointer-events: none;
  background: linear-gradient(135deg, rgba(255, 248, 252, 0.92), rgba(245, 251, 255, 0.94) 46%, rgba(252, 248, 255, 0.86));
}

.image-panel {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: 58px 74px minmax(0, 1fr) 68px;
  overflow: hidden;
  border: 1px solid rgba(226, 230, 241, 0.78);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.68);
  box-shadow: 0 18px 42px rgba(84, 94, 120, 0.08);
  backdrop-filter: blur(22px) saturate(1.08);
}

.image-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 0;
  padding: 0 20px;
  border-bottom: 1px solid rgba(225, 229, 239, 0.72);
}

.image-title {
  display: inline-flex;
  align-items: center;
  gap: 11px;
}

.image-title img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.image-title h1 {
  margin: 0;
  color: #2d3850;
  font-size: 17px;
  font-weight: 900;
}

.image-filter-row {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(126px, 0.56fr) minmax(180px, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  min-height: 0;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(225, 229, 239, 0.72);
  box-sizing: border-box;
}

.image-filter-row.has-user-filter {
  grid-template-columns: auto minmax(118px, 0.45fr) minmax(126px, 0.5fr) minmax(170px, 1fr) auto auto;
}

.scope-tabs {
  display: inline-grid;
  grid-template-columns: repeat(4, 80px);
  overflow: hidden;
  border: 1px solid rgba(226, 230, 241, 0.9);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.72);
}

.scope-tabs button {
  min-height: 42px;
  border: none;
  border-right: 1px solid rgba(226, 230, 241, 0.76);
  background: transparent;
  color: #778299;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.scope-tabs button:last-child {
  border-right: none;
}

.scope-tabs button.active {
  background: rgba(255, 235, 244, 0.92);
  color: #f45f93;
  box-shadow: inset 0 0 0 1px rgba(255, 210, 228, 0.72);
}

.soft-select,
.name-filter,
.tag-filter-btn,
.search-btn,
.page-size-select,
.jump-input {
  height: 42px;
  border: 1px solid rgba(220, 226, 238, 0.96);
  border-radius: 8px;
  outline: none;
  font-size: 13px;
  font-weight: 800;
  box-sizing: border-box;
}

.soft-select {
  min-width: 0;
  width: 100%;
  padding: 0 12px;
  background: rgba(255,255,255,0.72);
  color: #6c778d;
}

.user-filter {
  min-width: 118px;
}

.album-filter {
  min-width: 126px;
}

.name-filter {
  width: 100%;
  min-width: 160px;
  padding: 0 14px;
  background: rgba(255,255,255,0.64);
  color: #657188;
}

.name-filter::placeholder {
  color: #b9c1cf;
}

.tag-filter-wrap {
  position: relative;
}

.tag-filter-btn {
  min-width: 126px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 13px;
  background: rgba(255,255,255,0.72);
  color: #6c778d;
  cursor: pointer;
}

.tag-filter-btn.active {
  color: #f45f93;
  border-color: rgba(255, 111, 157, 0.36);
  background: rgba(255, 244, 249, 0.9);
}

.tag-filter-btn img,
.search-btn img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.tag-filter-btn span {
  min-width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(255, 111, 157, 0.15);
  color: #f45f93;
  font-size: 11px;
}

.tag-filter-popover {
  position: absolute;
  top: 48px;
  right: 0;
  z-index: 15;
  width: min(460px, 70vw);
  max-height: 360px;
  overflow: auto;
  padding: 14px;
  border: 1px solid rgba(226, 230, 241, 0.88);
  border-radius: 12px;
  background: rgba(255,255,255,0.96);
  box-shadow: 0 18px 42px rgba(84, 94, 120, 0.14);
}

.search-btn {
  min-width: 88px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: none;
  background: linear-gradient(90deg, #f45f93, #ff78a9);
  color: white;
  box-shadow: 0 12px 24px rgba(244, 95, 147, 0.22);
  cursor: pointer;
}

.image-table-shell {
  min-height: 0;
  overflow: hidden;
  padding: 0 20px 12px;
  box-sizing: border-box;
}

.image-table {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: 46px minmax(0, 1fr);
  margin-top: 0;
  overflow: hidden;
  border: 1px solid rgba(226, 230, 241, 0.88);
  border-radius: 9px;
  background: rgba(255,255,255,0.62);
}

.image-table-row {
  display: grid;
  grid-template-columns: 34px 88px minmax(128px, 1.05fr) minmax(138px, 0.88fr) minmax(150px, 0.98fr) minmax(170px, 1.06fr) 62px 82px;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
}

.image-table-head {
  min-height: 46px;
  border-bottom: 1px solid rgba(226, 230, 241, 0.8);
  background: rgba(250, 251, 254, 0.76);
  color: #69758c;
  font-size: 12px;
  font-weight: 900;
}

.image-table-body {
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.image-table-body::-webkit-scrollbar {
  width: 10px;
}

.image-table-body::-webkit-scrollbar-track {
  background: rgba(241, 244, 249, 0.78);
}

.image-table-body::-webkit-scrollbar-thumb {
  border: 2px solid rgba(241, 244, 249, 0.78);
  border-radius: 999px;
  background: rgba(179, 190, 209, 0.9);
}

.image-data-row {
  min-height: 66px;
  border-bottom: 1px solid rgba(226, 230, 241, 0.66);
  color: #5f6a82;
  font-size: 12px;
}

.image-data-row:last-child {
  border-bottom: none;
}

.image-data-row.selected {
  background: rgba(255, 247, 251, 0.7);
}

.check-col {
  display: grid;
  place-items: center;
}

.check-box {
  position: relative;
  width: 15px;
  height: 15px;
  border: 1px solid rgba(207, 216, 231, 0.96);
  border-radius: 4px;
  background: rgba(255,255,255,0.9);
  cursor: pointer;
}

.check-box.checked {
  border-color: #f45f93;
  background: #f45f93;
}

.check-box.checked::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.thumb-col img {
  width: 82px;
  height: 46px;
  display: block;
  border-radius: 7px;
  object-fit: cover;
  background: #eef2f8;
}

.file-col {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.file-col strong {
  overflow: hidden;
  color: #526078;
  font-size: 12px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-col small {
  color: #a1abc0;
  font-size: 11px;
  font-weight: 800;
}

.meta-col {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px 8px;
  color: #77839a;
  font-size: 11px;
  font-weight: 800;
}

.meta-col em,
.meta-col b {
  font-style: normal;
  font-weight: 800;
}

.meta-col b::before {
  content: '·';
  margin-right: 8px;
  color: #b5bfce;
}

.tag-col {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-height: 22px;
  max-width: 78px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-pill.tone-pink,
.selected-chip.tone-pink {
  background: rgba(255, 239, 246, 0.95);
  color: #f45f93;
}

.tag-pill.tone-mint,
.selected-chip.tone-mint {
  background: rgba(232, 248, 245, 0.95);
  color: #27a98c;
}

.tag-pill.tone-violet,
.selected-chip.tone-violet {
  background: rgba(244, 239, 255, 0.96);
  color: #8a6be8;
}

.tag-pill.tone-blue,
.selected-chip.tone-blue {
  background: rgba(234, 243, 255, 0.96);
  color: #4a86d9;
}

.tag-pill.tone-orange,
.selected-chip.tone-orange {
  background: rgba(255, 242, 234, 0.96);
  color: #d47a51;
}

.tag-pill.more {
  background: rgba(241, 244, 249, 0.96);
  color: #8e99ad;
}

.empty-inline {
  color: #a4aebf;
  font-style: normal;
  font-weight: 800;
}

.public-col {
  display: flex;
  justify-content: center;
}

.public-switch {
  position: relative;
  width: 34px;
  height: 20px;
  border: none;
  border-radius: 999px;
  background: #dfe5ee;
  cursor: pointer;
  transition: background 0.16s ease;
}

.public-switch i {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 7px rgba(80, 90, 110, 0.2);
  transition: transform 0.16s ease;
}

.public-switch.active {
  background: #f45f93;
}

.public-switch.active i {
  transform: translateX(14px);
}

.action-col {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.icon-action {
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  cursor: pointer;
}

.icon-action img {
  width: 15px;
  height: 15px;
  object-fit: contain;
}

.icon-action.edit {
  border: 1px solid rgba(219, 225, 237, 0.94);
  background: rgba(255,255,255,0.78);
}

.icon-action.delete {
  border: 1px solid rgba(255, 111, 157, 0.2);
  background: rgba(255, 241, 246, 0.88);
}

.empty-row {
  display: grid;
  place-items: center;
  min-height: 180px;
  color: #9aa5b8;
  font-size: 13px;
  font-weight: 900;
}

.image-pagination {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(150px, 1fr) auto minmax(260px, 1fr);
  align-items: center;
  gap: 18px;
  min-height: 0;
  padding: 15px 20px 18px;
  box-sizing: border-box;
  border-top: 1px solid rgba(225, 229, 239, 0.78);
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 -12px 26px rgba(84, 94, 120, 0.06);
  backdrop-filter: blur(18px);
  color: #69758c;
  font-size: 13px;
  font-weight: 900;
}

.page-center,
.page-tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-center {
  justify-content: center;
}

.page-tools {
  justify-content: flex-end;
}

.page-arrow,
.page-number {
  min-width: 34px;
  height: 34px;
  border: 1px solid rgba(220, 226, 238, 0.96);
  border-radius: 7px;
  background: rgba(255,255,255,0.72);
  color: #69758c;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.page-number.active {
  border-color: rgba(244, 95, 147, 0.58);
  background: rgba(255, 241, 247, 0.9);
  color: #f45f93;
}

.page-number.ellipsis {
  cursor: default;
}

.page-arrow:disabled {
  opacity: 0.48;
  cursor: default;
}

.page-size-select {
  min-width: 94px;
  padding: 0 10px;
  background: rgba(255,255,255,0.72);
  color: #69758c;
}

.jump-input {
  width: 58px;
  padding: 0 10px;
  text-align: center;
  background: rgba(255,255,255,0.72);
  color: #69758c;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(38, 45, 62, 0.18);
  backdrop-filter: blur(3px);
}

.edit-modal {
  width: min(820px, calc(100vw - 48px));
  overflow: hidden;
  border: 1px solid rgba(226, 230, 241, 0.92);
  border-radius: 12px;
  background: rgba(255,255,255,0.96);
  box-shadow: 0 24px 64px rgba(69, 78, 104, 0.22);
}

.edit-modal-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 54px;
  padding: 0 22px;
  border-bottom: 1px solid rgba(226, 230, 241, 0.78);
}

.edit-modal-title h2 {
  margin: 0;
  color: #2e3a52;
  font-size: 15px;
  font-weight: 900;
}

.edit-modal-title button {
  border: none;
  background: transparent;
  color: #7e8aa0;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.edit-modal-body {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
}

.preview-pane {
  padding: 18px 20px 20px;
  border-right: 1px solid rgba(226, 230, 241, 0.78);
}

.preview-pane h3,
.edit-field label {
  margin: 0 0 10px;
  color: #536077;
  font-size: 13px;
  font-weight: 900;
}

.edit-field label span {
  color: #9aa5b8;
  font-weight: 800;
}

.preview-image {
  width: 196px;
  height: 196px;
  display: block;
  margin-bottom: 12px;
  border-radius: 8px;
  object-fit: cover;
  background: #eef2f8;
}

.preview-pane strong {
  display: block;
  margin-bottom: 8px;
  color: #68758c;
  font-size: 12px;
  font-weight: 900;
}

.preview-pane p {
  margin: 6px 0;
  color: #8792a8;
  font-size: 12px;
  font-weight: 800;
}

.preview-pane p span::before {
  content: '·';
  margin: 0 8px;
  color: #b5bfce;
}

.edit-form-pane {
  padding: 18px 22px 20px;
}

.edit-field {
  position: relative;
  margin-bottom: 16px;
}

.edit-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.edit-label-row button {
  border: none;
  background: transparent;
  color: #8a6be8;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.edit-select-box {
  position: relative;
  min-height: 64px;
  display: flex;
  align-content: flex-start;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 38px 10px 10px;
  border: 1px solid rgba(218, 224, 238, 0.96);
  border-radius: 8px;
  background: rgba(255,255,255,0.8);
  cursor: pointer;
}

.edit-select-box > img {
  position: absolute;
  right: 12px;
  top: 18px;
  width: 14px;
  height: 14px;
  opacity: 0.68;
}

.edit-select-box em {
  align-self: center;
  color: #b0b9c8;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.selected-chip {
  min-height: 24px;
  padding: 0 9px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.private-chip {
  background: rgba(255, 239, 246, 0.95);
  color: #f45f93;
}

.platform-select-box input,
.private-select-box input {
  flex: 1 1 130px;
  min-width: 120px;
  height: 24px;
  border: none;
  outline: none;
  background: transparent;
  color: #657188;
  font-size: 12px;
  font-weight: 800;
}

.platform-select-box input::placeholder,
.private-select-box input::placeholder {
  color: #b8c0ce;
}

.edit-options-popover {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  z-index: 12;
  max-height: 180px;
  overflow: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  border: 1px solid rgba(226, 230, 241, 0.9);
  border-radius: 8px;
  background: rgba(255,255,255,0.98);
  box-shadow: 0 18px 34px rgba(76, 86, 114, 0.14);
}

.edit-options-popover button {
  min-height: 24px;
  padding: 0 9px;
  border: 1px solid rgba(226, 230, 241, 0.9);
  border-radius: 6px;
  background: rgba(255,255,255,0.74);
  color: #6d788e;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.edit-options-popover button.selected {
  border-color: rgba(255, 111, 157, 0.45);
  background: rgba(255, 239, 246, 0.95);
  color: #f45f93;
}

.edit-options-popover button.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.edit-options-popover em {
  color: #9ba6b8;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.private-warning {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-top: 8px;
  padding: 11px 12px;
  border: 1px solid rgba(241, 188, 89, 0.24);
  border-radius: 8px;
  background: rgba(255, 249, 235, 0.9);
}

.private-warning img {
  width: 18px;
  height: 18px;
}

.private-warning p {
  margin: 0;
  color: #b47b2a;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.55;
}

.private-warning strong {
  display: block;
  color: #ba7a1e;
  font-size: 12px;
  font-weight: 900;
}

.edit-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 22px;
  border-top: 1px solid rgba(226, 230, 241, 0.72);
}

.cancel-btn,
.save-btn {
  min-width: 76px;
  height: 34px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.cancel-btn {
  border: 1px solid rgba(218, 224, 238, 0.96);
  background: rgba(255,255,255,0.86);
  color: #6f7a90;
}

.save-btn {
  border: none;
  background: linear-gradient(90deg, #f45f93, #ff78a9);
  color: white;
  box-shadow: 0 10px 22px rgba(244, 95, 147, 0.2);
}

button {
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

button:active {
  transform: scale(0.985);
}

@media (max-width: 1320px) {
  .image-filter-row {
    grid-template-columns: 1fr 126px minmax(120px, 1fr) auto auto;
  }
  .image-filter-row.has-user-filter {
    grid-template-columns: 1fr 112px 120px minmax(110px, 1fr) auto auto;
  }
  .scope-tabs {
    grid-template-columns: repeat(4, minmax(68px, 1fr));
  }
  .image-table-row {
    grid-template-columns: 30px 80px minmax(118px, 1fr) minmax(118px, 0.82fr) minmax(128px, 0.84fr) minmax(138px, 0.9fr) 56px 76px;
    gap: 8px;
    padding: 0 8px;
  }
  .thumb-col img {
    width: 76px;
    height: 43px;
  }
}
</style>
