<template>
  <div class="admin-config-page">
    <section class="config-main-card">
      <div class="path-header">
        <div>
          <h1>路径配置</h1>
          <p>管理图库数据源路径，支持本地目录和外部存储路径</p>
        </div>
        <div v-if="scanToast.show" class="scan-toast" :class="{ error: scanToast.error, warning: scanToast.warning }">
          <TaotuIcon :name="scanToast.error ? 'status-error-placeholder' : (scanToast.warning ? 'warning' : 'status-ok-placeholder')" />
          <div>
            <strong>{{ scanToast.title }}</strong>
            <span>{{ scanToast.message }}</span>
          </div>
          <button type="button" @click="scanToast.show = false">×</button>
        </div>
      </div>

      <div class="path-toolbar">
        <button type="button" class="primary-action" @click="openAddPath">
          <TaotuIcon name="add" />添加路径
        </button>
        <button type="button" class="plain-action" @click="savePaths">
          <TaotuIcon name="save" />保存配置
        </button>
        <button type="button" class="scan-action" :disabled="scanning" @click="scanAll">
          <TaotuIcon name="refresh" />{{ scanning ? '扫描中...' : '扫描所有路径' }}
        </button>
      </div>

      <div class="path-table default-table">
        <div class="path-head">
          <span>路径</span><span>类型</span><span>递归</span><span>绑定相册</span><span>绑定标签</span><span>上次扫描</span><span>状态</span><span>操作</span>
        </div>
        <div class="path-row">
          <div class="path-cell-main">
            <strong>data/gallery/ <em>（默认）</em></strong>
            <small>系统默认路径，不可删除</small>
          </div>
          <span><i class="type-pill type-default">默认本地</i></span>
          <span class="bool-cell"><BoolStatusIcon :value="true" /></span>
          <span>公共图库</span>
          <span>无</span>
          <span>{{ formatDateTime(defaultPath.last_scanned_at) }}</span>
          <span><i class="status-pill" :class="defaultPath.status === 'warning' ? 'warn' : 'ok'">{{ defaultPath.statusText || '正常' }}</i></span>
          <span class="default-action">-</span>
        </div>
      </div>

      <h2 class="subsection-title">自定义路径</h2>
      <div class="path-table custom-table">
        <div v-if="customPaths.length" class="path-body">
          <div v-for="(pathItem, index) in customPaths" :key="`${pathItem.path}-${index}`" class="path-row">
            <div class="path-cell-main single">
              <strong>{{ pathItem.path }}</strong>
            </div>
            <span><i class="type-pill" :class="`type-${pathType(pathItem)}`">{{ pathTypeLabel(pathItem) }}</i></span>
            <span class="bool-cell"><BoolStatusIcon :value="pathItem.recursive !== false" /></span>
            <span>{{ albumLabel(pathItem) }}</span>
            <span class="tag-summary">
              <i v-for="tag in getPathTagNames(pathItem).slice(0, 2)" :key="tag"># {{ tag }}</i>
              <em v-if="getPathTagNames(pathItem).length > 2">...</em>
              <b v-if="!getPathTagNames(pathItem).length">无</b>
            </span>
            <span>{{ formatDateTime(pathItem.last_scanned_at) }}</span>
            <span><i class="status-pill" :class="pathItem.status === 'warning' ? 'warn' : 'ok'">{{ pathItem.statusText || (pathItem.status === 'warning' ? '警告' : '正常') }}</i></span>
            <span class="row-actions">
              <button type="button" class="scan-row-btn" :disabled="scanning" @click="scanPath(pathItem)">
                <TaotuIcon name="scan" />扫描
              </button>
              <button type="button" class="edit-row-btn" :disabled="scanning" @click="openEditPath(index)">
                <TaotuIcon name="edit" />编辑
              </button>
              <button type="button" class="delete-row-btn" @click="removePath(index)">
                <TaotuIcon name="trash" />删除
              </button>
            </span>
          </div>
        </div>
        <div v-else class="empty-custom-paths">暂无自定义路径，点击“添加路径”创建新的图库来源。</div>
      </div>

      <p class="path-hint">提示：修改配置后请点击「保存配置」以持久化设置。系统将按顺序扫描所有启用路径。</p>

      <section v-if="showAdd" class="add-path-panel">
        <div class="add-title-row">
          <h2><TaotuIcon :name="isEditingPath ? 'edit' : 'add'" />{{ isEditingPath ? '编辑路径' : '添加路径' }}</h2>
          <button type="button" @click="closePathPanel">×</button>
        </div>

        <div class="add-grid">
          <div class="add-inner-card">
            <label class="field-line">
              <span>路径 *</span>
              <input v-model="newPath.path" :disabled="isEditingPath" placeholder="例如：/mnt/storage/illustration/ 或 smb://nas.local/桃图资源/" />
              <small v-if="isEditingPath">已扫描路径不能直接变更；如需换路径，请删除后重新添加。</small>
            </label>

            <div class="switch-row">
              <div>
                <strong>递归扫描</strong>
                <small>扫描子目录中的所有图片</small>
              </div>
              <label class="pink-switch">
                <input v-model="newPath.recursive" type="checkbox" />
                <i></i>
              </label>
            </div>

            <div class="album-mode-row">
              <strong>添加到相册</strong>
              <label><input v-model="newPath.albumMode" type="radio" value="none" />无</label>
              <label><input v-model="newPath.albumMode" type="radio" value="existing" />已有相册</label>
              <label><input v-model="newPath.albumMode" type="radio" value="new" />新建相册</label>
            </div>

            <TaotuSelect v-if="newPath.albumMode === 'existing'" v-model="newPath.albumId" class="soft-select" :options="albumSelectOptions" />
            <input v-if="newPath.albumMode === 'new'" v-model="newPath.albumName" class="soft-input" placeholder="请输入新相册名称" />

            <div class="switch-row">
              <div>
                <strong>批量打标签</strong>
                <small>为扫描到的图片批量打标签</small>
              </div>
              <label class="pink-switch muted-switch">
                <input v-model="newPath.enableTags" type="checkbox" />
                <i></i>
              </label>
            </div>

            <div class="switch-row">
              <div>
                <strong>批量公开</strong>
                <small>为扫描到的图片批量设为公开图片</small>
              </div>
              <label class="pink-switch muted-switch">
                <input v-model="newPath.makePublic" type="checkbox" />
                <i></i>
              </label>
            </div>

            <div class="switch-row danger-setting">
              <div>
                <strong><TaotuIcon name="warning" />管理图片删减</strong>
                <small>为扫描到的图片批量管理，开启后删除图片会同步删除该路径原始文件。</small>
              </div>
              <label class="pink-switch muted-switch">
                <input v-model="newPath.allowDelete" type="checkbox" />
                <i></i>
              </label>
            </div>
          </div>

          <div class="add-inner-card tags-card">
            <label class="field-line">
              <span>标签分组</span>
              <TaotuSelect v-model="selectedGroupId" :options="tagGroupSelectOptions" />
            </label>

            <div class="existing-tag-picker">
              <span>已有标签</span>
              <div>
                <button
                  v-for="tag in selectableGroupTags"
                  :key="tag.id"
                  type="button"
                  :class="{ selected: isPathTagSelected(tag.id) }"
                  @click="togglePathTag(tag.id)"
                >
                  {{ tag.display_name || tag.name }}
                </button>
                <em v-if="!selectedGroupId">请选择标签分组后选择已有标签</em>
                <em v-else-if="!selectableGroupTags.length">该分组暂无可用标签</em>
              </div>
            </div>

            <label class="field-line">
              <span>新建标签名</span>
              <input v-model="newPath.newTagName" :disabled="!newPath.enableTags" placeholder="输入后按回车创建新标签" @keyup.enter="addNewTagToPath" />
            </label>

            <div class="new-tag-preview">
              <span>新标签预览</span>
              <div>
                <button v-for="tag in selectedPreviewTags" :key="tag" type="button" @click="removePreviewTag(tag)">
                  {{ tag }} ×
                </button>
                <em v-if="!selectedPreviewTags.length">按回车添加标签</em>
              </div>
            </div>
          </div>
        </div>

        <div class="add-footer">
          <button type="button" class="cancel-add" @click="closePathPanel">取消</button>
          <button type="button" class="confirm-add" @click="savePathPanel">{{ isEditingPath ? '保存编辑' : '添加' }}</button>
        </div>
      </section>
    </section>

    <aside class="config-side">
      <section class="side-card database-card">
        <h2><TaotuIcon name="database" />数据库状态（只读）</h2>
        <div class="db-info-panel">
          <div><span>数据库类型</span><b>{{ dbStatus.type || '-' }}</b></div>
          <div><span>版本</span><b>{{ compactVersion(dbStatus.version) }}</b></div>
          <div><span>总图片数</span><b>{{ formatNumber(dbStatus.stats?.totalImages) }}</b></div>
          <div><span>相册数</span><b>{{ formatNumber(dbStatus.stats?.totalAlbums) }}</b></div>
          <div><span>标签数</span><b>{{ formatNumber(dbStatus.stats?.totalTags) }}</b></div>
          <div><span>用户数</span><b>{{ formatNumber(dbStatus.stats?.totalUsers) }}</b></div>
          <p>只读模式：数据库 {{ dbStatus.database || dbStatus.path || '-' }}</p>
        </div>
      </section>

      <section class="side-card display-card">
        <h2><TaotuIcon name="gallery-settings" />图库默认展示模式</h2>
        <p>设置图库页面的默认展示样式</p>
        <div class="display-choice-row">
          <button type="button" :class="{ active: displayMode === 'grid' }" @click="setDisplayMode('grid')">
            <TaotuIcon name="grid" /><span>网格</span>
          </button>
          <button type="button" :class="{ active: displayMode === 'waterfall' }" @click="setDisplayMode('waterfall')">
            <TaotuIcon name="waterfall" /><span>瀑布流</span>
          </button>
        </div>
      </section>

      <section class="side-card token-card">
        <h2><TaotuIcon name="api-settings" />API Token 管理</h2>
        <p>用于第三方应用访问你的图库数据</p>
        <div v-if="pagedTokens.length" class="token-list-mini">
        <div v-for="token in pagedTokens" :key="token.id" class="token-mini-card">
          <div>
            <strong>{{ token.label || '默认 Token' }}</strong>
            <span>创建于 {{ formatDate(token.created_at) }}</span>
            <code>{{ tokenVisible[token.id] ? token.token : maskToken(token.token) }}</code>
          </div>
          <button type="button" @click="toggleToken(token.id)">
            <TaotuIcon :name="tokenVisible[token.id] ? 'eye-off' : 'eye'" />
          </button>
          <button type="button" @click="toggleTokenMenu(token.id)">
            <TaotuIcon name="more-actions-placeholder" />
          </button>
          <div v-if="tokenMenuOpen === token.id" class="token-action-menu">
            <button type="button" @click="copyToken(token.token)">复制 Token</button>
            <button type="button" class="danger" @click="requestDeleteToken(token)">删除 Token</button>
          </div>
        </div>
        </div>
        <div v-else class="token-empty">暂无 Token</div>
        <div v-if="tokenTotalPages > 1" class="token-pagination">
          <button type="button" :disabled="tokenPage <= 1" @click="tokenPage--">‹</button>
          <button
            v-for="item in tokenPaginationItems"
            :key="item.key"
            type="button"
            :class="{ active: item.page === tokenPage, ellipsis: item.ellipsis }"
            :disabled="item.ellipsis"
            @click="!item.ellipsis && (tokenPage = item.page)"
          >{{ item.label }}</button>
          <button type="button" :disabled="tokenPage >= tokenTotalPages" @click="tokenPage++">›</button>
        </div>
        <div v-if="newToken" class="new-token-inline">
          <button type="button" @click="newToken = ''">×</button>
          <span>新 Token 仅显示一次</span>
          <code>{{ newToken }}</code>
        </div>
        <button type="button" class="generate-token-btn" @click="createToken">＋ 生成新 Token</button>
        <NuxtLink to="/api-docs" class="api-doc-link">查看使用文档 →</NuxtLink>
      </section>
    </aside>

    <ConfirmDeleteDialog
      :show="deleteDialog.show"
      :title="deleteDialog.title"
      :message="deleteDialog.message"
      :description="deleteDialog.description"
      :effects="deleteDialog.effects"
      :loading="deleteDialog.loading"
      @cancel="closeDeleteDialog"
      @confirm="confirmDeleteDialog"
    />
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const customPaths = ref([])
const defaultPath = ref({ status: 'normal', statusText: '正常', last_scanned_at: null })
const albums = ref([])
const allTags = ref([])
const rawTagGroups = ref([])
const tokens = ref([])
const newToken = ref('')
const tokenVisible = reactive({})
const dbStatus = ref({ stats: {} })
const displayMode = ref('grid')
const uploadConfig = ref({ showUrlAfterUpload: true })
const showAdd = ref(false)
const editingPathIndex = ref(-1)
const scanning = ref(false)
const selectedGroupId = ref('')
const tokenMenuOpen = ref(null)
const tokenPage = ref(1)
const tokenPageSize = 3
const scanToast = reactive({ show: false, error: false, warning: false, title: '', message: '' })
const deleteDialog = reactive({
  show: false,
  type: '',
  target: null,
  title: '确认删除',
  message: '',
  description: '此操作不可恢复，请谨慎操作。',
  effects: [],
  loading: false
})

const newPath = reactive({
  path: '',
  recursive: true,
  albumMode: 'existing',
  albumId: null,
  albumName: '',
  makePublic: false,
  allowDelete: false,
  enableTags: false,
  tagIds: [],
  newTagName: '',
  newTagNames: []
})

const isEditingPath = computed(() => editingPathIndex.value >= 0)

const selectedPreviewTags = computed(() => {
  const existing = allTags.value
    .filter(tag => (newPath.tagIds || []).includes(tag.id))
    .map(tag => tag.display_name || tag.name)
  return [...existing, ...(newPath.newTagNames || [])]
})

const tokenTotalPages = computed(() => Math.max(1, Math.ceil(tokens.value.length / tokenPageSize)))
const pagedTokens = computed(() => tokens.value.slice((tokenPage.value - 1) * tokenPageSize, tokenPage.value * tokenPageSize))
const tokenPaginationItems = computed(() => {
  const total = tokenTotalPages.value
  const current = tokenPage.value
  const pages = new Set([1, current - 1, current, current + 1, total].filter(page => page >= 1 && page <= total))
  const sorted = [...pages].sort((a, b) => a - b)
  const result = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push({ key: `ellipsis-${page}`, label: '...', ellipsis: true })
    result.push({ key: page, label: String(page), page })
  })
  return result
})

const tagGroups = computed(() => buildPathTagGroups(rawTagGroups.value))
const albumSelectOptions = computed(() => [
  { label: '请选择已有相册', value: null },
  ...albums.value.map(album => ({ label: album.name, value: album.id, description: `${album.image_count || album.imageCount || 0} 张图片` }))
])
const tagGroupSelectOptions = computed(() => [
  { label: '请选择标签分组', value: '' },
  ...tagGroups.value.map(group => ({ label: group.name, value: group.id, description: `包含 ${getGroupAllTagIds(group).length} 个标签` }))
])

const selectableGroupTags = computed(() => {
  const group = tagGroups.value.find(item => String(item.id) === String(selectedGroupId.value))
  if (!group) return []

  const tagMap = new Map(allTags.value.map(tag => [mutualIdKey(tag.id), tag]))
  const seen = new Set()
  return getGroupAllTagIds(group)
    .filter(isSupportedPathTagId)
    .map(id => tagMap.get(mutualIdKey(id)))
    .filter(Boolean)
    .filter(tag => {
      const key = mutualIdKey(tag.id)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
})

watch(selectedGroupId, (groupId) => {
  if (groupId) newPath.enableTags = true
})

onMounted(async () => {
  await Promise.all([loadConfig(), loadAlbums(), loadTags(), loadTagGroups(), loadTokens(), loadDatabaseStatus()])
})

async function loadConfig() {
  const data = await api.get('/api/admin/gallery/config')
  defaultPath.value = data.defaultPath || defaultPath.value
  customPaths.value = data.customPaths || []
  displayMode.value = data.display?.mode === 'waterfall' ? 'waterfall' : 'grid'
  uploadConfig.value = data.upload || { showUrlAfterUpload: true }
}

async function loadAlbums() {
  const data = await api.get('/api/admin/albums', { limit: 200 })
  albums.value = data.albums || []
}

async function loadTags() {
  const data = await api.get('/api/admin/tags')
  allTags.value = [...(data.combinable || []), ...(data.nonCombinable || [])].filter(tag => !String(tag.id).startsWith('__'))
}

async function loadTagGroups() {
  const data = await api.get('/api/admin/tag-groups')
  rawTagGroups.value = (data.groups || []).filter(group => !group.system)
}

async function loadTokens() {
  const data = await api.get('/api/admin/api/tokens')
  tokens.value = (data.tokens || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  if (tokenPage.value > tokenTotalPages.value) tokenPage.value = tokenTotalPages.value
}

async function loadDatabaseStatus() {
  dbStatus.value = await api.get('/api/admin/database/status')
}

function resetNewPath() {
  newPath.path = ''
  newPath.recursive = true
  newPath.albumMode = 'existing'
  newPath.albumId = null
  newPath.albumName = ''
  newPath.makePublic = false
  newPath.allowDelete = false
  newPath.enableTags = false
  newPath.tagIds = []
  newPath.newTagName = ''
  newPath.newTagNames = []
  selectedGroupId.value = ''
}

function openAddPath() {
  editingPathIndex.value = -1
  resetNewPath()
  showAdd.value = true
}

function closePathPanel() {
  showAdd.value = false
  editingPathIndex.value = -1
  resetNewPath()
}

function openEditPath(index) {
  const pathItem = customPaths.value[index]
  editingPathIndex.value = index
  newPath.path = pathItem.path || ''
  newPath.recursive = pathItem.recursive !== false
  newPath.albumMode = pathItem.albumMode || (pathItem.albumId ? 'existing' : 'none')
  newPath.albumId = pathItem.albumId || null
  newPath.albumName = pathItem.albumName || ''
  newPath.makePublic = !!pathItem.makePublic
  newPath.allowDelete = !!pathItem.allowDelete
  newPath.enableTags = Boolean((pathItem.tagIds || []).length || (pathItem.newTagNames || []).length)
  newPath.tagIds = [...(pathItem.tagIds || [])]
  newPath.newTagName = ''
  newPath.newTagNames = [...(pathItem.newTagNames || [])]
  selectedGroupId.value = ''
  showAdd.value = true
}

function getPathTagNames(pathItem) {
  const selectedNames = allTags.value
    .filter(tag => (pathItem.tagIds || []).includes(tag.id))
    .map(tag => tag.display_name || tag.name)
  return selectedNames.concat(pathItem.newTagNames || pathItem.tagNames || [])
}

function addNewTagToPath() {
  if (!newPath.enableTags) newPath.enableTags = true
  const name = newPath.newTagName.trim()
  if (!name || newPath.newTagNames.includes(name)) return
  const existing = allTags.value.find(tag => String(tag.name || '').toLowerCase() === name.toLowerCase())
  if (existing) {
    showToast('添加失败', `公共标签名「${name}」已存在，请从已有标签中选择`, true)
    return
  }
  newPath.newTagNames.push(name)
  newPath.newTagName = ''
}

function removePreviewTag(name) {
  newPath.newTagNames = newPath.newTagNames.filter(item => item !== name)
  const tag = allTags.value.find(item => (item.display_name || item.name) === name)
  if (tag) newPath.tagIds = newPath.tagIds.filter(id => id !== tag.id)
}

function isPathTagSelected(tagId) {
  return (newPath.tagIds || []).some(id => mutualIdKey(id) === mutualIdKey(tagId))
}

function togglePathTag(tagId) {
  if (!isSupportedPathTagId(tagId)) return
  newPath.enableTags = true
  const normalizedId = Number(tagId)
  if (isPathTagSelected(normalizedId)) {
    newPath.tagIds = newPath.tagIds.filter(id => mutualIdKey(id) !== mutualIdKey(normalizedId))
  } else {
    newPath.tagIds.push(normalizedId)
  }
}

function buildPathTagGroups(groups = []) {
  const normalizedGroups = groups.map(group => ({
    ...group,
    tagIds: (group.tagIds || []).filter(isSupportedPathTagId).map(Number),
    subgroups: (group.subgroups || []).map(subgroup => ({
      ...subgroup,
      tagIds: (subgroup.tagIds || []).filter(isSupportedPathTagId).map(Number)
    }))
  }))

  const groupedKeys = new Set()
  for (const group of normalizedGroups) {
    for (const id of getGroupAllTagIds(group)) groupedKeys.add(mutualIdKey(id))
  }

  const ungroupedIds = allTags.value
    .filter(tag => isSupportedPathTagId(tag.id))
    .filter(tag => !groupedKeys.has(mutualIdKey(tag.id)))
    .map(tag => Number(tag.id))

  if (ungroupedIds.length > 0) {
    normalizedGroups.push({
      id: '__ungrouped__',
      name: '未分组',
      tagIds: ungroupedIds,
      subgroups: [],
      isVirtual: true
    })
  }

  return normalizedGroups
}

function getGroupAllTagIds(group) {
  const ids = [...(group.tagIds || [])]
  for (const subgroup of group.subgroups || []) ids.push(...(subgroup.tagIds || []))
  return [...new Set(ids.map(id => Number(id)).filter(Number.isInteger))]
}

function isSupportedPathTagId(id) {
  return typeof id === 'number' || /^\d+$/.test(String(id))
}

function mutualIdKey(id) {
  return /^u\d+$/i.test(String(id)) ? `u${parseInt(String(id).slice(1))}` : String(Number(id))
}

function addPath() {
  if (!newPath.path.trim()) {
    showToast('添加失败', '请输入路径后再添加', true)
    return
  }
  if (newPath.albumMode === 'new') {
    const albumName = newPath.albumName.trim()
    if (!albumName) {
      showToast('添加失败', '请输入新相册名称', true)
      return
    }
    const existingAlbum = albums.value.find(album => String(album.name || '').toLowerCase() === albumName.toLowerCase())
    if (existingAlbum) {
      showToast('添加失败', `相册名「${albumName}」已存在，请从已有相册中选择`, true)
      return
    }
  }
  customPaths.value.push({
    path: newPath.path.trim(),
    recursive: newPath.recursive,
    albumMode: newPath.albumMode,
    albumId: newPath.albumMode === 'existing' ? newPath.albumId : null,
    albumName: newPath.albumMode === 'new' ? newPath.albumName.trim() : '',
    makePublic: !!newPath.makePublic,
    allowDelete: !!newPath.allowDelete,
    tagIds: newPath.enableTags ? [...newPath.tagIds] : [],
    newTagNames: newPath.enableTags ? [...newPath.newTagNames] : [],
    status: 'normal',
    statusText: '待保存',
    last_scanned_at: null
  })
  resetNewPath()
  showAdd.value = false
}

async function updatePath() {
  const index = editingPathIndex.value
  if (index < 0) return
  const payload = {
    path: customPaths.value[index].path,
    recursive: newPath.recursive !== false,
    albumMode: newPath.albumMode || 'none',
    albumId: newPath.albumMode === 'existing' ? newPath.albumId : null,
    albumName: newPath.albumMode === 'new' ? newPath.albumName.trim() : '',
    makePublic: !!newPath.makePublic,
    allowDelete: !!newPath.allowDelete,
    tagIds: newPath.enableTags ? [...newPath.tagIds] : [],
    newTagNames: newPath.enableTags ? [...newPath.newTagNames] : []
  }
  const data = await api.post('/api/admin/gallery/update-path', payload)
  showToast('编辑完成', `已更新 ${data.updatedImages || 0} 张已扫描图片`)
  closePathPanel()
  await Promise.all([loadConfig(), loadAlbums(), loadTags(), loadDatabaseStatus()])
}

async function savePathPanel() {
  try {
    if (isEditingPath.value) {
      await updatePath()
    } else {
      addPath()
    }
  } catch (err) {
    showToast(isEditingPath.value ? '编辑失败' : '添加失败', err?.data?.error || err.message || '路径操作失败', true)
  }
}

function removePath(index) {
  const pathItem = customPaths.value[index]
  deleteDialog.show = true
  deleteDialog.type = 'path'
  deleteDialog.target = { index, pathItem }
  deleteDialog.title = '删除路径'
  deleteDialog.message = `确定要删除路径「${pathItem.path}」吗？`
  deleteDialog.description = '此操作会清理该路径扫描入库的图片记录。'
  deleteDialog.effects = [
    '该路径配置将从自定义路径列表移除',
    '该路径下已扫描入库的图片记录将被删除',
    '这些图片已有的标签关联数据会同步清理',
    '原始磁盘图片文件、相册和标签本身不会被删除'
  ]
}

async function savePaths() {
  await api.put('/api/admin/gallery/config', {
    customPaths: customPaths.value.map(pathItem => ({
      path: pathItem.path,
      recursive: pathItem.recursive !== false,
      albumMode: pathItem.albumMode || 'none',
      albumId: pathItem.albumId || null,
      albumName: pathItem.albumName || null,
      makePublic: !!pathItem.makePublic,
      allowDelete: !!pathItem.allowDelete,
      tagIds: pathItem.tagIds || [],
      newTagNames: pathItem.newTagNames || []
    }))
  })
  showToast('保存完成', '路径配置已持久化保存')
  await loadConfig()
}

async function scanPath(pathItem) {
  scanning.value = true
  try {
    const data = await api.post('/api/admin/gallery/scan-path', {
      path: pathItem.path,
      recursive: pathItem.recursive !== false,
      albumId: pathItem.albumId || null,
      albumName: pathItem.albumName || null,
      makePublic: !!pathItem.makePublic,
      allowDelete: !!pathItem.allowDelete,
      tagIds: pathItem.tagIds || [],
      newTags: pathItem.newTagNames || []
    })
    showToast('扫描完成', `成功扫描 1 个路径，新增 ${data.added || 0} 张图片`)
    await Promise.all([loadConfig(), loadDatabaseStatus()])
  } catch (err) {
    showToast('扫描失败', err?.data?.error || err.message || '路径扫描失败', true)
  } finally {
    scanning.value = false
  }
}

async function scanAll() {
  scanning.value = true
  try {
    const data = await api.post('/api/admin/gallery/scan')
    const skippedPaths = Array.isArray(data.errors) ? data.errors.length : 0
    const suffix = skippedPaths ? `，${skippedPaths} 个路径跳过或失败` : ''
    showToast(skippedPaths ? '扫描完成（有警告）' : '扫描完成', `成功扫描 ${data.pathCount || 0} 个路径，新增 ${data.added || 0} 张图片${suffix}`, false, Boolean(skippedPaths))
    await Promise.all([loadConfig(), loadDatabaseStatus()])
  } catch (err) {
    showToast('扫描失败', err?.data?.error || err.message || '扫描所有路径失败', true)
  } finally {
    scanning.value = false
  }
}

async function setDisplayMode(mode) {
  displayMode.value = mode === 'waterfall' ? 'waterfall' : 'grid'
  await api.put('/api/admin/gallery/config', {
    display: { mode: displayMode.value },
    upload: uploadConfig.value
  })
  showToast('保存完成', `图库默认展示模式已切换为${displayMode.value === 'grid' ? '网格' : '瀑布流'}`)
}

async function createToken() {
  const label = tokens.value.length ? `Token ${tokens.value.length + 1}` : '默认 Token'
  const data = await api.post('/api/admin/api/tokens', { label })
  newToken.value = data.token
  await loadTokens()
}

async function copyToken(token) {
  try {
    await navigator.clipboard.writeText(token)
    tokenMenuOpen.value = null
    showToast('复制完成', 'Token 已复制到剪贴板')
  } catch {
    showToast('复制失败', '浏览器阻止了剪贴板访问', true)
  }
}

async function deleteToken(id) {
  await api.del(`/api/admin/api/tokens/${id}`)
  tokenMenuOpen.value = null
  await loadTokens()
  showToast('删除完成', 'Token 已删除')
}

function toggleTokenMenu(id) {
  tokenMenuOpen.value = tokenMenuOpen.value === id ? null : id
}

function requestDeleteToken(token) {
  deleteDialog.show = true
  deleteDialog.type = 'token'
  deleteDialog.target = token
  deleteDialog.title = '删除 Token'
  deleteDialog.message = `确定要删除 Token「${token.label || '默认 Token'}」吗？`
  deleteDialog.description = '删除后使用它的第三方应用将无法继续访问图库数据。'
  deleteDialog.effects = [
    '该 Token 会立即失效',
    '使用该 Token 的接口调用会失败',
    '已复制到外部应用的密钥不会自动同步更新'
  ]
}

function closeDeleteDialog() {
  if (deleteDialog.loading) return
  deleteDialog.show = false
  deleteDialog.type = ''
  deleteDialog.target = null
}

async function confirmDeleteDialog() {
  if (!deleteDialog.show || deleteDialog.loading) return
  deleteDialog.loading = true
  try {
    if (deleteDialog.type === 'token') {
      await deleteToken(deleteDialog.target.id)
    } else if (deleteDialog.type === 'path') {
      const { index, pathItem } = deleteDialog.target
      const data = await api.post('/api/admin/gallery/delete-path', { path: pathItem.path })
      customPaths.value.splice(index, 1)
      showToast('路径已删除', `已清理 ${data.deletedImages || 0} 张图片记录`)
      await Promise.all([loadConfig(), loadDatabaseStatus()])
    }
  } catch (err) {
    showToast('删除失败', err?.data?.error || err.message || '删除操作失败', true)
  } finally {
    deleteDialog.loading = false
    closeDeleteDialog()
  }
}

function toggleToken(id) {
  tokenVisible[id] = !tokenVisible[id]
}

function showToast(title, message, error = false, warning = false) {
  scanToast.title = title
  scanToast.message = message
  scanToast.error = error
  scanToast.warning = warning
  scanToast.show = true
}

function pathType(pathItem) {
  const value = String(pathItem.path || '').toLowerCase()
  if (pathItem.type === 'default') return 'default'
  if (pathItem.type) return pathItem.type
  if (value.startsWith('smb://')) return 'smb'
  if (value.startsWith('s3://')) return 's3'
  if (value.startsWith('ftp://')) return 'ftp'
  return 'local'
}

function pathTypeLabel(pathItem) {
  const labels = { default: '默认本地', local: '本地', smb: 'SMB', s3: 'S3', ftp: 'FTP' }
  return labels[pathType(pathItem)] || '本地'
}

function albumLabel(pathItem) {
  if (pathItem.albumMode === 'new') return pathItem.albumName || '新建相册'
  if (pathItem.albumId) return albums.value.find(album => album.id === pathItem.albumId)?.name || pathItem.albumName || '-'
  return pathItem.albumName || '公共图库'
}

function formatNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('zh-CN')
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

function compactVersion(value) {
  return String(value || '-').replace(/-.+$/, '')
}

function maskToken(value) {
  const token = String(value || '')
  if (!token) return '-'
  if (token.length <= 12) return token
  return `${token.slice(0, 6)}_${'*'.repeat(Math.min(18, token.length - 10))}_${token.slice(-6)}`
}
</script>

<style scoped>
.admin-config-page { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 18px; align-items: start; color: #59677f; }
.admin-config-page::before { content: ''; position: fixed; inset: 64px 0 0 220px; z-index: -1; pointer-events: none; background: linear-gradient(135deg, rgba(255, 248, 252, 0.9), rgba(245, 251, 255, 0.94) 46%, rgba(252, 248, 255, 0.86)); }
.config-main-card, .side-card, .add-inner-card { border: 1px solid rgba(226, 230, 241, 0.76); background: rgba(255,255,255,0.66); box-shadow: 0 18px 42px rgba(84, 94, 120, 0.08); backdrop-filter: blur(22px) saturate(1.08); }
.config-main-card { position: relative; min-height: calc(100vh - 108px); padding: 20px; border-radius: 14px; }
.path-header { display: flex; justify-content: space-between; gap: 18px; min-height: 66px; }
.path-header h1 { margin: 0; color: #29364e; font-size: 24px; line-height: 1.1; font-weight: 900; }
.path-header p { margin: 8px 0 0; color: #8b96aa; font-size: 13px; font-weight: 800; }
.scan-toast { width: 300px; min-height: 58px; display: grid; grid-template-columns: 24px minmax(0, 1fr) 18px; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid rgba(73, 198, 151, 0.28); border-left: 3px solid #42c391; border-radius: 9px; background: rgba(247, 255, 251, 0.88); box-shadow: 0 16px 34px rgba(70, 140, 120, 0.1); }
.scan-toast.error { border-color: rgba(236, 95, 120, 0.28); border-left-color: #ec6b86; background: rgba(255, 246, 249, 0.9); }
.scan-toast.warning { border-color: rgba(232, 172, 75, 0.3); border-left-color: #e3a13f; background: rgba(255, 251, 240, 0.92); }
.scan-toast .taotu-svg-icon { width: 18px; height: 18px; } .scan-toast strong { display: block; color: #2fba86; font-size: 13px; font-weight: 900; } .scan-toast.error strong { color: #df6680; }
.scan-toast.warning strong { color: #c88727; }
.scan-toast span { color: #8b96aa; font-size: 12px; font-weight: 800; } .scan-toast button { border: none; background: transparent; color: #98a3b7; font-size: 18px; cursor: pointer; }
.path-toolbar { display: flex; gap: 12px; margin: 12px 0 20px; }
.path-toolbar button, .row-actions button, .add-footer button, .generate-token-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 34px; padding: 0 14px; border-radius: 7px; font-size: 13px; font-weight: 900; white-space: nowrap; cursor: pointer; transition: transform 0.16s ease; }
.path-toolbar button:active, .row-actions button:active, .add-footer button:active, .generate-token-btn:active { transform: scale(0.985); }
.path-toolbar .taotu-svg-icon, .row-actions .taotu-svg-icon { width: 15px; height: 15px }
.primary-action, .confirm-add { border: none; background: linear-gradient(90deg, #f45f93, #ff78a9); color: white; box-shadow: 0 10px 22px rgba(244, 95, 147, 0.2); }
.plain-action, .cancel-add { border: 1px solid rgba(218, 224, 238, 0.92); background: rgba(255,255,255,0.72); color: #66728a; }
.scan-action { border: 1px solid rgba(153, 123, 244, 0.36); background: rgba(248, 244, 255, 0.82); color: #8d72e8; }
.path-table { border: 1px solid rgba(226, 230, 241, 0.82); border-radius: 10px; overflow: hidden; background: rgba(255,255,255,0.42); }
.path-head, .path-row { display: grid; grid-template-columns: minmax(180px, 1.45fr) 82px 62px 110px minmax(116px, 0.95fr) 146px 70px 174px; align-items: center; gap: 10px; padding: 0 13px; }
.path-head { min-height: 38px; color: #7d879c; font-size: 12px; font-weight: 900; background: rgba(255,255,255,0.5); border-bottom: 1px solid rgba(226, 230, 241, 0.76); }
.path-head > span:nth-child(3),
.path-row > span:nth-child(3) { justify-self: start; width: 2em; text-align: center; }
.path-row { min-height: 58px; border-bottom: 1px solid rgba(226, 230, 241, 0.66); color: #5f6a82; font-size: 12px; font-weight: 800; }
.path-row:last-child { border-bottom: none; }
.path-cell-main { display: grid; gap: 5px; min-width: 0; }
.path-cell-main strong { overflow: hidden; color: #455169; font-size: 13px; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.path-cell-main.single strong { font-weight: 800; }
.path-cell-main em { color: #ff6f9d; font-style: normal; }
.path-cell-main small { color: #9ba5b8; font-size: 12px; font-weight: 800; }
.subsection-title { margin: 18px 0 9px; color: #59657c; font-size: 13px; font-weight: 900; }
.type-pill, .status-pill, .tag-summary i { display: inline-flex; align-items: center; min-height: 20px; padding: 0 7px; border-radius: 6px; font-size: 11px; font-style: normal; font-weight: 900; white-space: nowrap; }
.type-default { background: #ffe8f1; color: #ff6f9d; } .type-local { background: #f1eaff; color: #8c72e8; } .type-smb { background: #e7f2ff; color: #4d94df; } .type-s3 { background: #fff0e9; color: #d77b54; } .type-ftp { background: #e8f4ff; color: #4c91d9; }
.bool-cell { display: inline-flex; align-items: center; justify-content: center; }
.status-pill.ok { background: #e7f8ee; color: #44b875; } .status-pill.warn { background: #fff3dc; color: #c78a2a; }
.tag-summary { display: flex; align-items: center; gap: 5px; min-width: 0; }
.tag-summary i { background: #f2f4f8; color: #8b96aa; } .tag-summary em, .tag-summary b { color: #9aa4b7; font-style: normal; font-weight: 900; }
.row-actions { display: flex; justify-content: flex-end; gap: 6px; min-width: 168px; }
.row-actions button { flex: 0 0 52px; width: 52px; min-height: 26px; padding: 0 5px; gap: 4px; border-radius: 6px; font-size: 12px; line-height: 1; }
.row-actions .taotu-svg-icon { width: 13px; height: 13px; }
.scan-row-btn { border: 1px solid rgba(153, 123, 244, 0.28); background: rgba(247, 243, 255, 0.82); color: #8c72e8; }
.edit-row-btn { border: 1px solid rgba(96, 176, 230, 0.28); background: rgba(239, 249, 255, 0.86); color: #4c9bd5; }
.delete-row-btn { border: 1px solid rgba(255, 111, 157, 0.26); background: rgba(255, 241, 246, 0.86); color: #ff6f9d; }
.default-action { justify-self: center; color: #8792a8; font-size: 17px; }
.empty-custom-paths { padding: 32px 14px; text-align: center; color: #98a3b7; font-size: 13px; font-weight: 900; }
.path-hint { margin: 13px 0 0; color: #9aa4b7; font-size: 12px; font-weight: 800; }
.add-path-panel { margin: 16px -8px -8px; padding: 16px; border: 1px solid rgba(255, 111, 157, 0.34); border-radius: 14px; background: linear-gradient(135deg, rgba(255, 246, 250, 0.9), rgba(255,255,255,0.72)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.8); }
.add-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.add-title-row h2 { display: flex; align-items: center; gap: 8px; margin: 0; color: #3c4962; font-size: 16px; font-weight: 900; } .add-title-row .taotu-svg-icon { width: 18px; height: 18px; } .add-title-row button { border: none; background: transparent; color: #7f899d; font-size: 22px; cursor: pointer; }
.add-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 18px; }
.add-inner-card { min-height: 174px; padding: 13px; border-radius: 9px; }
.field-line { display: grid; gap: 6px; margin-bottom: 12px; color: #5f6c84; font-size: 12px; font-weight: 900; }
.field-line input, .field-line select, .soft-select, .soft-input { width: 100%; min-height: 34px; padding: 0 11px; border: 1px solid rgba(218, 224, 238, 0.9); border-radius: 7px; background: rgba(255,255,255,0.66); color: #63708a; outline: none; box-sizing: border-box; }
.field-line input::placeholder, .soft-input::placeholder { color: #bdc5d3; }
.switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 10px 0 14px; }
.switch-row strong, .album-mode-row strong { color: #61708a; font-size: 12px; font-weight: 900; }
.switch-row strong .taotu-svg-icon { width: 14px; height: 14px; margin-right: 4px; color: #ff4d68; vertical-align: -2px; }
.switch-row small { display: block; margin-top: 4px; color: #a0aabc; font-size: 11px; font-weight: 800; }
.danger-setting { padding-top: 10px; border-top: 1px dashed rgba(255, 120, 150, 0.32); }
.danger-setting strong { color: #e95d78; }
.pink-switch input { display: none; } .pink-switch i { position: relative; display: block; width: 34px; height: 18px; border-radius: 999px; background: #dfe5ee; }
.pink-switch i::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: white; box-shadow: 0 2px 6px rgba(80,90,110,0.22); transition: transform 0.18s ease; }
.pink-switch input:checked + i { background: #ff6f9d; } .pink-switch input:checked + i::after { transform: translateX(16px); }
.album-mode-row { display: grid; grid-template-columns: 120px repeat(3, max-content); gap: 14px; align-items: center; margin-bottom: 10px; color: #68758d; font-size: 12px; font-weight: 900; }
.album-mode-row input { width: 14px; height: 14px; margin-right: 6px; accent-color: #ff6f9d; }
.existing-tag-picker, .new-tag-preview { display: grid; gap: 7px; margin-bottom: 12px; color: #5f6c84; font-size: 12px; font-weight: 900; }
.existing-tag-picker div, .new-tag-preview div { min-height: 48px; display: flex; align-content: flex-start; flex-wrap: wrap; gap: 7px; padding: 9px; border: 1px solid rgba(218, 224, 238, 0.9); border-radius: 8px; background: rgba(255,255,255,0.58); }
.existing-tag-picker button, .new-tag-preview button { min-height: 24px; padding: 0 9px; border: 1px solid rgba(255, 111, 157, 0.38); border-radius: 6px; background: rgba(255, 255, 255, 0.72); color: #7f899d; font-size: 12px; font-weight: 900; white-space: nowrap; cursor: pointer; }
.existing-tag-picker button.selected, .new-tag-preview button { border-color: rgba(255, 111, 157, 0.56); background: rgba(255, 246, 250, 0.82); color: #ff6f9d; }
.existing-tag-picker em, .new-tag-preview em { color: #b0b9c7; font-style: normal; }
.add-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 14px; }
.add-footer button { min-width: 88px; min-height: 36px; }
.config-side { display: grid; gap: 16px; }
.side-card { padding: 16px; border-radius: 13px; }
.side-card h2 { display: flex; align-items: center; gap: 9px; margin: 0 0 12px; color: #3f4c64; font-size: 15px; font-weight: 900; }
.side-card h2 .taotu-svg-icon { width: 20px; height: 20px }
.side-card > p { margin: -3px 0 14px; color: #8f9aaf; font-size: 12px; font-weight: 800; }
.db-info-panel { padding: 12px; border: 1px solid rgba(226, 230, 241, 0.74); border-radius: 9px; background: rgba(255,255,255,0.52); }
.db-info-panel div { display: flex; justify-content: space-between; gap: 12px; min-height: 28px; color: #8792a7; font-size: 12px; font-weight: 900; }
.db-info-panel b { color: #5c6880; font-weight: 900; text-align: right; }
.db-info-panel p { margin: 8px 0 0; padding-top: 12px; border-top: 1px solid rgba(226, 230, 241, 0.8); color: #9aa4b7; font-size: 11px; font-weight: 900; line-height: 1.6; }
.display-choice-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.display-choice-row button { min-height: 76px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 11px 8px; border: 1px solid rgba(226, 230, 241, 0.84); border-radius: 8px; background: rgba(255,255,255,0.62); color: #6f7a90; font-size: 13px; font-weight: 900; cursor: pointer; }
.display-choice-row button.active { border-color: rgba(255, 111, 157, 0.7); background: rgba(255, 241, 247, 0.82); color: #ff6f9d; }
.display-choice-row .taotu-svg-icon { width: 24px; height: 24px }
.token-list-mini { display: grid; gap: 8px; }
.token-mini-card { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 28px 28px; gap: 7px; align-items: center; padding: 11px; border: 1px solid rgba(226, 230, 241, 0.74); border-radius: 8px; background: rgba(255,255,255,0.58); }
.token-mini-card strong, .token-mini-card span, .token-mini-card code { display: block; }
.token-mini-card strong { color: #5c6880; font-size: 12px; font-weight: 900; }
.token-mini-card span { margin: 4px 0 5px; color: #9aa4b7; font-size: 11px; font-weight: 800; }
.token-mini-card code { overflow: hidden; color: #63708a; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.token-mini-card button { width: 26px; height: 26px; display: grid; place-items: center; border: 1px solid rgba(226, 230, 241, 0.84); border-radius: 6px; background: rgba(255,255,255,0.68); cursor: pointer; }
.token-mini-card button .taotu-svg-icon { width: 14px; height: 14px }
.token-action-menu { position: absolute; top: 42px; right: 8px; z-index: 5; min-width: 112px; padding: 6px; border: 1px solid rgba(226, 230, 241, 0.9); border-radius: 8px; background: rgba(255,255,255,0.96); box-shadow: 0 16px 32px rgba(72, 84, 112, 0.14); }
.token-action-menu button { width: 100%; height: 28px; justify-content: flex-start; padding: 0 8px; border: none; background: transparent; color: #657188; font-size: 12px; font-weight: 900; }
.token-action-menu button:hover { background: rgba(247, 243, 255, 0.9); color: #8b72e8; }
.token-action-menu button.danger:hover { background: rgba(255, 241, 246, 0.92); color: #ff6f9d; }
.token-pagination { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px; }
.token-pagination button { min-width: 30px; height: 30px; border: 1px solid rgba(213, 222, 238, 0.96); border-radius: 8px; background: rgba(255,255,255,0.78); color: #66728a; cursor: pointer; font-size: 13px; font-weight: 900; }
.token-pagination button.active { border-color: transparent; background: linear-gradient(135deg, #ff86ad, #f85f9a); color: #fff; box-shadow: 0 10px 22px rgba(248, 95, 154, 0.18); }
.token-pagination button.ellipsis, .token-pagination button:disabled { cursor: default; opacity: 0.48; box-shadow: none; }
.token-empty { padding: 16px; border: 1px solid rgba(226, 230, 241, 0.74); border-radius: 8px; color: #9aa4b7; text-align: center; font-size: 12px; font-weight: 900; }
.new-token-inline { position: relative; display: grid; gap: 5px; margin-top: 10px; padding: 10px 28px 10px 10px; border: 1px solid rgba(245, 177, 77, 0.28); border-radius: 8px; background: rgba(255, 250, 235, 0.84); color: #a86f1d; font-size: 12px; font-weight: 900; }
.new-token-inline button { position: absolute; top: 6px; right: 8px; border: none; background: transparent; color: #b78332; cursor: pointer; }
.new-token-inline code { overflow-wrap: anywhere; color: #7d5a22; font-size: 11px; }
.generate-token-btn { width: 100%; margin-top: 14px; border: 1px solid rgba(153, 123, 244, 0.35); background: rgba(248, 244, 255, 0.78); color: #8b72e8; }
.api-doc-link { display: inline-flex; margin-top: 13px; color: #8b72e8; font-size: 12px; font-weight: 900; text-decoration: none; }
button:disabled { opacity: 0.66; cursor: default; }
@media (max-width: 1380px) { .admin-config-page { grid-template-columns: minmax(0, 1fr) 280px; } .path-head, .path-row { grid-template-columns: minmax(170px, 1.3fr) 76px 56px 98px minmax(96px, 0.8fr) 126px 64px 108px; gap: 8px; padding: 0 10px; } }
@media (max-width: 1180px) { .admin-config-page { grid-template-columns: 1fr; } .config-side { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
