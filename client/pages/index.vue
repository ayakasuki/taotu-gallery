<template>
  <div class="gallery-page">
    <aside class="gallery-sidebar taotu-panel">
      <section class="filter-section">
        <button class="filter-heading" @click="toggleFilterSection('source')">
          <span>图库来源</span>
          <TaotuIcon name="chevron-down" class="heading-caret" :class="{ expanded: openSections.source }" />
        </button>
        <div v-show="openSections.source" class="filter-body">
          <button class="source-row" :class="{ active: gallerySource === 'public' }" @click="switchSource('public')">
            <span>公共图库</span><b>{{ sourceCounts.public }}</b>
          </button>
          <button v-if="isLoggedIn" class="source-row" :class="{ active: gallerySource === 'mine' }" @click="switchSource('mine')">
            <span>我的图库</span><b>{{ sourceCounts.mine }}</b>
          </button>
          <button v-if="isAdmin" class="source-row" :class="{ active: gallerySource === 'user' }" @click="switchSource('user')">
            <span>用户图库</span><b>{{ sourceCounts.user }}</b>
          </button>
        </div>
        <TaotuSelect
          v-if="gallerySource === 'user'"
          v-model="selectedUserId"
          class="compact-select"
          :options="userOptions"
          @change="loadGallery"
        />
      </section>

      <section class="filter-section">
        <button class="filter-heading" @click="toggleFilterSection('sort')">
          <span>排序</span>
          <TaotuIcon name="chevron-down" class="heading-caret" :class="{ expanded: openSections.sort }" />
        </button>
        <div v-show="openSections.sort" class="filter-body">
          <button
            v-for="opt in sortOptions"
            :key="opt.value"
            class="source-row"
            :class="{ active: sort === opt.value }"
            @click="handleSortChange(opt.value)"
          >
            <span>{{ opt.label }}</span>
          </button>
        </div>
      </section>

      <section class="filter-section">
        <button class="filter-heading" @click="toggleFilterSection('mode')">
          <span>展示模式</span>
          <TaotuIcon name="chevron-down" class="heading-caret" :class="{ expanded: openSections.mode }" />
        </button>
        <div v-show="openSections.mode" class="mode-buttons">
          <button class="mode-card" :class="{ active: displayMode === 'grid' }" @click="handleModeChange('grid')">
            <TaotuIcon name="grid" />
            <span>网格</span>
          </button>
          <button class="mode-card" :class="{ active: displayMode === 'waterfall' }" @click="handleModeChange('waterfall')">
            <TaotuIcon name="waterfall" />
            <span>瀑布流</span>
          </button>
        </div>
      </section>

      <section class="filter-section">
        <div class="filter-heading static-heading">
          <button class="heading-main" @click="toggleFilterSection('tags')">
            <span>标签分组</span>
            <TaotuIcon name="chevron-down" class="heading-caret" :class="{ expanded: openSections.tags }" />
          </button>
          <button class="expand-all-btn" @click.stop="toggleExpandAll">{{ allGroupsExpanded ? '收起全部' : '展开全部' }}</button>
        </div>
        <div v-show="openSections.tags" class="tag-tree">
          <div v-if="tagGroups.length === 0" class="muted-hint">暂无标签分组</div>
          <div v-for="group in tagGroups" :key="group.id" class="tree-group">
            <div class="tree-title-row">
              <button class="tree-title" :class="{ selected: isGroupSelected(group) }" @click="toggleGroup(group)">
                <span>{{ group.name }}</span>
                <b>{{ getGroupAllTagIds(group).length }}</b>
              </button>
              <button class="tree-caret" @click="group._expanded = !group._expanded">
                <TaotuIcon name="chevron-down" class="tree-caret-icon" :class="{ expanded: group._expanded }" />
              </button>
            </div>
            <div v-show="group._expanded" class="tree-content">
              <div v-if="getDirectTags(group).length > 0" class="tag-chip-list direct-list">
                <button
                  v-for="tag in getDirectTags(group)"
                  :key="tagKey(tag)"
                  class="tree-tag"
                  :class="{ selected: isSelectedTag(tag.id), disabled: isTagDisabled(tag) }"
                  @click="toggleTag(tag)"
                >
                  {{ tag.display_name || tag.name }}
                </button>
              </div>
              <div v-for="sg in group.subgroups || []" :key="sg.sid" class="tree-subgroup">
                <div class="tree-subtitle-row">
                  <button class="tree-subtitle" :class="{ selected: isSubgroupSelected(sg) }" @click="toggleSubgroup(sg)">
                    <span>{{ sg.name }}</span>
                    <b>{{ getFilteredTagIds(sg.tagIds).length }}</b>
                  </button>
                  <button class="tree-caret small" @click="sg._expanded = !sg._expanded">
                    <TaotuIcon name="chevron-down" class="tree-caret-icon" :class="{ expanded: sg._expanded }" />
                  </button>
                </div>
                <div v-show="sg._expanded" class="tag-chip-list">
                  <button
                    v-for="tag in getTagsByIds(sg.tagIds)"
                    :key="tagKey(tag)"
                    class="tree-tag"
                    :class="{ selected: isSelectedTag(tag.id), disabled: isTagDisabled(tag) }"
                    @click="toggleTag(tag)"
                  >
                    {{ tag.display_name || tag.name }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <button v-if="selectedTagIds.length > 0" class="clear-tags-btn" @click="clearTags">清空已选 {{ selectedTagIds.length }} 个标签</button>
        </div>
      </section>
    </aside>

    <section class="gallery-main">
      <div v-if="gallerySource === 'mine' && selectedIds.length > 0" class="gallery-toolbar">
        <div class="toolbar-left">
          <span class="selected-note">已选择 {{ selectedIds.length }} 项</span>
          <button class="taotu-btn taotu-btn-secondary" @click="selectedIds = []">清空选择</button>
          <button class="taotu-btn taotu-btn-secondary" @click="selectAllCurrent">
            <TaotuIcon name="multi-select" class="taotu-icon taotu-icon-18" />
            全选
          </button>
          <button class="taotu-btn taotu-btn-danger" @click="batchDelete">
            <TaotuIcon name="delete" class="taotu-icon taotu-icon-18" />
            批量删除
          </button>
          <button class="taotu-btn taotu-btn-primary" @click="showMoveModal = true">
            <TaotuIcon name="move-album" class="taotu-icon taotu-icon-18" />
            移动到相册
          </button>
        </div>
      </div>

        <div
          ref="galleryListRef"
          class="gallery-with-select"
          :class="['mode-' + displayMode, { 'has-selection': selectedIds.length > 0 }]"
          :style="galleryLayoutStyle"
        >
          <div
            v-for="(img, index) in images"
            :key="img.id"
            class="gallery-item-wrapper"
            :class="{ selected: selectedIds.includes(img.id), ready: Boolean(waterfallItems[index]) }"
            :style="getItemStyle(img, index)"
            @click="handleItemClick(img)"
            @pointerdown="startLongPress(img)"
            @pointerup="cancelLongPress"
            @pointerleave="cancelLongPress"
            @pointercancel="cancelLongPress"
          >
            <div class="select-checkbox" v-if="waterfallItems[index] && gallerySource === 'mine'" @click.stop="toggleSelect(img.id)">
              <span class="native-check" :class="{ checked: selectedIds.includes(img.id) }"></span>
            </div>
            <ImageCard v-if="waterfallItems[index]" :image="img" :mode="displayMode" :showInfo="true" />
          </div>
        </div>

        <div v-if="images.length === 0 && !loading" class="empty-state">
          <TaotuIcon name="no-images" class="taotu-icon taotu-icon-128" />
          <p>{{ emptyText }}</p>
        </div>
        <div v-if="loading" class="empty-state">
          <TaotuIcon name="loading" class="taotu-icon taotu-icon-64" />
          <p>加载中...</p>
        </div>

        <div ref="loadMoreRef" class="load-more-sentinel" aria-hidden="true"></div>
    </section>

    <!-- 移动到相册弹窗 -->
    <div v-if="showMoveModal" class="modal-overlay" @click.self="showMoveModal = false">
      <div class="modal taotu-card taotu-card-pad">
        <h3>移动到相册</h3>
        <p class="modal-desc">将选中的 {{ selectedIds.length }} 张图片移动到：</p>
        <div class="form-group">
          <TaotuSelect v-model="moveToAlbumId" :options="moveAlbumOptions" />
        </div>
        <div class="form-group">
          <label>或新建相册</label>
          <input v-model="newAlbumName" class="taotu-input" placeholder="输入新相册名" />
        </div>
        <div class="modal-actions">
          <button class="taotu-btn taotu-btn-primary" @click="moveToAlbum" :disabled="!moveToAlbumId && !newAlbumName">确认移动</button>
          <button class="taotu-btn taotu-btn-secondary" @click="showMoveModal = false">取消</button>
        </div>
      </div>
    </div>

    <ConfirmDeleteDialog
      :show="deleteDialog.show"
      title="确认删除图片"
      :message="deleteDialog.message"
      :effects="deleteDialog.effects"
      :loading="deleteDialog.loading"
      @confirm="confirmBatchDelete"
      @cancel="closeDeleteDialog"
    />
  </div>
</template>

<script setup>
import ImageCard from '~/components/gallery/ImageCard.vue'

const { tags, selectedTagIds, fetchTags } = useTags()
const { images, total, page, loading, displayMode, sort, fetchImages, setDisplayMode, setSort } = useGallery()
const api = useApi()
const { clearAuthSession, isAuthFailure } = useUiCache()
const isLoggedIn = ref(false)
const isAdmin = ref(false)
const gallerySource = ref('public')
const selectedUserId = ref(null)
const users = ref([])
const tagGroups = ref([])
const openSections = reactive({ source: true, sort: true, mode: true, tags: true })
const allGroupsExpanded = ref(false)
const sourceCounts = reactive({ public: '-', mine: '-', user: '-' })
const sortOptions = [
  { label: '最新', value: 'created_at' },
  { label: '最热门', value: 'view_count' },
  { label: '文件名', value: 'filename' }
]

// 多选相关
const selectedIds = ref([])
const deleteDialog = reactive({ show: false, payload: [], message: '', effects: [], loading: false })

// 移动相册相关
const showMoveModal = ref(false)
const moveToAlbumId = ref(null)
const newAlbumName = ref('')
const albums = ref([])
const galleryListRef = ref(null)
const waterfallItems = ref([])
const waterfallHeight = ref(0)
const minGridColumnWidth = 180
const minWaterfallColumnWidth = 190
const gridGap = 10
const pageSize = 30
const loadMoreRef = ref(null)
let infiniteObserver = null
let resizeObserver = null
let layoutRaf = 0
let loadMoreCheckRaf = 0
let longPressTimer = null
let longPressTriggered = false

const galleryLayoutStyle = computed(() => ({ height: waterfallHeight.value + 'px' }))
const allTags = computed(() => [...(tags.value.combinable || []), ...(tags.value.nonCombinable || [])])
const hasMore = computed(() => images.value.length < total.value)
const userOptions = computed(() => [
  { label: '全部用户', value: null },
  ...users.value.map(user => ({ label: user.username, value: user.id }))
])
const moveAlbumOptions = computed(() => [
  { label: '请选择相册', value: null },
  ...albums.value.map(album => ({ label: album.name, value: album.id }))
])

const emptyText = computed(() => {
  if (gallerySource.value === 'mine') return '您还没有上传图片'
  if (gallerySource.value === 'user') return selectedUserId.value ? '该用户暂无图片' : '暂无图片'
  return '暂无公共图片'
})

onMounted(async () => {
  await loadDisplayConfig()
  const token = localStorage.getItem('jwt_token')
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const me = await api.get('/api/admin/auth/me')
      isLoggedIn.value = true
      isAdmin.value = me?.role === 'admin' || payload.role === 'admin'
    } catch (err) {
      if (isAuthFailure(err)) {
        clearAuthSession()
        isLoggedIn.value = false
        isAdmin.value = false
        gallerySource.value = 'public'
      } else {
        isLoggedIn.value = true
        isAdmin.value = payload.role === 'admin'
      }
    }
  } else {
    isLoggedIn.value = false
    isAdmin.value = false
  }
  await fetchTags()
  await loadTagGroups()
  if (isAdmin.value) await loadUsers()
  await loadSourceCounts()
  await loadGallery()
  await nextTick()
  resizeObserver = new ResizeObserver(() => scheduleLayout())
  if (galleryListRef.value) resizeObserver.observe(galleryListRef.value)
  infiniteObserver = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) loadMore()
  }, { rootMargin: '560px 0px' })
  if (loadMoreRef.value) infiniteObserver.observe(loadMoreRef.value)
  scheduleLayout()
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
  if (infiniteObserver) infiniteObserver.disconnect()
  if (layoutRaf) cancelAnimationFrame(layoutRaf)
  if (loadMoreCheckRaf) cancelAnimationFrame(loadMoreCheckRaf)
  cancelLongPress()
})

const loadUsers = async () => {
  try {
    const data = await api.get('/api/admin/users', { all: true })
    users.value = data.users || []
  } catch {}
}

const loadSourceCounts = async () => {
  const readTotal = async (params) => {
    try {
      const data = await api.get('/api/internal/images', { page: 1, limit: 1, ...params })
      return data.total || 0
    } catch {
      return '-'
    }
  }
  sourceCounts.public = await readTotal({ public: 'true' })
  if (isLoggedIn.value) sourceCounts.mine = await readTotal({ mine: 'true' })
  if (isAdmin.value) sourceCounts.user = await readTotal({})
}

const loadTagGroups = async () => {
  try {
    const data = await api.get('/api/tag-groups')
    tagGroups.value = buildSidebarTagGroups(data.groups || [])
  } catch {
    tagGroups.value = buildSidebarTagGroups([])
  }
}

const buildSidebarTagGroups = (groups = []) => {
  const normalizedGroups = groups.map(group => ({
      ...group,
      _expanded: false,
      subgroups: (group.subgroups || []).map(sg => ({ ...sg, _expanded: false }))
  }))
  const groupedKeys = new Set()
  for (const group of normalizedGroups) {
    for (const id of group.tagIds || []) groupedKeys.add(mutualIdKey(id))
    for (const sg of group.subgroups || []) {
      for (const id of sg.tagIds || []) groupedKeys.add(mutualIdKey(id))
    }
  }
  const ungroupedIds = allTags.value
    .filter(tag => !groupedKeys.has(mutualIdKey(tag.id)))
    .map(tag => tag.id)
  if (ungroupedIds.length > 0) {
    normalizedGroups.push({
      id: '__ungrouped__',
      name: '未分组',
      tagIds: ungroupedIds,
      subgroups: [],
      _expanded: false,
      isVirtual: true
    })
  }
  return normalizedGroups
}

const loadAlbums = async () => {
  try {
    const data = await api.get('/api/albums')
    albums.value = data.albums || []
  } catch {}
}

const loadDisplayConfig = async () => {
  try {
    const data = await api.get('/api/gallery/config')
    setDisplayMode(data.display?.mode === 'waterfall' ? 'waterfall' : 'grid')
  } catch {
    setDisplayMode(displayMode.value === 'waterfall' ? 'waterfall' : 'grid')
  }
}

const loadGallery = () => {
  selectedIds.value = []
  page.value = 1
  const params = {
    tags: selectedTagIds.value.length > 0 ? selectedTagIds.value.join(',') : undefined,
    page: 1,
    limit: pageSize
  }
  if (gallerySource.value === 'mine') {
    params.mine = 'true'
  } else if (gallerySource.value === 'user') {
    if (selectedUserId.value) params.userId = selectedUserId.value
  } else {
    params.public = 'true'
  }
  return fetchImages(params)
    .then(() => {
      sourceCounts[gallerySource.value] = total.value || 0
    })
    .then(() => nextTick())
    .then(() => scheduleLayout())
}

const loadMore = async () => {
  if (loading.value || !hasMore.value) return
  const params = {
    page: page.value + 1,
    limit: pageSize,
    append: true,
    tags: selectedTagIds.value.length > 0 ? selectedTagIds.value.join(',') : undefined
  }
  if (gallerySource.value === 'mine') params.mine = 'true'
  else if (gallerySource.value === 'user') { if (selectedUserId.value) params.userId = selectedUserId.value }
  else params.public = 'true'
  await fetchImages(params)
  await nextTick()
  scheduleLayout()
}

const checkLoadMoreInView = () => {
  if (!import.meta.client || loading.value || !hasMore.value || !loadMoreRef.value) return
  const rect = loadMoreRef.value.getBoundingClientRect()
  if (rect.top <= window.innerHeight + 560 && rect.bottom >= -560) loadMore()
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

const handleModeChange = async (mode) => {
  setDisplayMode(mode === 'waterfall' ? 'waterfall' : 'grid')
  await nextTick()
  scheduleLayout()
}

const toggleFilterSection = (key) => {
  openSections[key] = !openSections[key]
}

const toggleExpandAll = () => {
  allGroupsExpanded.value = !allGroupsExpanded.value
  for (const group of tagGroups.value) {
    group._expanded = allGroupsExpanded.value
    for (const sg of group.subgroups || []) sg._expanded = allGroupsExpanded.value
  }
}

const tagKey = (tag) => (tag.source || 'tag') + '-' + (tag.id || tag.name)
const mutualIdKey = (id) => /^u\d+$/i.test(String(id)) ? `u${parseInt(String(id).slice(1))}` : String(id)
const parseMutualIds = (value) => {
  if (!value) return []
  return String(value)
    .split(/[,，.。\s]+/)
    .map(id => id.trim())
    .filter(Boolean)
    .map(id => /^u\d+$/i.test(id) ? `u${parseInt(id.slice(1))}` : (/^\d+$/.test(id) ? Number(id) : null))
    .filter(id => id !== null)
}
const selectedTagKeys = computed(() => new Set(selectedTagIds.value.map(mutualIdKey)))
const isSelectedTag = (id) => selectedTagIds.value.some(selected => mutualIdKey(selected) === mutualIdKey(id))
const getFilteredTagIds = (ids = []) => ids.filter(id => allTags.value.some(tag => mutualIdKey(tag.id) === mutualIdKey(id)))
const getTagsByIds = (ids = []) => getFilteredTagIds(ids).map(id => allTags.value.find(tag => mutualIdKey(tag.id) === mutualIdKey(id))).filter(Boolean)
const getSubgroupTagIdSet = (group) => new Set((group.subgroups || []).flatMap(sg => sg.tagIds || []).map(mutualIdKey))
const getDirectTags = (group) => {
  const subgroupKeys = getSubgroupTagIdSet(group)
  return getTagsByIds(group.tagIds || []).filter(tag => !subgroupKeys.has(mutualIdKey(tag.id)))
}
const getGroupAllTagIds = (group) => {
  const ids = [...(group.tagIds || [])]
  for (const sg of group.subgroups || []) ids.push(...(sg.tagIds || []))
  return getFilteredTagIds([...new Set(ids)])
}
const isTagDisabled = (tag) => {
  return !isSelectedTag(tag.id) && parseMutualIds(tag.mutually_exclusive_with).some(id => selectedTagKeys.value.has(mutualIdKey(id)))
}
const addSelectableTag = (ids, keys, id) => {
  const tag = allTags.value.find(t => mutualIdKey(t.id) === mutualIdKey(id))
  if (!tag || ids.some(existing => mutualIdKey(existing) === mutualIdKey(id))) return
  if (parseMutualIds(tag.mutually_exclusive_with).some(mid => keys.has(mutualIdKey(mid)))) return
  ids.push(tag.id)
  keys.add(mutualIdKey(tag.id))
}
const toggleTag = (tag) => {
  if (isTagDisabled(tag)) return
  const next = [...selectedTagIds.value]
  const idx = next.findIndex(id => mutualIdKey(id) === mutualIdKey(tag.id))
  if (idx >= 0) next.splice(idx, 1)
  else next.push(tag.id)
  handleTagSelection(next)
}
const isGroupSelected = (group) => {
  const ids = getGroupAllTagIds(group)
  return ids.length > 0 && ids.every(isSelectedTag)
}
const toggleGroup = (group) => {
  const ids = getGroupAllTagIds(group)
  if (isGroupSelected(group)) {
    handleTagSelection(selectedTagIds.value.filter(id => !ids.some(gid => mutualIdKey(gid) === mutualIdKey(id))))
  } else {
    const next = [...selectedTagIds.value]
    const keys = new Set(next.map(mutualIdKey))
    for (const id of ids) addSelectableTag(next, keys, id)
    handleTagSelection(next)
  }
}
const isSubgroupSelected = (sg) => {
  const ids = getFilteredTagIds(sg.tagIds || [])
  return ids.length > 0 && ids.every(isSelectedTag)
}
const toggleSubgroup = (sg) => {
  const ids = getFilteredTagIds(sg.tagIds || [])
  if (isSubgroupSelected(sg)) {
    handleTagSelection(selectedTagIds.value.filter(id => !ids.some(sid => mutualIdKey(sid) === mutualIdKey(id))))
  } else {
    const next = [...selectedTagIds.value]
    const keys = new Set(next.map(mutualIdKey))
    for (const id of ids) addSelectableTag(next, keys, id)
    handleTagSelection(next)
  }
}
const clearTags = () => {
  handleTagSelection([])
}


const getImageAspect = (img) => {
  const width = Number(img.width) || 1
  const height = Number(img.height) || 1
  return width > 0 && height > 0 ? width / height : 1
}

const getDisplayAspect = (img) => {
  const aspect = getImageAspect(img)
  if (displayMode.value === 'waterfall') return aspect
  return aspect < 1 ? aspect : 1
}

const calculateWaterfallLayout = () => {
  const container = galleryListRef.value
  const width = container?.clientWidth || 0
  if (!width || images.value.length === 0) {
    waterfallItems.value = []
    waterfallHeight.value = 0
    return
  }

  const minColumnWidth = displayMode.value === 'waterfall' ? minWaterfallColumnWidth : minGridColumnWidth
  let columns = Math.floor((width + gridGap) / (minColumnWidth + gridGap))
  columns = Math.max(width <= 560 ? 2 : 1, columns)

  const columnWidth = (width - (columns - 1) * gridGap) / columns
  const heights = new Array(columns).fill(0)
  const nextItems = images.value.map((img) => {
    const aspect = Math.max(getDisplayAspect(img), 0.25)
    const itemHeight = columnWidth / aspect
    const top = Math.min(...heights)
    const columnIndex = heights.indexOf(top)
    const left = columnIndex * (columnWidth + gridGap)
    heights[columnIndex] = top + itemHeight + gridGap
    return { left, top, width: columnWidth, height: itemHeight }
  })

  waterfallItems.value = nextItems
  waterfallHeight.value = Math.max(0, ...heights)
}

const scheduleLayout = () => {
  if (layoutRaf) cancelAnimationFrame(layoutRaf)
  layoutRaf = requestAnimationFrame(() => {
    layoutRaf = 0
    calculateWaterfallLayout()
    if (loadMoreCheckRaf) cancelAnimationFrame(loadMoreCheckRaf)
    loadMoreCheckRaf = requestAnimationFrame(() => {
      loadMoreCheckRaf = 0
      checkLoadMoreInView()
    })
  })
}

const getItemStyle = (img, index) => {
  const item = waterfallItems.value[index]
  if (!item) {
    return {
      opacity: 0,
      visibility: 'hidden',
      pointerEvents: 'none',
      transform: 'translate3d(0,0,0)'
    }
  }
  return {
    position: 'absolute',
    width: item.width + 'px', height: item.height + 'px',
    opacity: 1,
    visibility: 'visible',
    transform: 'translate3d(' + item.left + 'px,' + item.top + 'px,0)'
  }
}

watch(images, async () => { await nextTick(); scheduleLayout() }, { deep: true })
watch(displayMode, async () => { await nextTick(); scheduleLayout() })


// 点击图片：如果已有选中则切换选中状态，否则跳转详情
const handleItemClick = (image) => {
  if (longPressTriggered) {
    longPressTriggered = false
    return
  }
  if (gallerySource.value !== 'mine') {
    navigateTo({ path: '/image', query: { id: image.id } })
    return
  }
  if (selectedIds.value.length > 0) {
    toggleSelect(image.id)
  } else {
    navigateTo({ path: '/image', query: { id: image.id } })
  }
}

const startLongPress = (image) => {
  if (gallerySource.value !== 'mine') return
  cancelLongPress()
  longPressTriggered = false
  longPressTimer = setTimeout(() => {
    longPressTriggered = true
    if (!selectedIds.value.includes(image.id)) selectedIds.value.push(image.id)
  }, 420)
}

const cancelLongPress = () => {
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = null
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
  deleteDialog.show = true
  deleteDialog.payload = [...selectedIds.value]
  deleteDialog.message = `删除选中的 ${selectedIds.value.length} 张图片？`
  deleteDialog.effects = ['图片记录会被移除', '相关图片标签会同步清理']
}

const closeDeleteDialog = () => {
  if (deleteDialog.loading) return
  deleteDialog.show = false
  deleteDialog.payload = []
  deleteDialog.effects = []
}

const confirmBatchDelete = async () => {
  if (deleteDialog.loading) return
  deleteDialog.loading = true
  let success = 0
  try {
    for (const id of deleteDialog.payload) {
      try { await api.del(`/api/admin/images/${id}`); success++ } catch {}
    }
    alert(`已删除 ${success} 张图片`)
    selectedIds.value = []
    await loadGallery()
    deleteDialog.loading = false
    closeDeleteDialog()
  } finally {
    deleteDialog.loading = false
  }
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
.gallery-page {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 22px;
  min-height: calc(100vh - 154px);
}

.gallery-sidebar {
  position: sticky;
  top: 80px;
  align-self: start;
  max-height: calc(100vh - 112px);
  overflow-y: auto;
  padding: 14px 12px;
  border-radius: 16px;
  scrollbar-width: thin;
  scrollbar-color: rgba(124, 133, 156, 0.22) transparent;
  margin: 0px 30px 0px 30px;
}

.filter-section {
  padding: 12px 6px;
  border-bottom: 1px solid rgba(238, 210, 226, 0.58);
}

.filter-section:last-child {
  border-bottom: none;
}

.filter-heading {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 9px;
  border: 0;
  background: transparent;
  color: var(--taotu-text);
  font-size: 16px;
  font-weight: 900;
  cursor: pointer;
  text-align: left;
}

.static-heading {
  cursor: default;
}

.heading-main {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: var(--taotu-text);
  font-size: 16px;
  font-weight: 900;
  cursor: pointer;
}

.heading-caret {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;

  opacity: 0.62;
  transform: rotate(0deg);
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.heading-caret.expanded {
  transform: rotate(180deg);
}

.filter-heading:hover .heading-caret,
.heading-main:hover .heading-caret {
  opacity: 0.88;
}

.filter-heading small {
  color: var(--taotu-text-muted);
  font-weight: 800;
}

.expand-all-btn {
  min-height: 27px;
  padding: 3px 10px;
  border: 1px solid var(--taotu-border);
  border-radius: 10px;
  background: rgba(255,255,255,0.72);
  color: var(--taotu-text-muted);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.filter-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.source-row {
  width: 100%;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--taotu-text);
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
}

.source-row.active {
  background: linear-gradient(160deg, rgb(255, 143, 163), rgb(245, 109, 134));
  color: #ffffff;
  border-color: rgba(248,95,154,0.12);
}

.source-row:hover:not(.active) {
  color: #000000;
}

.source-row:hover:not(.active) b {
  color: #000000;
}

.source-row b {
  color: var(--taotu-text-muted);
  font-size: 12px;
}

.compact {
  min-height: 34px;
  margin-top: 6px;
}

.mode-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.mode-card {
  min-height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--taotu-border);
  border-radius: 10px;
  background: rgba(255,255,255,0.64);
  color: var(--taotu-text);
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
}

.mode-card .taotu-svg-icon {
  width: 24px;
  height: 24px;
}

.mode-card.active {
  border-color: rgba(248, 95, 154, 0.46);
  background: rgba(255, 240, 246, 0.86);
  color: var(--taotu-pink);
}

.mode-card:hover:not(.active) {
  color: #000000;
}

.tag-tree {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tree-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.tree-title-row,
.tree-subtitle-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tree-title,
.tree-subtitle {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  border: 0;
  background: transparent;
  color: var(--taotu-text);
  font-weight: 900;
  cursor: pointer;
  text-align: left;
}

.tree-title {
  font-size: 14px;
}

.tree-subtitle {
  font-size: 13px;
  color: var(--taotu-text-muted);
}

.tree-title b,
.tree-subtitle b {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(240, 243, 249, 0.82);
  color: #a1a9ba;
  font-size: 12px;
}

.tree-title.selected,
.tree-subtitle.selected {
  color: var(--taotu-pink);
}

.tree-title:hover,
.tree-subtitle:hover,
.tree-title:hover b,
.tree-subtitle:hover b {
  color: #000000;
}

.tree-caret {
  width: 26px;
  height: 26px;
  flex: 0 0 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  padding: 0;
}

.tree-caret:hover {
  background: rgba(255,240,246,0.72);
}

.tree-caret.small {
  width: 24px;
  height: 24px;
  flex-basis: 24px;
}

.tree-caret-icon {
  width: 14px;
  height: 14px;

  opacity: 0.58;
  transform: rotate(0deg);
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.tree-caret-icon.expanded {
  transform: rotate(180deg);
}

.tree-caret:hover .tree-caret-icon {
  opacity: 0.9;
}

.tree-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tree-subgroup {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tag-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.direct-list {
  margin-bottom: 2px;
}

.tree-tag {
  min-height: 26px;
  max-width: 108px;
  padding: 4px 11px;
  border: 1px solid rgba(225, 230, 239, 0.86);
  border-radius: 12px;
  background: rgba(247, 249, 252, 0.82);
  color: var(--taotu-text-muted);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-tag.selected {
  border-color: rgba(248, 95, 154, 0.32);
  background: var(--taotu-pink-soft);
  color: var(--taotu-pink);
}

.tree-tag:hover:not(.disabled) {
  color: #000000;
}

.tree-tag.disabled {
  opacity: 0.42;
  cursor: not-allowed;
  text-decoration: line-through;
}

.clear-tags-btn {
  min-height: 32px;
  border: 1px solid rgba(248, 95, 154, 0.22);
  border-radius: 10px;
  background: var(--taotu-pink-soft);
  color: var(--taotu-pink);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.muted-hint {
  color: var(--taotu-text-muted);
  font-size: 12px;
}

.gallery-main {
  min-width: 0;
}

.gallery-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  min-height: 48px;
  margin-bottom: 14px;
  padding: 10px 14px;
  border: 1px solid rgba(255,255,255,0.62);
  border-radius: 12px;
  background: rgba(255,255,255,0.72);
  box-shadow: 0 10px 30px rgba(60, 68, 96, 0.12);
  backdrop-filter: blur(16px) saturate(1.16);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.selected-note {
  color: var(--taotu-pink);
  font-weight: 900;
}

.toolbar-right {
  color: var(--taotu-text-muted);
  font-size: 13px;
  font-weight: 800;
}

.gallery-with-select {
  position: relative;
  width: 100%;
  min-height: 240px;
}

.gallery-with-select.mode-grid,
.gallery-with-select.mode-waterfall {
  display: block;
}

.gallery-item-wrapper {
  position: absolute;
  left: 0;
  top: 0;
  min-width: 0;
  touch-action: manipulation;
  contain: layout paint style;
  content-visibility: auto;
  contain-intrinsic-size: 190px 190px;
}

.gallery-item-wrapper.selected {
  z-index: 4;
}

.gallery-item-wrapper.selected :deep(.image-card) {
  border-color: rgba(248,95,154,0.86);
  box-shadow: 0 0 0 2px rgba(248,95,154,0.46), 0 16px 40px rgba(248,95,154,0.18);
}

.select-checkbox {
  position: absolute;
  top: 7px;
  left: 7px;
  z-index: 10;
  cursor: pointer;
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.gallery-item-wrapper:hover .select-checkbox,
.gallery-with-select.has-selection .select-checkbox,
.gallery-item-wrapper.selected .select-checkbox {
  opacity: 1;
}

.native-check {
  width: 12px;
  height: 12px;
  display: block;
  border: 2px solid rgba(255,255,255,0.9);
  border-radius: 4px;
  background: rgba(255,255,255,0.38);
  box-shadow: 0 1px 5px rgba(0,0,0,0.22);
}

.native-check.checked {
  border-color: rgba(255,255,255,0.96);
  background: var(--taotu-pink);
  box-shadow: 0 0 0 2px rgba(248,95,154,0.22), 0 2px 8px rgba(0,0,0,0.18);
}

.native-check.checked::after {
  content: '';
  display: block;
  width: 5px;
  height: 8px;
  margin: -1px auto 0;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.empty-state {
  min-height: 260px;
  display: grid;
  place-items: center;
  gap: 10px;
  text-align: center;
  padding: var(--space-2xl);
  color: var(--taotu-text-muted);
}

.load-more-sentinel {
  width: 100%;
  height: 1px;
  min-height: 1px;
  padding: 0;
  overflow: hidden;
  pointer-events: none;
}

.modal {
  width: 420px;
}

.modal h3 {
  font-size: 18px;
  font-weight: 900;
  margin-bottom: var(--space-sm);
}

.modal-desc {
  font-size: 14px;
  color: var(--taotu-text-muted);
  margin-bottom: var(--space-lg);
}

.form-group {
  margin-bottom: var(--space-lg);
}

.form-group label {
  display: block;
  color: var(--taotu-text-muted);
  font-size: 13px;
  font-weight: 800;
  margin-bottom: var(--space-sm);
}

@media (max-width: 900px) {
  .gallery-page {
    grid-template-columns: 1fr;
  }

  .gallery-sidebar {
    position: static;
    max-height: none;
  }
}
</style>
