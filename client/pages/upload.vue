<template>
  <div class="upload-page">
    <div v-if="authReady && !isLoggedIn" class="auth-required fluent-card">
      <h2>需要登录</h2>
      <p>登录后才能上传图片</p>
      <NuxtLink to="/login" class="fluent-btn fluent-btn-primary">前往登录</NuxtLink>
    </div>

    <template v-else-if="isLoggedIn">
      <section class="upload-console">
        <div class="upload-tabs">
          <button
            v-for="tab in uploadTabs"
            :key="tab.key"
            class="tab-btn"
            :class="{ active: activeTab === tab.key }"
            type="button"
            @click="activeTab = tab.key"
          >
            <TaotuIcon :name="tab.icon" />
            <span>{{ tab.label }}</span>
          </button>
        </div>

        <template v-if="activeTab === 'file'">
          <div class="upload-drop-card">
            <div
              class="dropzone"
              :class="{ dragover: isDragover }"
              @dragover.prevent="isDragover = true"
              @dragleave="isDragover = false"
              @drop.prevent="handleDrop"
              @click="triggerFileInput"
            >
              <input
                ref="fileInput"
                type="file"
                multiple
                accept="image/*"
                style="display: none"
                @change="handleFileSelect"
              />
              <div class="dropzone-content">
                <TaotuIcon name="upload-cloud" class="dropzone-icon" />
                <p class="dropzone-text">将文件拖拽到这里开始上传</p>
                <p class="dropzone-hint">支持 JPG / PNG / WebP / GIF / AVIF，最大 20MB / 张</p>
                <div class="dropzone-actions">
                  <button type="button" @click.stop="triggerFileInput">点击选择文件</button>
                  <span>或按 Ctrl + V 粘贴截图上传</span>
                </div>
              </div>
            </div>

            <section v-if="selectedFiles.length > 0" class="selected-files-card">
              <header>
                <strong>已选择 {{ selectedFiles.length }} 个文件（共 {{ formatSize(selectedTotalSize) }}）</strong>
                <button type="button" @click="clearFiles">
                  <TaotuIcon name="clear" />
                  清空
                </button>
              </header>
              <div class="selected-file-grid">
                <article v-for="(file, idx) in selectedFiles" :key="file.key" class="selected-file">
                  <button class="remove-file" type="button" @click="removeFile(idx)">×</button>
                  <div class="file-preview">
                    <img v-if="file.preview" :src="file.preview" :alt="file.name" />
                    <span v-else>IMG</span>
                  </div>
                  <strong>{{ file.name }}</strong>
                  <small>{{ formatSize(file.size) }}</small>
                </article>
              </div>
            </section>

            <section class="upload-config-panel">
              <div class="config-row">
                <label>{{ isAdmin ? '上传位置' : '目标相册' }}</label>
                <div v-if="isAdmin" class="admin-album-picker">
                  <div class="picker-field">
                    <span>目标图库</span>
                    <TaotuSelect v-model="albumScope" :options="albumScopeOptions" />
                  </div>
                  <div v-if="albumScope === 'user'" class="picker-field">
                    <span>用户图库</span>
                    <TaotuSelect v-model="targetAlbumUserId" :options="albumUserOptions" />
                  </div>
                  <div class="picker-field">
                    <span>目标相册</span>
                    <TaotuSelect v-model="uploadConfig.albumId" :options="albumOptions" />
                  </div>
                </div>
                <TaotuSelect v-else v-model="uploadConfig.albumId" :options="albumOptions" />
              </div>

              <div class="config-row tags-row">
                <label>{{ isAdmin ? '平台标签' : '私有标签（仅自己可见）' }}</label>
                <div class="tag-config-box">
                  <TagSelector
                    :tags="uploadTagOptions"
                    :selectedTagIds="uploadConfig.tagIds"
                    @update:selectedTagIds="uploadConfig.tagIds = $event"
                  />
                  <div class="new-tag-input">
                    <input
                      v-model="newTagName"
                      :placeholder="isAdmin ? '输入新公共标签名，回车添加' : '输入新私有标签名，回车添加'"
                      @keydown.enter.prevent="addNewTag"
                    />
                    <button v-if="newTagName" type="button" @click="addNewTag">新增标签</button>
                  </div>
                  <div v-if="uploadConfig.newTags.length > 0" class="new-tags-list">
                    <span v-for="(nt, idx) in uploadConfig.newTags" :key="idx">
                      {{ nt }} <button type="button" @click="uploadConfig.newTags.splice(idx, 1)">×</button>
                    </span>
                  </div>
                </div>
              </div>

              <div class="config-row public-row">
                <label>是否公开</label>
                <label class="pretty-check">
                  <input v-model="uploadConfig.isPublic" type="checkbox" />
                  <span class="taotu-checkbox-icon-pair">
                    <TaotuIcon name="checkbox" class="checkbox-unchecked-icon" :stateful="false" />
                    <TaotuIcon name="checkbox-checked" class="checkbox-checked-icon" filled :stateful="false" />
                  </span>
                  公开（所有人可见）
                </label>
              </div>
            </section>

            <footer class="upload-footer">
              <button
                class="start-upload-btn"
                type="button"
                :disabled="selectedFiles.length === 0 || uploading"
                @click="handleUpload"
              >
                {{ uploading ? '上传中' : '开始上传' }}
              </button>
              <div class="progress-wrap">
                <div class="progress-text">
                  <span>{{ uploading ? `上传中 ${uploadProgress}%` : selectedFiles.length ? `待上传 ${selectedFiles.length} 张` : '等待选择文件' }}</span>
                  <span>{{ uploadProgress }}%</span>
                </div>
                <div class="progress-track"><i :style="{ width: `${uploadProgress}%` }"></i></div>
              </div>
              <button class="cancel-upload-btn" type="button" :disabled="!uploading" @click="cancelUpload">取消上传</button>
            </footer>
          </div>
        </template>

        <template v-if="activeTab === 'url'">
          <div class="simple-upload-panel">
            <h3>通过 URL 上传</h3>
            <p>输入图片 URL，每行一个，系统会自动下载并索引。</p>
            <textarea v-model="urlList" rows="8" placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.png"></textarea>
            <button type="button" class="start-upload-btn" :disabled="urlUploading || !urlList.trim()" @click="uploadFromUrls">
              {{ urlUploading ? '上传中...' : '开始上传' }}
            </button>
          </div>
        </template>

        <template v-if="activeTab === 'api'">
          <div class="simple-upload-panel">
            <h3>API 接口上传</h3>
            <p>通过 API 接口上传图片，支持单文件和批量上传。</p>
            <div class="code-block">
              <pre><code>POST /api/upload
Content-Type: multipart/form-data
Authorization: Bearer &lt;your_token&gt;

curl -X POST {{ baseUrl }}/api/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@image.jpg" \
  -F "album_id=1" \
  -F 'tags=[1,2,3]'</code></pre>
            </div>
          </div>
        </template>
      </section>

      <section v-if="uploadRecords.length > 0" class="upload-records-card">
        <header class="records-header">
          <h2>上传结果</h2>
          <div class="records-actions">
            <TaotuSelect v-model="recordStatusFilter" class="status-filter" :options="recordStatusOptions" />
            <button type="button" class="copy-all-btn" :disabled="successRecords.length === 0" @click="copyAllRecordLinks">
              <TaotuIcon name="copy-batch" />
              复制全部链接
            </button>
            <button type="button" class="clear-records-btn" @click="clearUploadRecords">
              <TaotuIcon name="clear" />
              清空记录
            </button>
          </div>
        </header>

        <div class="records-table">
          <div class="records-head">
            <span>文件名</span>
            <span>大小</span>
            <span>状态</span>
            <span>链接（{{ siteName }}）</span>
            <span>错误信息</span>
            <span>存储策略</span>
            <span>操作</span>
            <span>时间</span>
          </div>
          <div v-for="record in filteredUploadRecords" :key="record.key" class="record-row">
            <div class="record-file">
              <img v-if="record.preview" :src="record.preview" alt="" />
              <span v-else class="file-mini-empty"></span>
              <strong>{{ record.filename }}</strong>
            </div>
            <span>{{ record.size ? formatSize(record.size) : '-' }}</span>
            <span class="status-cell" :class="record.success ? 'success' : 'failed'">
              <TaotuIcon :name="record.success ? 'success' : 'failure'" />
              {{ record.success ? '成功' : '失败' }}
            </span>
            <span class="record-link">{{ record.success ? record.url : '-' }}</span>
            <span class="record-error">{{ record.success ? '-' : (record.error || '上传失败') }}</span>
            <span class="record-strategy">{{ record.success ? record.storageStrategyName : '-' }}</span>
            <span class="record-op">
              <button v-if="record.success" type="button" @click="copyLink(record.url)">复制链接</button>
              <button v-else type="button" @click="retryRecord(record)">重试</button>
            </span>
            <span>{{ record.time }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import TagSelector from '~/components/tags/TagSelector.vue'

const config = useRuntimeConfig()
const api = useApi()
const { readAuthPayload, syncAuthCookie } = useUiCache()
const { tags, fetchTags } = useTags()

const getInitialAuthPayload = () => {
  const payload = readAuthPayload()
  if (payload) syncAuthCookie()
  return payload
}
const initialAuthPayload = getInitialAuthPayload()
const isLoggedIn = ref(!!initialAuthPayload)
const isAdmin = ref(initialAuthPayload?.role === 'admin')
const currentUserId = ref(initialAuthPayload?.id || null)
const authReady = ref(!!initialAuthPayload)
const siteName = ref('桃图智库')
const activeTab = ref('file')
const uploadTabs = [
  { key: 'file', label: '文件上传', icon: 'file-upload' },
  { key: 'url', label: 'URL 上传', icon: 'url-upload' },
  { key: 'api', label: 'API 上传', icon: 'api-upload' }
]

const handleAuthInvalid = () => {
  isLoggedIn.value = false
  isAdmin.value = false
  currentUserId.value = null
  authReady.value = true
}

onMounted(async () => {
  try {
    const siteConfig = await api.get('/api/admin/site-config/public')
    siteName.value = siteConfig.siteName || '桃图智库'
  } catch {}
  const payload = readAuthPayload()
  isLoggedIn.value = !!payload
  isAdmin.value = payload?.role === 'admin'
  currentUserId.value = payload?.id || null
  authReady.value = true
  if (isLoggedIn.value) {
    fetchTags()
    fetchAlbums()
    if (isAdmin.value) fetchAlbumUsers()
  }
  window.addEventListener('taotu:auth-invalid', handleAuthInvalid)
  window.addEventListener('paste', handlePaste)
})

onBeforeUnmount(() => {
  window.removeEventListener('taotu:auth-invalid', handleAuthInvalid)
  window.removeEventListener('paste', handlePaste)
  currentXhr.value?.abort()
  selectedFiles.value.forEach(f => URL.revokeObjectURL(f.preview))
  revokeRecordPreviews(uploadRecords.value)
})

const fileInput = ref(null)
const selectedFiles = ref([])
const isDragover = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadRecords = ref([])
const currentXhr = ref(null)
const albums = ref([])
const albumUsers = ref([])
const albumScope = ref('mine')
const targetAlbumUserId = ref(null)
const recordStatusFilter = ref('all')
const recordStatusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' }
]
let recordId = 0

const uploadConfig = reactive({
  albumId: null,
  tagIds: [],
  newTags: [],
  isPublic: false
})

const newTagName = ref('')
const albumScopeOptions = [
  { label: '我的图库', value: 'mine' },
  { label: '全部', value: 'all' },
  { label: '用户图库', value: 'user' }
]
const albumUserOptions = computed(() => albumUsers.value.map(user => ({
  label: user.username,
  value: user.id,
  description: user.role === 'admin' ? '管理员' : '普通用户'
})))
const visibleAlbums = computed(() => {
  if (!isAdmin.value) return albums.value
  if (albumScope.value === 'mine') {
    return albums.value.filter(album => String(album.user_id || '') === String(currentUserId.value || ''))
  }
  if (albumScope.value === 'user') {
    if (!targetAlbumUserId.value) return []
    return albums.value.filter(album => String(album.user_id || '') === String(targetAlbumUserId.value))
  }
  return albums.value
})
const albumOptions = computed(() => [
  { label: '不指定相册', value: null },
  ...visibleAlbums.value.map(album => ({
    label: isAdmin.value && albumScope.value === 'all' && album.owner_name ? `${album.name} · ${album.owner_name}` : album.name,
    value: album.id,
    description: isAdmin.value && albumScope.value !== 'mine' ? (album.owner_name || '系统') : ''
  }))
])
const selectedTotalSize = computed(() => selectedFiles.value.reduce((sum, item) => sum + item.size, 0))
const successRecords = computed(() => uploadRecords.value.filter(record => record.success && record.url))
const filteredUploadRecords = computed(() => {
  if (recordStatusFilter.value === 'success') return uploadRecords.value.filter(record => record.success)
  if (recordStatusFilter.value === 'failed') return uploadRecords.value.filter(record => !record.success)
  return uploadRecords.value
})

const uploadTagOptions = computed(() => {
  const source = tags.value || { combinable: [], nonCombinable: [] }
  const stripSystem = list => (list || []).filter(tag => !tag.isSystemTag)
  if (isAdmin.value) {
    return {
      combinable: stripSystem(source.combinable).filter(tag => !tag.isUserTag),
      nonCombinable: stripSystem(source.nonCombinable).filter(tag => !tag.isUserTag)
    }
  }
  return {
    combinable: stripSystem(source.combinable).filter(tag => tag.isUserTag && !tag.isPublicUserTag),
    nonCombinable: stripSystem(source.nonCombinable).filter(tag => tag.isUserTag && !tag.isPublicUserTag)
  }
})

const addNewTag = () => {
  const name = newTagName.value.trim()
  if (!name) return
  const duplicateNewTag = uploadConfig.newTags.some(tagName => tagName.toLowerCase() === name.toLowerCase())
  if (duplicateNewTag) {
    newTagName.value = ''
    return
  }
  const existing = [
    ...(uploadTagOptions.value.combinable || []),
    ...(uploadTagOptions.value.nonCombinable || [])
  ].find((tag) => {
    const names = [tag.name, tag.display_name, tag.label].filter(Boolean).map(item => String(item).toLowerCase())
    return names.includes(name.toLowerCase())
  })
  if (existing) {
    alert(`${isAdmin.value ? '公共标签' : '私有标签'}名「${name}」已存在，请从已有标签中选择`)
    return
  }
  uploadConfig.newTags.push(name)
  newTagName.value = ''
}

const fetchAlbums = async () => {
  try {
    const api = useApi()
    const data = await api.get(isAdmin.value ? '/api/admin/albums?limit=10000' : '/api/internal/albums?mine=true&limit=10000')
    albums.value = data.albums || []
  } catch (err) {
    console.error('获取相册失败:', err)
  }
}

const fetchAlbumUsers = async () => {
  try {
    const data = await api.get('/api/admin/users?all=true')
    albumUsers.value = data.users || []
  } catch (err) {
    console.error('获取用户列表失败:', err)
  }
}

watch(albumScope, (scope) => {
  uploadConfig.albumId = null
  if (scope === 'user' && !targetAlbumUserId.value && albumUserOptions.value.length > 0) {
    targetAlbumUserId.value = albumUserOptions.value[0].value
  }
})

watch(targetAlbumUserId, () => {
  if (albumScope.value === 'user') uploadConfig.albumId = null
})

watch(albumUserOptions, (options) => {
  if (albumScope.value === 'user' && !targetAlbumUserId.value && options.length > 0) {
    targetAlbumUserId.value = options[0].value
  }
})

const triggerFileInput = () => fileInput.value?.click()

const handleFileSelect = (e) => {
  addFiles(e.target.files)
  e.target.value = ''
}

const handleDrop = (e) => {
  isDragover.value = false
  addFiles(e.dataTransfer.files)
}

const handlePaste = (e) => {
  if (!isLoggedIn.value || activeTab.value !== 'file') return
  const target = e.target
  const isEditable = target?.closest?.('input, textarea, [contenteditable="true"]')
  if (isEditable) return

  const pastedFiles = Array.from(e.clipboardData?.items || [])
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item, idx) => {
      const file = item.getAsFile()
      if (!file) return null
      const ext = (item.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
      return new File([file], `paste-${formatPasteTimestamp(new Date())}-${idx + 1}.${ext}`, { type: file.type })
    })
    .filter(Boolean)

  if (pastedFiles.length > 0) {
    e.preventDefault()
    addFiles(pastedFiles)
  }
}

const fileKey = (file) => [file.name, file.size, file.lastModified].join(':')

const addFiles = (fileList) => {
  const existingKeys = new Set(selectedFiles.value.map(item => item.key))
  for (const file of fileList) {
    if (!file.type.startsWith('image/')) continue
    const key = fileKey(file)
    if (existingKeys.has(key)) continue
    selectedFiles.value.push({
      key,
      file,
      name: file.name,
      size: file.size,
      preview: URL.createObjectURL(file)
    })
    existingKeys.add(key)
  }
}

const removeFile = (idx) => {
  URL.revokeObjectURL(selectedFiles.value[idx].preview)
  selectedFiles.value.splice(idx, 1)
}

const clearFiles = () => {
  selectedFiles.value.forEach(f => URL.revokeObjectURL(f.preview))
  selectedFiles.value = []
  uploadProgress.value = 0
}

const handleUpload = async () => {
  if (selectedFiles.value.length === 0) return
  uploading.value = true
  uploadProgress.value = 0
  const uploadingItems = [...selectedFiles.value]

  try {
    const formData = new FormData()
    uploadingItems.forEach(f => formData.append('files', f.file))
    if (uploadConfig.albumId) formData.append('album_id', uploadConfig.albumId)
    if (uploadConfig.tagIds.length > 0) formData.append('tags', JSON.stringify(uploadConfig.tagIds))
    if (uploadConfig.newTags.length > 0) formData.append('newTags', JSON.stringify(uploadConfig.newTags))
    if (uploadConfig.isPublic) formData.append('is_public', '1')

    const xhr = new XMLHttpRequest()
    currentXhr.value = xhr
    xhr.open('POST', `${config.public.apiBase}/api/upload`)
    const jwt = localStorage.getItem('jwt_token')
    if (jwt) xhr.setRequestHeader('Authorization', `Bearer ${jwt}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) uploadProgress.value = Math.round((e.loaded / e.total) * 100)
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status < 200 || xhr.status >= 300) {
          const message = data.error || data.message || `上传失败 (${xhr.status})`
          appendUploadRecords(buildFailureResults(uploadingItems, message), uploadingItems)
          return
        }
        const results = data.results || buildFailureResults(uploadingItems, '响应中没有上传结果')
        appendUploadRecords(results, uploadingItems)
        removeUploadedSuccessFiles(uploadingItems, results)
      } catch {
        appendUploadRecords(buildFailureResults(uploadingItems, '解析响应失败'), uploadingItems)
      }
      uploading.value = false
      currentXhr.value = null
    }

    xhr.onerror = () => {
      appendUploadRecords(buildFailureResults(uploadingItems, '网络错误'), uploadingItems)
      uploading.value = false
      currentXhr.value = null
    }

    xhr.onabort = () => {
      uploading.value = false
      currentXhr.value = null
    }

    xhr.send(formData)
  } catch (err) {
    appendUploadRecords(buildFailureResults(uploadingItems, err.message), uploadingItems)
    uploading.value = false
    currentXhr.value = null
  }
}

const cancelUpload = () => currentXhr.value?.abort()

const buildFailureResults = (items, error) => items.map(item => ({
  success: false,
  filename: item.name,
  size: item.size,
  error
}))

const buildDisplayUrl = (result) => {
  if (result.source_url) return result.source_url
  if (!result.url) return ''
  if (new RegExp('^https?://').test(result.url)) return result.url
  const base = config.public.apiBase || window.location.origin
  return base.replace(new RegExp('/+$'), '') + result.url
}

const appendUploadRecords = (results, sourceItems = []) => {
  const sourceQueue = [...sourceItems]
  for (const result of results || []) {
    const matched = sourceQueue.find(item => item.name === result.filename) || sourceQueue.shift()
    const url = result.success ? buildDisplayUrl(result) : ''
    const preview = matched?.file ? URL.createObjectURL(matched.file) : (result.thumb_url || '')
    uploadRecords.value.unshift({
      key: `${Date.now()}-${recordId++}`,
      id: result.id,
      filename: result.filename || matched?.name || result.url || 'image',
      size: result.size || matched?.size || 0,
      preview,
      previewObjectUrl: matched?.file ? preview : '',
      success: !!result.success,
      url,
      error: result.error || '',
      storageStrategyName: result.storage_strategy_name || result.storageStrategyName || '默认本地',
      time: formatDateTime(new Date()),
      retryFile: matched || null
    })
  }
}

const revokeRecordPreviews = (records = []) => {
  for (const record of records) {
    if (record.previewObjectUrl) URL.revokeObjectURL(record.previewObjectUrl)
  }
}

const removeUploadedSuccessFiles = (uploadedItems, results) => {
  const successNameCounts = new Map()
  for (const result of results || []) {
    if (!result.success || !result.filename) continue
    successNameCounts.set(result.filename, (successNameCounts.get(result.filename) || 0) + 1)
  }
  if (successNameCounts.size === 0) return
  const successKeys = new Set()
  for (const item of uploadedItems) {
    const remaining = successNameCounts.get(item.name) || 0
    if (remaining <= 0) continue
    successKeys.add(item.key)
    successNameCounts.set(item.name, remaining - 1)
  }
  const kept = []
  for (const item of selectedFiles.value) {
    if (successKeys.has(item.key)) URL.revokeObjectURL(item.preview)
    else kept.push(item)
  }
  selectedFiles.value = kept
}

const retryRecord = (record) => {
  if (!record.retryFile) return
  if (!selectedFiles.value.some(item => item.key === record.retryFile.key)) {
    selectedFiles.value.push(record.retryFile)
  }
}

const clearUploadRecords = () => {
  revokeRecordPreviews(uploadRecords.value)
  uploadRecords.value = []
  recordStatusFilter.value = 'all'
}

const copyLink = async (url) => {
  try { await navigator.clipboard.writeText(url) } catch {}
}

const copyAllRecordLinks = async () => {
  try {
    await navigator.clipboard.writeText(successRecords.value.map(item => item.url).join(String.fromCharCode(10)))
  } catch {}
}

const formatSize = (bytes = 0) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

const formatDateTime = (value) => {
  const date = new Date(value)
  const pad = num => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const formatPasteTimestamp = (value) => {
  const date = new Date(value)
  const pad = num => String(num).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

const urlList = ref('')
const urlUploading = ref(false)

const uploadFromUrls = async () => {
  if (!urlList.value.trim()) return
  urlUploading.value = true
  const urls = urlList.value.split('\n').map(u => u.trim()).filter(u => u)
  const api = useApi()
  for (const url of urls) {
    try {
      const data = await api.post('/api/upload/url', { url })
      appendUploadRecords([{ url, success: true, ...data }])
    } catch (err) {
      appendUploadRecords([{ url, success: false, error: err.data?.error || err.message }])
    }
  }
  urlUploading.value = false
}

const baseUrl = computed(() => config.public.apiBase || window.location.origin)
</script>

<style scoped>
.upload-page {
  width: min(100%, 1490px);
  margin: 0 auto;
}

.auth-required {
  width: min(460px, 100%);
  margin: 80px auto;
  text-align: center;
}

.upload-console,
.upload-records-card,
.simple-upload-panel {
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.68);
  box-shadow: 0 16px 42px rgba(84, 74, 112, 0.1);
  backdrop-filter: blur(24px);
}

.upload-console {
  overflow: hidden;
}

.upload-tabs {
  height: 56px;
  display: flex;
  align-items: stretch;
  gap: 0;
  border-bottom: 1px solid rgba(230, 219, 236, 0.72);
  padding: 0px 20px;
}

.tab-btn {
  position: relative;
  min-width: 146px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: #65708a;
  cursor: pointer;
  font-size: 15px;
  font-weight: 900;
}

.tab-btn .taotu-svg-icon {
  width: 18px;
  height: 18px;
  color: currentColor;
}

.tab-btn:hover {
  color: #000000;
}

.tab-btn.active {
  color: #f54c73;
}

.tab-btn.active .taotu-svg-icon,
.tab-btn:hover .taotu-svg-icon {
  color: currentColor !important;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  left: 20%;
  right: 20%;
  bottom: 0;
  height: 4px;
  border-radius: 999px;
  background: #f54c73;
}

.upload-drop-card {
  padding: 16px;
}

.dropzone {
  min-height: 170px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px dashed rgba(144, 154, 180, 0.42);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.34);
  text-align: center;
  cursor: pointer;
  transition: all 0.18s ease;
  padding: 50px 0;
}

.dropzone:hover,
.dropzone.dragover {
  border-color: rgba(248, 95, 154, 0.62);
  background: rgba(255, 240, 246, 0.72);
}

.dropzone-icon {
  width: 72px;
  height: 72px;
}

.dropzone-text {
  color: #4b566e;
  font-size: 17px;
  font-weight: 900;
  padding: 5px;
}

.dropzone-hint,
.dropzone-actions span {
  color: #8b93a7;
  font-size: 12px;
  font-weight: 800;
  padding: 10px;
}

.dropzone-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 10px;
}

.dropzone-actions button,
.start-upload-btn,
.copy-all-btn {
  border: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, #ff7caf, #f15c96);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

.dropzone-actions button {
  height: 34px;
  padding: 0 18px;
}

.selected-files-card,
.upload-config-panel {
  margin-top: 14px;
  border: 1px solid rgba(230, 219, 236, 0.76);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.48);
}

.selected-files-card {
  padding: 14px 16px;
}

.selected-files-card header,
.records-header,
.records-actions,
.upload-footer,
.status-cell,
.record-file,
.record-op,
.pretty-check,
.copy-all-btn,
.clear-records-btn {
  display: flex;
  align-items: center;
}

.selected-files-card header {
  justify-content: space-between;
  color: #65708a;
  font-size: 14px;
  font-weight: 900;
}

.selected-files-card header button,
.clear-records-btn {
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(248, 95, 154, 0.24);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.56);
  color: #f15c96;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
  padding: 0 12px;
}

.selected-files-card header .taotu-svg-icon,
.copy-all-btn .taotu-svg-icon,
.clear-records-btn .taotu-svg-icon {
  width: 15px;
  height: 15px;
}

.selected-file-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 18px;
  margin-top: 16px;
}

.selected-file {
  position: relative;
  min-width: 0;
}

.file-preview {
  aspect-ratio: 1.44 / 1;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(245, 248, 255, 0.86);
}

.file-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.selected-file strong {
  display: block;
  margin-top: 8px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #65708a;
  font-size: 13px;
  font-weight: 900;
}

.selected-file small {
  color: #9aa3b8;
  font-size: 12px;
  font-weight: 800;
}

.remove-file {
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 2;
  width: 26px;
  height: 26px;
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  background: #fff;
  color: #ff6f96;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.upload-config-panel {
  padding: 14px 16px;
}

.config-row {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  margin-bottom: 14px;
}

.config-row:last-child {
  margin-bottom: 0;
}

.config-row > label,
.config-row > span {
  color: #65708a;
  font-size: 14px;
  font-weight: 900;
}

.admin-album-picker {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
}

.picker-field {
  min-width: 0;
}

.picker-field > span {
  display: block;
  margin-bottom: 6px;
  color: #8b93a7;
  font-size: 12px;
  font-weight: 900;
}

.tag-config-box {
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(230, 219, 236, 0.72);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.44);
}

.new-tag-input {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.new-tag-input input {
  flex: 1;
  height: 32px;
  border: 1px solid rgba(220, 225, 238, 0.82);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.68);
  color: #65708a;
  padding: 0 11px;
  outline: none;
  font-size: 12px;
}

.new-tag-input button,
.new-tags-list span {
  border: 1px solid rgba(174, 151, 255, 0.36);
  border-radius: 8px;
  background: rgba(245, 238, 255, 0.74);
  color: #9f64ec;
  font-size: 13px;
  font-weight: 900;
  padding: 0 12px;
}

.new-tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.new-tags-list span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
}

.new-tags-list button {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.pretty-check {
  gap: 8px;
  color: #65708a;
  font-size: 14px;
  font-weight: 900;
}

.pretty-check input {
  display: none;
}

.pretty-check .taotu-checkbox-icon-pair {
  --checkbox-icon-size: 20px;
  --checkbox-icon-color: rgba(220, 225, 238, 0.95);
  --checkbox-checked-color: #f15c96;
}

.upload-footer {
  gap: 18px;
  margin-top: 14px;
}

.start-upload-btn {
  width: 168px;
  height: 38px;
}

.start-upload-btn:disabled,
.cancel-upload-btn:disabled,
.copy-all-btn:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.progress-wrap {
  flex: 1;
  min-width: 0;
}

.progress-text {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  color: #7d68e8;
  font-size: 14px;
  font-weight: 900;
}

.progress-track {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(220, 225, 238, 0.82);
}

.progress-track i {
  height: 100%;
  display: block;
  border-radius: inherit;
  background: linear-gradient(90deg, #7a8cff, #48d5b4);
  transition: width 0.16s ease;
}

.cancel-upload-btn {
  width: 116px;
  height: 38px;
  border: 1px solid rgba(220, 225, 238, 0.82);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.58);
  color: #65708a;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

.upload-records-card {
  margin-top: 14px;
  overflow: hidden;
}

.records-header {
  justify-content: space-between;
  gap: 16px;
  min-height: 50px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(230, 219, 236, 0.72);
}

.records-header h2 {
  color: #4b566e;
  font-size: 16px;
  font-weight: 900;
}

.records-actions {
  gap: 12px;
}

.status-filter {
  width: 138px;
}

.copy-all-btn {
  height: 34px;
  gap: 7px;
  padding: 0 14px;
  background: rgba(245, 238, 255, 0.86);
  color: #8d6bf2;
}

.clear-records-btn {
  height: 34px;
}

.records-table {
  overflow-x: auto;
}

.records-head,
.record-row {
  display: grid;
  grid-template-columns: minmax(210px, 1.4fr) 110px 110px minmax(320px, 2fr) minmax(240px, 1.4fr) 140px 110px 160px;
  align-items: center;
  min-width: 1500px;
}

.records-head {
  height: 38px;
  padding: 0 16px;
  background: rgba(248, 250, 255, 0.52);
  color: #8b93a7;
  font-size: 13px;
  font-weight: 900;
}

.record-row {
  min-height: 44px;
  padding: 0 16px;
  border-top: 1px solid rgba(230, 219, 236, 0.52);
  color: #8b93a7;
  font-size: 13px;
  font-weight: 800;
}

.record-file {
  min-width: 0;
  gap: 9px;
}

.record-file img,
.file-mini-empty {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 4px;
  object-fit: cover;
  background: rgba(220, 225, 238, 0.82);
}

.record-file strong,
.record-link,
.record-error,
.record-strategy {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.record-file strong {
  color: #65708a;
}

.status-cell {
  gap: 7px;
}

.status-cell .taotu-svg-icon {
  width: 16px;
  height: 16px;
}

.status-cell.success {
  color: #21bd87;
}

.status-cell.failed,
.record-error {
  color: #ff6f96;
}

.record-op button {
  min-width: 74px;
  height: 28px;
  border: 1px solid rgba(174, 151, 255, 0.42);
  border-radius: 7px;
  background: rgba(245, 238, 255, 0.74);
  color: #8d6bf2;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
}

.simple-upload-panel {
  margin: 16px;
  padding: 18px;
}

.simple-upload-panel h3 {
  color: #2f3850;
  font-size: 18px;
  font-weight: 900;
}

.simple-upload-panel p {
  margin: 6px 0 14px;
  color: #8b93a7;
}

.simple-upload-panel textarea {
  width: 100%;
  min-height: 220px;
  border: 1px solid rgba(220, 225, 238, 0.82);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.68);
  color: #65708a;
  outline: none;
  padding: 12px;
  resize: vertical;
}

.code-block {
  padding: 16px;
  overflow-x: auto;
  border-radius: 10px;
  background: rgba(48, 56, 79, 0.94);
  color: #f5f7ff;
}

.code-block pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.65;
}

@media (max-width: 1120px) {
  .selected-file-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .upload-footer,
  .records-header {
    align-items: stretch;
    flex-direction: column;
    padding: 14px 16px;
  }

  .start-upload-btn,
  .cancel-upload-btn {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .upload-tabs {
    height: auto;
    flex-direction: column;
  }

  .tab-btn {
    min-height: 44px;
    border-right: 0;
    border-bottom: 1px solid rgba(230, 219, 236, 0.72);
  }

  .selected-file-grid {
    grid-template-columns: 1fr 1fr;
  }

  .config-row {
    grid-template-columns: 1fr;
  }

  .records-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .status-filter,
  .copy-all-btn,
  .clear-records-btn {
    width: 100%;
  }
}
</style>
