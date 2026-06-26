<template>
  <div class="dashboard-page page-container">
    <div class="dashboard-shell">
      <aside class="dashboard-sidebar">
        <div class="profile-block">
          <div class="avatar-mark">{{ userInitial }}</div>
          <div>
            <h1>我的仪表盘</h1>
            <span v-if="user">{{ user.username }} · {{ user.role === 'admin' ? '管理员' : '用户' }}</span>
          </div>
        </div>
        <nav class="dashboard-nav">
          <button v-for="item in navItems" :key="item.key" class="nav-item" :class="{ active: activeSection === item.key }" @click="activeSection = item.key">
            <span class="nav-icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </button>
        </nav>
      </aside>

      <main class="dashboard-content">
        <section v-if="activeSection === 'overview'" class="panel-section">
          <div class="content-header"><h2>统计</h2></div>
          <div class="stats-row">
            <div class="fluent-card stat-card"><div class="stat-value">{{ myStats.images || 0 }}</div><div class="stat-label">我的图片</div></div>
            <div class="fluent-card stat-card"><div class="stat-value">{{ formatSize(myStats.storage || 0) }}</div><div class="stat-label">当前页存储</div></div>
            <div class="fluent-card stat-card"><div class="stat-value">{{ myTags.length }}</div><div class="stat-label">私有标签</div></div>
            <div class="fluent-card stat-card"><div class="stat-value">{{ myAlbums.length }}</div><div class="stat-label">我的相册</div></div>
          </div>
          <div class="quick-actions">
            <NuxtLink to="/upload" class="fluent-card action-card"><span class="action-icon">+</span><span class="action-label">上传图片</span></NuxtLink>
            <NuxtLink to="/api-docs" class="fluent-card action-card"><span class="action-icon">{ }</span><span class="action-label">API 接口</span></NuxtLink>
          </div>
        </section>

        <section v-if="activeSection === 'images'" class="panel-section">
          <div class="content-header">
            <div class="header-title-row">
              <h2>图片管理</h2>
              <button class="fluent-btn fluent-btn-secondary multi-toggle" :class="{ active: imageMultiMode }" @click="toggleImageMultiMode">
                {{ imageMultiMode ? '退出多选' : '多选' }}
              </button>
              <template v-if="imageMultiMode">
                <button class="fluent-btn fluent-btn-secondary" @click="selectAllMyImages">全选当前页</button>
                <button class="fluent-btn fluent-btn-secondary" @click="deselectMyImages">取消全选</button>
                <span class="selected-count inline-count" v-if="selectedImageIds.length > 0">已选 {{ selectedImageIds.length }} 张</span>
              </template>
            </div>
            <NuxtLink to="/upload" class="fluent-btn fluent-btn-secondary">上传更多</NuxtLink>
          </div>
          <div class="fluent-card management-panel">
            <div class="image-toolbar">
              <span class="source-pill active">我的图库</span>
              <select v-model="imageAlbumId" class="fluent-select" @change="loadMyImages(1)">
                <option :value="null">全部相册</option>
                <option v-for="album in myAlbums" :key="album.id" :value="album.id">{{ album.name }}</option>
              </select>
              <input v-model="imageSearch" class="fluent-input search-input" placeholder="搜索文件名..." @keyup.enter="loadMyImages(1)" />
              <button class="fluent-btn fluent-btn-secondary" @click="showImageMoreFilters = !showImageMoreFilters">更多</button>
              <button class="fluent-btn fluent-btn-secondary" @click="loadMyImages(1)">搜索</button>
            </div>

            <div v-if="showImageMoreFilters" class="more-filters">
              <label>私有标签筛选</label>
              <TagSelector :tags="privateTagOptions" :selectedTagIds="imageFilterTagIds" @update:selectedTagIds="imageFilterTagIds = $event; loadMyImages(1)" />
            </div>

            <div v-if="imageMultiMode && selectedImageIds.length > 0" class="batch-bar">
              <button class="fluent-btn fluent-btn-secondary" @click="batchSetMyImagesPublic(true)">设为公共</button>
              <button class="fluent-btn fluent-btn-secondary" @click="batchSetMyImagesPublic(false)">取消公共</button>
              <button class="fluent-btn fluent-btn-secondary delete-btn" @click="batchDeleteMyImages">批量删除</button>
            </div>

            <div class="image-list">
              <div v-for="img in myImages" :key="img.id" class="image-row" :class="{ selected: selectedImageIds.includes(img.id) }">
                <div class="row-checkbox" v-if="imageMultiMode">
                  <input type="checkbox" :checked="selectedImageIds.includes(img.id)" @change="toggleImageSelect(img.id)" />
                </div>
                <div class="row-thumb"><img :src="getThumbUrl(img)" :alt="img.filename" loading="lazy" /></div>
                <div class="row-main">
                  <p class="row-title">{{ img.filename }}</p>
                  <p class="row-meta">{{ img.width }}×{{ img.height }} · {{ formatSize(img.size_bytes) }}</p>
                  <div class="row-tags" v-if="img.tags && img.tags.length > 0">
                    <span v-for="tag in img.tags.slice(0, 4)" :key="(tag.source || 'tag') + '-' + tag.id" class="tag-mini">{{ tag.display_name || tag.name }}</span>
                  </div>
                </div>
                <div class="row-actions">
                  <label class="public-toggle"><input type="checkbox" :checked="img.is_public" @change="togglePublic(img)" /><span>公共</span></label>
                  <button class="fluent-btn fluent-btn-secondary" @click="openImageEdit(img)">编辑</button>
                  <button class="fluent-btn fluent-btn-secondary delete-btn" @click="deleteMyImage(img)">删除</button>
                </div>
              </div>
            </div>
            <div v-if="myImages.length === 0 && !loading" class="empty-msg">暂无图片</div>
            <div class="pagination" v-if="myTotal > imagePageSize">
              <button class="fluent-btn fluent-btn-secondary" :disabled="myPage <= 1" @click="loadMyImages(myPage - 1)">上一页</button>
              <span>第 {{ myPage }} 页 / 共 {{ Math.ceil(myTotal / imagePageSize) }} 页</span>
              <button class="fluent-btn fluent-btn-secondary" :disabled="myPage >= Math.ceil(myTotal / imagePageSize)" @click="loadMyImages(myPage + 1)">下一页</button>
            </div>
          </div>
        </section>

        <section v-if="activeSection === 'tags'" class="panel-section">
          <div class="content-header"><h2>标签设置</h2></div>
          <div class="tabs compact-tabs">
            <button class="tab-btn" :class="{ active: tagTab === 'manage' }" @click="tagTab = 'manage'">标签管理</button>
            <button class="tab-btn" :class="{ active: tagTab === 'manual' }" @click="tagTab = 'manual'">人工标签</button>
          </div>

          <div v-if="tagTab === 'manage'" class="fluent-card management-panel">
            <div class="section-header">
              <h3>我的私有标签</h3>
              <div class="section-actions">
                <button v-if="selectedPrivateTagIds.length > 0 && user?.role === 'admin'" class="fluent-btn fluent-btn-secondary" @click="setSelectedPrivateTagsPublic">设为公共</button>
                <button v-if="selectedPrivateTagIds.length > 0" class="fluent-btn fluent-btn-secondary delete-btn" @click="deleteSelectedPrivateTags">删除</button>
                <button class="fluent-btn fluent-btn-primary" @click="openTagCreate">新建标签</button>
              </div>
            </div>
            <div class="tag-table">
              <div class="private-table-header"><span><input type="checkbox" :checked="allPrivateTagsSelected" @change="toggleSelectAllPrivateTags" /></span><span>名称</span><span>显示名</span><span>可组合</span><span>互斥标签</span><span>操作</span></div>
              <div v-for="tag in myTags" :key="tag.id" class="private-table-row">
                <span><input type="checkbox" :checked="selectedPrivateTagIds.includes(tag.id)" @change="togglePrivateTagSelect(tag.id)" /></span>
                <span>{{ tag.name }}</span>
                <span>{{ tag.display_name || tag.name }}</span>
                <span>{{ tag.combinable ? '是' : '否' }}</span>
                <span class="mutual-summary">{{ formatMutualNames(tag.mutually_exclusive_with) || '-' }}</span>
                <span class="row-actions compact-actions">
                  <button class="fluent-btn fluent-btn-secondary" @click="openTagEdit(tag)">编辑</button>
                  <button class="fluent-btn fluent-btn-secondary delete-btn" @click="deleteMyTag(tag)">删除</button>
                </span>
              </div>
              <div v-if="myTags.length === 0" class="empty-msg">暂无私有标签</div>
            </div>
          </div>

          <div v-if="tagTab === 'manual'" class="fluent-card management-panel">
            <div class="manual-filters">
              <span class="source-pill active">我的图库</span>
              <select v-model="manualSort" class="fluent-select" @change="loadManualImages(1)">
                <option value="created_at">最新</option>
                <option value="view_count">最热门</option>
              </select>
              <select v-model="manualAlbumId" class="fluent-select album-filter" @change="loadManualImages(1)">
                <option :value="null">全部相册</option>
                <option v-for="album in myAlbums" :key="album.id" :value="album.id">{{ album.name }}</option>
              </select>
              <span class="selected-count">已选 {{ manualSelected.length }} 张</span>
            </div>

            <div class="manual-grid">
              <div v-for="img in manualImages" :key="img.id" class="manual-card" :class="{ selected: manualSelected.includes(img.id) }" @click="toggleManualSelect(img.id)">
                <div class="manual-thumb"><img :src="getThumbUrl(img)" loading="lazy" /><div class="check-mark" v-if="manualSelected.includes(img.id)">✓</div></div>
                <p class="manual-name">{{ img.filename }}</p>
              </div>
            </div>
            <div v-if="manualImages.length === 0" class="empty-msg">暂无图片</div>
            <div class="pagination" v-if="manualTotal > manualPageSize">
              <button class="fluent-btn fluent-btn-secondary" :disabled="manualPage <= 1" @click="loadManualImages(manualPage - 1)">上一页</button>
              <span>第 {{ manualPage }} 页 / 共 {{ Math.ceil(manualTotal / manualPageSize) }} 页</span>
              <button class="fluent-btn fluent-btn-secondary" :disabled="manualPage >= Math.ceil(manualTotal / manualPageSize)" @click="loadManualImages(manualPage + 1)">下一页</button>
            </div>

            <div class="manual-action" v-if="manualSelected.length > 0">
              <div class="form-group"><label>选择要应用的私有标签</label><TagSelector :tags="privateTagOptions" :selectedTagIds="manualTagIds" @update:selectedTagIds="manualTagIds = $event" /></div>
              <label class="public-toggle overwrite-toggle"><input type="checkbox" v-model="manualOverwrite" /><span>覆盖式标签</span></label>
              <button class="fluent-btn fluent-btn-primary" :disabled="manualLoading || (!manualOverwrite && manualTagIds.length === 0)" @click="runManualTag">{{ manualLoading ? '执行中...' : manualActionText }}</button>
              <p v-if="manualResult" class="result-msg">{{ manualResult }}</p>
            </div>
          </div>
        </section>

        <section v-if="activeSection === 'tokens'" class="panel-section">
          <div class="content-header"><h2>API Token</h2><button class="fluent-btn fluent-btn-primary" @click="showTokenModal = true">生成新 Token</button></div>
          <div class="fluent-card management-panel">
            <div v-if="myTokens.length > 0" class="token-list">
              <div v-for="t in myTokens" :key="t.id" class="token-item">
                <div class="token-info"><span class="token-label">{{ t.label || '未命名' }}</span><span class="token-date">{{ formatDate(t.created_at) }}</span></div>
                <button class="fluent-btn fluent-btn-secondary" @click="deleteToken(t.id)">删除</button>
              </div>
            </div>
            <div v-else class="empty-msg">暂无 Token</div>
            <div v-if="newTokenValue" class="new-token-box"><p>新 Token（仅显示一次）：</p><code>{{ newTokenValue }}</code><button class="fluent-btn fluent-btn-secondary" @click="copyToken">复制</button></div>
          </div>
        </section>

        <section v-if="activeSection === 'albums'" class="panel-section">
          <div class="content-header"><h2>相册</h2><NuxtLink to="/albums" class="fluent-btn fluent-btn-secondary">打开相册页</NuxtLink></div>
          <div class="fluent-card management-panel">
            <div class="album-list" v-if="myAlbums.length > 0">
              <div v-for="album in myAlbums" :key="album.id" class="album-row"><div><strong>{{ album.name }}</strong><span>{{ album.image_count || 0 }} 张图片</span></div><NuxtLink :to="'/albums/' + album.id" class="fluent-btn fluent-btn-secondary">查看</NuxtLink></div>
            </div>
            <div v-else class="empty-msg">暂无相册</div>
          </div>
        </section>

        <section v-if="activeSection === 'users'" class="panel-section">
          <div class="content-header"><h2>用户</h2></div>
          <div class="account-grid" v-if="user">
            <div class="fluent-card management-panel account-panel">
              <h3>账号信息</h3>
              <div class="account-row"><span>用户名</span><strong>{{ user.username }}</strong></div>
              <div class="account-row"><span>绑定邮箱</span><strong>{{ user.email || '未绑定' }}</strong></div>
              <div class="account-row"><span>角色</span><strong>{{ user.role === 'admin' ? '管理员' : '用户' }}</strong></div>
              <div class="account-row"><span>我的图片</span><strong>{{ myStats.images || 0 }} 张</strong></div>
              <div class="account-row"><span>私有标签</span><strong>{{ myTags.length }} 个</strong></div>
            </div>
            <div class="fluent-card management-panel account-panel">
              <h3>更改密码</h3>
              <div class="form-group"><label>旧密码</label><input v-model="passwordForm.oldPassword" type="password" class="fluent-input" placeholder="请输入旧密码" /></div>
              <div class="form-group"><label>新密码</label><input v-model="passwordForm.newPassword" type="password" class="fluent-input" placeholder="请输入新密码" /></div>
              <div class="form-group"><label>重复新密码</label><input v-model="passwordForm.confirmPassword" type="password" class="fluent-input" placeholder="再次输入新密码" @keyup.enter="changeOwnPassword" /></div>
              <button class="fluent-btn fluent-btn-primary password-btn" :disabled="!canChangePassword || passwordChanging" @click="changeOwnPassword">{{ passwordChanging ? '修改中...' : '更改密码' }}</button>
              <p v-if="passwordError" class="error-msg account-msg">{{ passwordError }}</p>
              <p v-if="passwordMessage" class="result-msg account-msg">{{ passwordMessage }}</p>
            </div>
          </div>
        </section>


      </main>
    </div>

    <div v-if="showTokenModal" class="modal-overlay" @click.self="showTokenModal = false"><div class="modal fluent-card"><h3>生成 API Token</h3><div class="form-group"><label>Token 名称</label><input v-model="tokenLabel" class="fluent-input" placeholder="例如：我的网站" /></div><div class="modal-actions"><button class="fluent-btn fluent-btn-primary" @click="createToken">生成</button><button class="fluent-btn fluent-btn-secondary" @click="showTokenModal = false">取消</button></div></div></div>

    <div v-if="showTagModal" class="modal-overlay" @click.self="closeTagModal">
      <div class="modal fluent-card">
        <h3>{{ editingTag ? '编辑私有标签' : '新建私有标签' }}</h3>
        <div class="form-group"><label>标签名称</label><input v-model="tagForm.name" class="fluent-input" :disabled="!!editingTag" placeholder="例如：风景、人物" /></div>
        <div class="form-group"><label>显示名称</label><input v-model="tagForm.display_name" class="fluent-input" placeholder="页面展示名称" /></div>
        <div class="form-group inline-check"><label><input type="checkbox" v-model="tagForm.combinable" /> 可组合标签</label></div>
        <div class="form-group">
          <label>互斥私有标签</label>
          <div class="mutual-picker">
            <button
              v-for="tag in mutualTagOptions"
              :key="tag.id"
              type="button"
              class="mutual-chip"
              :class="{ selected: tagForm.mutualIds.includes(tag.id) }"
              @click="toggleMutualTag(tag.id)"
            >{{ tag.display_name || tag.name }}</button>
            <span v-if="mutualTagOptions.length === 0" class="empty-inline">暂无其它私有标签</span>
          </div>
        </div>
        <div class="modal-actions"><button class="fluent-btn fluent-btn-primary" @click="saveMyTag">保存</button><button class="fluent-btn fluent-btn-secondary" @click="closeTagModal">取消</button></div>
      </div>
    </div>

    <div v-if="editingImage" class="modal-overlay" @click.self="closeImageEdit">
      <div class="modal wide-modal fluent-card">
        <h3>编辑图片标签</h3>
        <div class="edit-preview"><img :src="getThumbUrl(editingImage)" /><div><p><strong>{{ editingImage.filename }}</strong></p><p>{{ editingImage.width }}×{{ editingImage.height }}</p></div></div>
        <div class="form-group"><label>私有标签</label><TagSelector :tags="privateTagOptions" :selectedTagIds="editTagIds" @update:selectedTagIds="editTagIds = $event" /></div>
        <div class="modal-actions"><button class="fluent-btn fluent-btn-primary" @click="saveImageTags">保存</button><button class="fluent-btn fluent-btn-secondary" @click="closeImageEdit">取消</button></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import TagSelector from '~/components/tags/TagSelector.vue'

const api = useApi()
const config = useRuntimeConfig()
const router = useRouter()

const activeSection = ref('overview')
const tagTab = ref('manage')
const user = ref(null)
const loading = ref(true)
const myImages = ref([])
const myTotal = ref(0)
const myPage = ref(1)
const imagePageSize = 10
const imageSearch = ref('')
const imageAlbumId = ref(null)
const showImageMoreFilters = ref(false)
const imageFilterTagIds = ref([])
const imageMultiMode = ref(false)
const selectedImageIds = ref([])
const myAlbums = ref([])
const myStats = ref({ images: 0, storage: 0 })
const myTokens = ref([])
const showTokenModal = ref(false)
const tokenLabel = ref('')
const newTokenValue = ref('')
const myTags = ref([])
const selectedPrivateTagIds = ref([])
const showTagModal = ref(false)
const editingTag = ref(null)
const tagForm = reactive({ name: '', display_name: '', combinable: true, mutualIds: [] })
const editingImage = ref(null)
const editTagIds = ref([])
const manualImages = ref([])
const manualTotal = ref(0)
const manualPage = ref(1)
const manualPageSize = 10
const manualSort = ref('created_at')
const manualAlbumId = ref(null)
const manualSelected = ref([])
const manualTagIds = ref([])
const manualOverwrite = ref(false)
const manualLoading = ref(false)
const manualResult = ref('')
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const passwordChanging = ref(false)
const passwordMessage = ref('')
const passwordError = ref('')

const navItems = [
  { key: 'overview', label: '统计', icon: '▦' },
  { key: 'images', label: '图片管理', icon: '□' },
  { key: 'tags', label: '标签设置', icon: '#' },
  { key: 'albums', label: '相册', icon: '▤' },
  { key: 'users', label: '用户', icon: '@' },
  { key: 'tokens', label: 'API Token', icon: '{}' }
]

const userInitial = computed(() => (user.value?.username || 'U').slice(0, 1).toUpperCase())
const privateTagOptions = computed(() => {
  const mapped = myTags.value.map(tag => ({ id: 'u' + tag.id, name: tag.name, display_name: tag.display_name || tag.name, combinable: !!tag.combinable, mutually_exclusive_with: tag.mutually_exclusive_with, isUserTag: true }))
  return { combinable: mapped.filter(tag => tag.combinable !== false), nonCombinable: mapped.filter(tag => tag.combinable === false) }
})
const manualActionText = computed(() => {
  if (manualOverwrite.value && manualTagIds.value.length === 0) return '清空 ' + manualSelected.value.length + ' 张图片的私有标签'
  return '立即标签 ' + manualSelected.value.length + ' 张图片'
})
const canChangePassword = computed(() => {
  return !!passwordForm.oldPassword && !!passwordForm.newPassword && !!passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword
})

const parseUserMutualIds = (value) => {
  if (!value) return []
  return String(value)
    .split(/[,，.。\s]+/)
    .map(id => id.trim())
    .filter(Boolean)
    .map(id => /^u\d+$/i.test(id) ? parseInt(id.slice(1)) : (/^\d+$/.test(id) ? Number(id) : null))
    .filter(id => Number.isInteger(id))
}
const mutualTagOptions = computed(() => myTags.value.filter(tag => tag.id !== editingTag.value?.id))
const allPrivateTagsSelected = computed(() => myTags.value.length > 0 && myTags.value.every(tag => selectedPrivateTagIds.value.includes(tag.id)))
const formatMutualNames = (value) => {
  const ids = parseUserMutualIds(value)
  return ids.map(id => myTags.value.find(tag => tag.id === id)).filter(Boolean).map(tag => tag.display_name || tag.name).join('、')
}
const toggleMutualTag = (id) => {
  const idx = tagForm.mutualIds.indexOf(id)
  if (idx >= 0) tagForm.mutualIds.splice(idx, 1)
  else tagForm.mutualIds.push(id)
  if (tagForm.mutualIds.length > 0) tagForm.combinable = false
}

onMounted(async () => {
  const token = localStorage.getItem('jwt_token')
  if (!token) { router.push('/login'); return }
  try {
    user.value = await api.get('/api/admin/auth/me')
    await Promise.all([loadMyTags(), loadMyAlbums(), loadTokens()])
    await Promise.all([loadMyImages(), loadManualImages()])
  } catch {} finally { loading.value = false }
})

const loadMyImages = async (p = 1) => {
  myPage.value = p
  selectedImageIds.value = []
  try {
    const data = await api.get('/api/internal/images', {
      page: p,
      limit: imagePageSize,
      mine: 'true',
      album: imageAlbumId.value || undefined,
      search: imageSearch.value || undefined,
      tags: imageFilterTagIds.value.length > 0 ? imageFilterTagIds.value.join(',') : undefined
    })
    myImages.value = data.images || []
    myTotal.value = data.total || 0
    myStats.value = { images: data.total || 0, storage: myImages.value.reduce((sum, img) => sum + (img.size_bytes || 0), 0) }
  } catch {}
}

const loadManualImages = async (p = 1) => {
  manualPage.value = p
  manualSelected.value = []
  try {
    const data = await api.get('/api/internal/images', { page: p, limit: manualPageSize, mine: 'true', sort: manualSort.value, order: 'desc', album: manualAlbumId.value || undefined })
    manualImages.value = data.images || []
    manualTotal.value = data.total || 0
  } catch {}
}

const loadMyAlbums = async () => {
  try { const data = await api.get('/api/internal/albums', { limit: 200, mine: 'true' }); myAlbums.value = data.albums || [] } catch {}
}
const loadTokens = async () => {
  try { const data = await api.get('/api/admin/api/tokens'); myTokens.value = data.tokens || [] } catch {}
}
const loadMyTags = async () => {
  try {
    const data = await api.get('/api/user-tags')
    myTags.value = data.tags || []
    selectedPrivateTagIds.value = selectedPrivateTagIds.value.filter(id => myTags.value.some(tag => tag.id === id))
  } catch {}
}


const togglePrivateTagSelect = (id) => {
  const idx = selectedPrivateTagIds.value.indexOf(id)
  if (idx >= 0) selectedPrivateTagIds.value.splice(idx, 1)
  else selectedPrivateTagIds.value.push(id)
}

const toggleSelectAllPrivateTags = () => {
  if (allPrivateTagsSelected.value) selectedPrivateTagIds.value = []
  else selectedPrivateTagIds.value = myTags.value.map(tag => tag.id)
}

const deleteSelectedPrivateTags = async () => {
  if (selectedPrivateTagIds.value.length === 0) return
  if (!confirm('确定删除选中的 ' + selectedPrivateTagIds.value.length + ' 个私有标签？关联的图片标签也会被清除。')) return
  try {
    for (const id of selectedPrivateTagIds.value) await api.del('/api/user-tags/' + id)
    selectedPrivateTagIds.value = []
    await loadMyTags(); await loadMyImages(myPage.value); await loadManualImages(manualPage.value)
  } catch (err) { alert('批量删除失败: ' + (err.data?.error || err.message)) }
}

const setSelectedPrivateTagsPublic = async () => {
  if (user.value?.role !== 'admin' || selectedPrivateTagIds.value.length === 0) return
  try {
    for (const id of selectedPrivateTagIds.value) {
      await api.post('/api/admin/tag-convert/toggle', { tagId: id, isUserTag: true, is_public: true })
    }
    selectedPrivateTagIds.value = []
    await loadMyTags()
  } catch (err) { alert('批量设为公共失败: ' + (err.data?.error || err.message)) }
}

const openTagCreate = () => { editingTag.value = null; tagForm.name = ''; tagForm.display_name = ''; tagForm.combinable = true; tagForm.mutualIds = []; showTagModal.value = true }
const openTagEdit = (tag) => { editingTag.value = tag; tagForm.name = tag.name; tagForm.display_name = tag.display_name || tag.name; tagForm.combinable = tag.combinable !== false; tagForm.mutualIds = parseUserMutualIds(tag.mutually_exclusive_with).filter(id => id !== tag.id); showTagModal.value = true }
const closeTagModal = () => { showTagModal.value = false; editingTag.value = null; tagForm.mutualIds = [] }

const saveMyTag = async () => {
  if (!tagForm.name.trim()) return alert('请输入标签名')
  try {
    if (editingTag.value) await api.put('/api/user-tags/' + editingTag.value.id, { display_name: tagForm.display_name.trim() || tagForm.name.trim(), combinable: tagForm.combinable, mutually_exclusive_with: tagForm.mutualIds.map(id => 'u' + id).join(',') })
    else await api.post('/api/user-tags', { name: tagForm.name.trim(), display_name: tagForm.display_name.trim() || tagForm.name.trim(), combinable: tagForm.combinable, mutually_exclusive_with: tagForm.mutualIds.map(id => 'u' + id).join(',') })
    closeTagModal(); await loadMyTags()
  } catch (err) { alert('保存失败: ' + (err.data?.error || err.message)) }
}

const deleteMyTag = async (tag) => {
  if (!confirm('确定删除标签 "' + (tag.display_name || tag.name) + '"？')) return
  try { await api.del('/api/user-tags/' + tag.id); await loadMyTags(); await loadMyImages(myPage.value); await loadManualImages(manualPage.value) } catch { alert('删除失败') }
}

const openImageEdit = (img) => {
  editingImage.value = img
  editTagIds.value = (img.tags || [])
    .filter(tag => tag.source === 'user' || tag.user_tag_id)
    .map(tag => typeof tag.id === 'string' && tag.id.startsWith('u') ? tag.id : 'u' + (tag.user_tag_id || tag.id))
}
const closeImageEdit = () => { editingImage.value = null; editTagIds.value = [] }
const saveImageTags = async () => {
  if (!editingImage.value) return
  try { await api.post('/api/user-tags/apply', { imageIds: [editingImage.value.id], tagIds: editTagIds.value, mode: 'replace' }); closeImageEdit(); await loadMyImages(myPage.value); await loadManualImages(manualPage.value) }
  catch (err) { alert('保存失败: ' + (err.data?.error || err.message)) }
}

const toggleImageMultiMode = () => {
  imageMultiMode.value = !imageMultiMode.value
  if (!imageMultiMode.value) selectedImageIds.value = []
}
const toggleImageSelect = (id) => { const idx = selectedImageIds.value.indexOf(id); if (idx >= 0) selectedImageIds.value.splice(idx, 1); else selectedImageIds.value.push(id) }
const selectAllMyImages = () => { selectedImageIds.value = myImages.value.map(img => img.id) }
const deselectMyImages = () => { selectedImageIds.value = [] }
const batchSetMyImagesPublic = async (isPublic) => {
  let success = 0
  for (const id of selectedImageIds.value) {
    try { await api.put('/api/admin/images/' + id, { is_public: isPublic }); success++ } catch {}
  }
  alert('已' + (isPublic ? '设为公共' : '取消公共') + ': ' + success + ' 张')
  await loadMyImages(myPage.value)
}
const batchDeleteMyImages = async () => {
  if (!confirm('确定删除选中的 ' + selectedImageIds.value.length + ' 张图片？')) return
  let success = 0, fail = 0
  for (const id of selectedImageIds.value) {
    try { await api.del('/api/admin/images/' + id); success++ } catch { fail++ }
  }
  alert('删除完成: ' + success + ' 成功, ' + fail + ' 失败')
  await loadMyImages(myPage.value)
  await loadManualImages(manualPage.value)
}

const toggleManualSelect = (id) => { const idx = manualSelected.value.indexOf(id); if (idx >= 0) manualSelected.value.splice(idx, 1); else manualSelected.value.push(id) }
const runManualTag = async () => {
  if (manualSelected.value.length === 0) return
  if (!manualOverwrite.value && manualTagIds.value.length === 0) return
  manualLoading.value = true; manualResult.value = ''
  try {
    await api.post('/api/user-tags/apply', { imageIds: manualSelected.value, tagIds: manualTagIds.value, mode: manualOverwrite.value ? 'replace' : 'add' })
    manualResult.value = '标签完成'; manualSelected.value = []; manualTagIds.value = []
    await loadManualImages(manualPage.value); await loadMyImages(myPage.value)
  } catch (err) { manualResult.value = '失败: ' + (err.data?.error || err.message) }
  finally { manualLoading.value = false }
}

const togglePublic = async (img) => { try { await api.put('/api/admin/images/' + img.id, { is_public: !img.is_public }); img.is_public = !img.is_public } catch { alert('操作失败') } }
const deleteMyImage = async (img) => {
  if (!confirm('确定删除图片 "' + img.filename + '"？')) return
  try { await api.del('/api/admin/images/' + img.id); await loadMyImages(myPage.value); await loadManualImages(manualPage.value) } catch (err) { alert('删除失败: ' + (err.data?.error || err.message)) }
}

const changeOwnPassword = async () => {
  passwordError.value = ''
  passwordMessage.value = ''
  if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
    passwordError.value = '请完整填写旧密码和新密码'
    return
  }
  if (passwordForm.newPassword.length < 6) {
    passwordError.value = '新密码至少6位'
    return
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = '两次新密码不一致'
    return
  }

  passwordChanging.value = true
  try {
    await api.post('/api/admin/auth/change-password', { oldPassword: passwordForm.oldPassword, newPassword: passwordForm.newPassword })
    passwordMessage.value = '密码修改成功'
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (err) {
    passwordError.value = err.data?.error || err.message || '密码修改失败'
  } finally {
    passwordChanging.value = false
  }
}

const createToken = async () => { try { const data = await api.post('/api/admin/api/tokens', { label: tokenLabel.value, user_id: user.value?.id }); newTokenValue.value = data.token; tokenLabel.value = ''; showTokenModal.value = false; await loadTokens() } catch (err) { alert('创建失败: ' + err.message) } }
const deleteToken = async (id) => { if (!confirm('确定删除此 Token？')) return; try { await api.del('/api/admin/api/tokens/' + id); await loadTokens() } catch { alert('删除失败') } }
const copyToken = async () => { try { await navigator.clipboard.writeText(newTokenValue.value); alert('已复制') } catch {} }
const getThumbUrl = (img) => { const url = img.thumb_url || img.url; return url ? (config.public.apiBase || '') + url : '' }
const formatSize = (bytes) => { if (!bytes) return '0 B'; if (bytes < 1024) return bytes + ' B'; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / (1024 * 1024)).toFixed(1) + ' MB' }
const formatDate = (value) => value ? new Date(value).toLocaleDateString() : '-'
</script>

<style scoped>
.dashboard-page { max-width: 1240px; }
.dashboard-shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: var(--space-xl); align-items: start; }
.dashboard-sidebar { position: sticky; top: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-lg); }
.profile-block { display: flex; gap: var(--space-md); align-items: center; padding: var(--space-md); border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); background: white; }
.profile-block h1 { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
.profile-block span { font-size: 12px; color: var(--fluent-text-secondary); }
.avatar-mark { width: 42px; height: 42px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; background: var(--fluent-blue); color: white; font-weight: 700; }
.dashboard-nav { display: flex; flex-direction: column; gap: 4px; padding: 6px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); background: white; }
.nav-item { display: flex; align-items: center; gap: var(--space-sm); padding: 9px 10px; border: none; background: transparent; border-radius: var(--radius-sm); color: var(--fluent-text); cursor: pointer; text-align: left; font-size: 14px; }
.nav-item:hover { background: var(--fluent-hover); }
.nav-item.active { background: var(--fluent-blue-light); color: var(--fluent-blue); font-weight: 600; }
.nav-icon { width: 22px; text-align: center; font-family: monospace; }
.dashboard-content { min-width: 0; }
.panel-section { display: flex; flex-direction: column; gap: var(--space-lg); }
.content-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); }
.header-title-row { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }
.content-header h2 { font-size: 22px; font-weight: 600; margin: 0; }
.stats-row { display: grid; grid-template-columns: repeat(4, minmax(140px, 1fr)); gap: var(--space-md); }
.stat-card { text-align: center; padding: var(--space-lg); }
.stat-value { font-size: 24px; font-weight: 700; color: var(--fluent-blue); }
.stat-label { font-size: 13px; color: var(--fluent-text-secondary); margin-top: 4px; }
.quick-actions { display: flex; gap: var(--space-md); flex-wrap: wrap; }
.action-card { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-lg); text-decoration: none; color: var(--fluent-text); min-width: 180px; }
.action-icon { font-size: 20px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: var(--fluent-blue-light); color: var(--fluent-blue); border-radius: var(--radius-sm); font-weight: 700; }
.action-label { font-size: 14px; font-weight: 500; }
.management-panel { padding: var(--space-lg); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); gap: var(--space-md); }
.section-actions { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }
.section-header h3 { font-size: 17px; font-weight: 600; margin: 0; }
.image-toolbar, .manual-filters { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-lg); }
.source-pill { padding: 6px 12px; border-radius: var(--radius-sm); background: var(--fluent-blue-light); color: var(--fluent-blue); font-size: 12px; font-weight: 600; }
.multi-toggle.active { background: var(--fluent-blue-light); color: var(--fluent-blue); border-color: var(--fluent-blue); }
.inline-count { margin-left: 0; }
.more-filters { margin-bottom: var(--space-lg); padding: var(--space-md); border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); background: var(--fluent-hover); }
.more-filters > label { display: block; font-size: 13px; font-weight: 600; margin-bottom: var(--space-sm); }
.batch-bar { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-lg); padding: var(--space-sm) var(--space-md); border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); background: #f8fbff; }
.fluent-select { padding: 7px 10px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); background: white; font-size: 13px; }
.search-input { width: 220px; }
.image-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.image-row { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm); border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); }
.image-row.selected { border-color: var(--fluent-blue); background: var(--fluent-blue-light); }
.row-checkbox { width: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.row-thumb { width: 64px; height: 64px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; background: var(--fluent-hover); }
.row-thumb img { width: 100%; height: 100%; object-fit: cover; }
.row-main { flex: 1; min-width: 0; }
.row-title { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row-meta { font-size: 12px; color: var(--fluent-text-secondary); }
.row-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.tag-mini { font-size: 11px; padding: 1px 6px; background: var(--fluent-blue-light); color: var(--fluent-blue); border-radius: 8px; }
.row-actions { display: flex; gap: 6px; align-items: center; }
.compact-actions { justify-content: flex-end; white-space: nowrap; }
.public-toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--fluent-text-secondary); cursor: pointer; }
.public-toggle input { margin: 0; }
.delete-btn { color: #d13438; }
.delete-btn:hover { background: #fde7e9; }
.pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-md); padding-top: var(--space-lg); font-size: 13px; color: var(--fluent-text-secondary); }
.empty-msg { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
.tabs { display: flex; gap: 2px; background: var(--fluent-hover); border-radius: var(--radius-sm); padding: 2px; width: fit-content; }
.compact-tabs { margin-bottom: 0; }
.tab-btn { padding: 8px 18px; border: none; background: transparent; border-radius: var(--radius-sm); cursor: pointer; font-size: 14px; }
.tab-btn.active { background: white; box-shadow: var(--shadow-1); font-weight: 600; }
.tag-table { border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); overflow: hidden; }
.private-table-header, .private-table-row { display: grid; grid-template-columns: 34px 1fr 1fr 90px 1.2fr 160px; gap: var(--space-sm); padding: 9px 14px; align-items: center; }
.private-table-header { background: var(--fluent-hover); font-size: 13px; font-weight: 600; }
.private-table-row { border-top: 1px solid var(--fluent-border); font-size: 13px; }
.mutual-summary { color: var(--fluent-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mutual-picker { display: flex; flex-wrap: wrap; gap: 6px; padding: var(--space-sm); border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); background: var(--fluent-hover); }
.mutual-chip { padding: 4px 10px; border: 1px solid var(--fluent-border); border-radius: 12px; background: white; font-size: 12px; cursor: pointer; }
.mutual-chip.selected { background: var(--fluent-blue); border-color: var(--fluent-blue); color: white; }
.empty-inline { font-size: 12px; color: var(--fluent-text-secondary); }
.manual-grid { display: grid; grid-template-columns: repeat(auto-fill, 216px); gap: var(--space-md); align-items: start; }
.manual-card { width: 216px; cursor: pointer; border: 2px solid transparent; border-radius: var(--radius-sm); padding: var(--space-sm); transition: all var(--transition-fast); box-sizing: border-box; }
.manual-card:hover { border-color: var(--fluent-border); }
.manual-card.selected { border-color: var(--fluent-blue); background: var(--fluent-blue-light); }
.manual-thumb { width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; background: var(--fluent-hover); border-radius: var(--radius-sm); overflow: hidden; position: relative; }
.manual-thumb img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; }
.check-mark { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; background: var(--fluent-blue); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; }
.manual-name { width: 200px; margin-top: var(--space-xs); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.selected-count { margin-left: auto; font-size: 13px; color: var(--fluent-blue); font-weight: 500; }
.selected-count.inline-count { margin-left: 0; }
.manual-action { margin-top: var(--space-xl); padding-top: var(--space-xl); border-top: 1px solid var(--fluent-border); display: flex; flex-direction: column; gap: var(--space-md); }
.overwrite-toggle { width: fit-content; }
.token-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.token-item, .album-row { display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) 0; border-bottom: 1px solid var(--fluent-border); }
.token-info, .album-row > div { display: flex; flex-direction: column; gap: 3px; }
.account-grid { display: grid; grid-template-columns: repeat(2, minmax(280px, 1fr)); gap: var(--space-lg); }
.account-panel h3 { font-size: 17px; font-weight: 600; margin: 0 0 var(--space-lg); }
.account-row { display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) 0; border-bottom: 1px solid var(--fluent-border); font-size: 14px; }
.account-row span { color: var(--fluent-text-secondary); }
.password-btn { width: 100%; }
.password-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.account-msg { margin-top: var(--space-md); margin-bottom: 0; }
.error-msg { color: #d13438; font-size: 13px; }
.token-label { font-weight: 500; font-size: 14px; }
.token-date, .album-row span { font-size: 12px; color: var(--fluent-text-secondary); }
.new-token-box { margin-top: var(--space-lg); padding: var(--space-md); background: #fff4ce; border-radius: var(--radius-sm); }
.new-token-box code { display: block; word-break: break-all; font-size: 12px; margin: var(--space-sm) 0; }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.inline-check label { display: flex; align-items: center; gap: 6px; }
.fluent-input { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 420px; padding: var(--space-xl); max-height: 82vh; overflow-y: auto; }
.wide-modal { width: 560px; }
.modal h3 { margin-bottom: var(--space-lg); }
.edit-preview { display: flex; gap: var(--space-md); align-items: center; margin-bottom: var(--space-lg); padding-bottom: var(--space-lg); border-bottom: 1px solid var(--fluent-border); }
.edit-preview img { width: 80px; height: 80px; object-fit: cover; border-radius: var(--radius-sm); }
.modal-actions { display: flex; gap: var(--space-md); justify-content: flex-end; margin-top: var(--space-lg); }
@media (max-width: 900px) {
  .dashboard-shell { grid-template-columns: 1fr; }
  .dashboard-sidebar { position: static; }
  .dashboard-nav { flex-direction: row; flex-wrap: wrap; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .row-actions { flex-wrap: wrap; justify-content: flex-end; }
  .manual-grid { grid-template-columns: repeat(auto-fill, minmax(216px, 1fr)); }
  .manual-card { justify-self: center; }
  .account-grid { grid-template-columns: 1fr; }
  .modal, .wide-modal { width: min(92vw, 560px); }
}
</style>
