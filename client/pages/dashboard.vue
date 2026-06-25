<template>
  <div class="dashboard-page page-container">
    <div class="dashboard-header">
      <h1 class="page-title">我的仪表盘</h1>
      <span class="user-role" v-if="user">{{ user.username }} · {{ user.role === 'admin' ? '管理员' : '用户' }}</span>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="fluent-card stat-card">
        <div class="stat-value">{{ myStats.images || 0 }}</div>
        <div class="stat-label">我的图片</div>
      </div>
      <div class="fluent-card stat-card">
        <div class="stat-value">{{ formatSize(myStats.storage || 0) }}</div>
        <div class="stat-label">已用存储</div>
      </div>
    </div>

    <!-- 快捷操作 -->
    <div class="quick-actions">
      <NuxtLink to="/upload" class="fluent-card action-card">
        <span class="action-icon">+</span>
        <span class="action-label">上传图片</span>
      </NuxtLink>
      <NuxtLink to="/api-docs" class="fluent-card action-card">
        <span class="action-icon">{ }</span>
        <span class="action-label">API 接口</span>
      </NuxtLink>
    </div>

    <!-- 我的 API Token -->
    <div class="section fluent-card">
      <div class="section-header">
        <h2>我的 API Token</h2>
        <button class="fluent-btn fluent-btn-primary" @click="showTokenModal = true">生成新 Token</button>
      </div>
      <div v-if="myTokens.length > 0" class="token-list">
        <div v-for="t in myTokens" :key="t.id" class="token-item">
          <div class="token-info">
            <span class="token-label">{{ t.label || '未命名' }}</span>
            <span class="token-date">{{ new Date(t.created_at).toLocaleDateString() }}</span>
          </div>
          <button class="fluent-btn fluent-btn-secondary" @click="deleteToken(t.id)">删除</button>
        </div>
      </div>
      <div v-else class="empty-msg">暂无 Token。生成 Token 后可用于 API 调用。</div>

      <div v-if="newTokenValue" class="new-token-box">
        <p>新 Token（请妥善保存，仅显示一次）：</p>
        <code>{{ newTokenValue }}</code>
        <button class="fluent-btn fluent-btn-secondary" @click="copyToken">复制</button>
      </div>
    </div>

    <!-- 我的标签 -->
    <div class="section fluent-card">
      <div class="section-header">
        <h2>我的标签</h2>
        <button class="fluent-btn fluent-btn-primary" @click="showTagModal = true">新建标签</button>
      </div>
      <p class="desc">私有标签仅自己可见，用于分类自己的图片。公共标签由管理员管理。</p>
      <div v-if="myTags.length > 0" class="my-tags-list">
        <div v-for="tag in myTags" :key="tag.id" class="my-tag-item">
          <span class="tag-badge">{{ tag.display_name || tag.name }}</span>
          <span class="tag-meta">{{ tag.combinable ? '可组合' : '互斥' }}</span>
          <button class="fluent-btn fluent-btn-secondary delete-btn" @click="deleteMyTag(tag)">删除</button>
        </div>
      </div>
      <div v-else class="empty-msg">暂无私有标签</div>
    </div>

    <!-- 我的图片管理 -->
    <div class="section">
      <div class="section-header">
        <h2>我的图片</h2>
        <NuxtLink to="/upload" class="fluent-btn fluent-btn-secondary">上传更多</NuxtLink>
      </div>
      <div class="my-images-list">
        <div v-for="img in myImages" :key="img.id" class="my-image-item">
          <div class="my-img-thumb">
            <img :src="getThumbUrl(img)" loading="lazy" />
          </div>
          <div class="my-img-info">
            <p class="my-img-name">{{ img.filename }}</p>
            <p class="my-img-meta">{{ img.width }}×{{ img.height }}</p>
          </div>
          <div class="my-img-actions">
            <label class="public-toggle">
              <input type="checkbox" :checked="img.is_public" @change="togglePublic(img)" />
              <span>公共</span>
            </label>
            <button class="fluent-btn fluent-btn-secondary" @click="navigateTo(`/image/${img.id}`)">查看</button>
            <button class="fluent-btn fluent-btn-secondary delete-btn" @click="deleteMyImage(img)">删除</button>
          </div>
        </div>
      </div>
      <div v-if="myImages.length === 0 && !loading" class="empty-msg">
        暂无图片
        <NuxtLink to="/upload" class="fluent-btn fluent-btn-primary" style="margin-top: 16px;">上传第一张图片</NuxtLink>
      </div>
      <div class="pagination" v-if="myTotal > 20">
        <button class="fluent-btn fluent-btn-secondary" :disabled="myPage <= 1" @click="loadMyImages(myPage - 1)">上一页</button>
        <span>第 {{ myPage }} 页</span>
        <button class="fluent-btn fluent-btn-secondary" :disabled="myImages.length < 20" @click="loadMyImages(myPage + 1)">下一页</button>
      </div>
    </div>

    <!-- 生成 Token 弹窗 -->
    <div v-if="showTokenModal" class="modal-overlay" @click.self="showTokenModal = false">
      <div class="modal fluent-card">
        <h3>生成 API Token</h3>
        <div class="form-group">
          <label>Token 名称</label>
          <input v-model="tokenLabel" class="fluent-input" placeholder="例如：我的网站" />
        </div>
        <div class="modal-actions">
          <button class="fluent-btn fluent-btn-primary" @click="createToken">生成</button>
          <button class="fluent-btn fluent-btn-secondary" @click="showTokenModal = false">取消</button>
        </div>
      </div>
    </div>

    <!-- 新建标签弹窗 -->
    <div v-if="showTagModal" class="modal-overlay" @click.self="showTagModal = false">
      <div class="modal fluent-card">
        <h3>新建私有标签</h3>
        <div class="form-group">
          <label>标签名称</label>
          <input v-model="newTagName" class="fluent-input" placeholder="例如：风景、人物" />
        </div>
        <div class="form-group">
          <label><input type="checkbox" v-model="newTagCombinable" /> 可组合标签</label>
        </div>
        <div class="modal-actions">
          <button class="fluent-btn fluent-btn-primary" @click="createMyTag">创建</button>
          <button class="fluent-btn fluent-btn-secondary" @click="showTagModal = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const api = useApi()
const config = useRuntimeConfig()
const router = useRouter()

const user = ref(null)
const myImages = ref([])
const myTotal = ref(0)
const myPage = ref(1)
const myStats = ref({ images: 0, storage: 0 })
const loading = ref(true)
const myTokens = ref([])
const showTokenModal = ref(false)
const tokenLabel = ref('')
const newTokenValue = ref('')

// 标签相关
const myTags = ref([])
const showTagModal = ref(false)
const newTagName = ref('')
const newTagCombinable = ref(true)

onMounted(async () => {
  const token = localStorage.getItem('jwt_token')
  if (!token) { router.push('/login'); return }

  try {
    user.value = await api.get('/api/admin/auth/me')
    await loadMyImages()
    await loadTokens()
    await loadMyTags()
  } catch {} finally { loading.value = false }
})

const loadMyImages = async (p = 1) => {
  myPage.value = p
  try {
    const data = await api.get('/api/internal/images', { page: p, limit: 20, mine: 'true' })
    myImages.value = data.images || []
    myTotal.value = data.total || 0
    myStats.value = {
      images: data.total || 0,
      storage: myImages.value.reduce((sum, img) => sum + (img.size_bytes || 0), 0)
    }
  } catch {}
}

const getThumbUrl = (img) => {
  const url = img.thumb_url || img.url
  return url ? `${config.public.apiBase || ''}${url}` : ''
}

const togglePublic = async (img) => {
  try {
    await api.put(`/api/admin/images/${img.id}`, { is_public: !img.is_public })
    img.is_public = !img.is_public
  } catch (err) { alert('操作失败') }
}

const deleteMyImage = async (img) => {
  if (!confirm(`确定删除图片 "${img.filename}"？`)) return
  try {
    await api.del(`/api/admin/images/${img.id}`)
    await loadMyImages(myPage.value)
  } catch (err) { alert('删除失败: ' + (err.data?.error || err.message)) }
}

const loadTokens = async () => {
  try {
    const data = await api.get('/api/admin/api/tokens')
    myTokens.value = data.tokens || []
  } catch {}
}

const createToken = async () => {
  try {
    const data = await api.post('/api/admin/api/tokens', { label: tokenLabel.value, user_id: user.value?.id })
    newTokenValue.value = data.token
    tokenLabel.value = ''
    showTokenModal.value = false
    await loadTokens()
  } catch (err) { alert('创建失败: ' + err.message) }
}

const deleteToken = async (id) => {
  if (!confirm('确定删除此 Token？')) return
  try {
    await api.del(`/api/admin/api/tokens/${id}`)
    await loadTokens()
  } catch (err) { alert('删除失败') }
}

const copyToken = async () => {
  try { await navigator.clipboard.writeText(newTokenValue.value); alert('已复制') } catch {}
}

const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// 标签管理
const loadMyTags = async () => {
  try {
    const data = await api.get('/api/user-tags')
    myTags.value = data.tags || []
  } catch {}
}

const createMyTag = async () => {
  if (!newTagName.value.trim()) return alert('请输入标签名')
  try {
    await api.post('/api/user-tags', {
      name: newTagName.value.trim(),
      display_name: newTagName.value.trim(),
      combinable: newTagCombinable.value
    })
    newTagName.value = ''
    showTagModal.value = false
    await loadMyTags()
  } catch (err) { alert('创建失败: ' + (err.data?.error || err.message)) }
}

const deleteMyTag = async (tag) => {
  if (!confirm(`确定删除标签 "${tag.display_name || tag.name}"？`)) return
  try {
    await api.del(`/api/user-tags/${tag.id}`)
    await loadMyTags()
  } catch (err) { alert('删除失败') }
}
</script>

<style scoped>
.dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-xl); }
.page-title { font-size: 24px; font-weight: 600; }
.user-role { font-size: 13px; color: var(--fluent-text-secondary); background: var(--fluent-hover); padding: 4px 12px; border-radius: 12px; }
.stats-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-md); margin-bottom: var(--space-xl); max-width: 400px; }
.stat-card { text-align: center; padding: var(--space-lg); }
.stat-value { font-size: 24px; font-weight: 700; color: var(--fluent-blue); }
.stat-label { font-size: 13px; color: var(--fluent-text-secondary); margin-top: 4px; }
.quick-actions { display: flex; gap: var(--space-md); margin-bottom: var(--space-xl); }
.action-card { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-lg); text-decoration: none; color: var(--fluent-text); cursor: pointer; transition: all var(--transition-normal); }
.action-card:hover { box-shadow: var(--shadow-2); transform: translateY(-1px); }
.action-icon { font-size: 20px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: var(--fluent-blue-light); color: var(--fluent-blue); border-radius: var(--radius-md); font-weight: 700; }
.action-label { font-size: 14px; font-weight: 500; }
.section { margin-bottom: var(--space-xl); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); }
.section-header h2 { font-size: 18px; font-weight: 600; }
.token-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.token-item { display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) 0; border-bottom: 1px solid var(--fluent-border); }
.token-info { display: flex; align-items: center; gap: var(--space-md); }
.token-label { font-weight: 500; font-size: 14px; }
.token-date { font-size: 12px; color: var(--fluent-text-secondary); }
.new-token-box { margin-top: var(--space-lg); padding: var(--space-md); background: #fff4ce; border-radius: var(--radius-sm); }
.new-token-box p { font-size: 13px; margin-bottom: var(--space-sm); }
.new-token-box code { display: block; word-break: break-all; font-size: 12px; margin-bottom: var(--space-sm); }
.my-images-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.my-image-item { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm); border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); }
.my-img-thumb { width: 48px; height: 48px; border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0; background: var(--fluent-hover); }
.my-img-thumb img { width: 100%; height: 100%; object-fit: cover; }
.my-img-info { flex: 1; min-width: 0; }
.my-img-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.my-img-meta { font-size: 12px; color: var(--fluent-text-secondary); }
.my-img-actions { display: flex; align-items: center; gap: var(--space-sm); }
.public-toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; color: var(--fluent-text-secondary); }
.public-toggle input { margin: 0; }
.delete-btn { color: #d13438; }
.delete-btn:hover { background: #fde7e9; }
.desc { font-size: 13px; color: var(--fluent-text-secondary); margin-bottom: var(--space-md); }
.my-tags-list { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
.my-tag-item { display: flex; align-items: center; gap: var(--space-sm); padding: 4px 8px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); }
.tag-meta { font-size: 11px; color: var(--fluent-text-secondary); }
.pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-md); padding: var(--space-lg) 0; font-size: 13px; color: var(--fluent-text-secondary); }
.empty-msg { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 400px; padding: var(--space-xl); }
.modal h3 { margin-bottom: var(--space-lg); }
.modal-actions { display: flex; gap: var(--space-md); justify-content: flex-end; margin-top: var(--space-lg); }
</style>
