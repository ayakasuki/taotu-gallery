<template>
  <div class="upload-page page-container">
    <!-- 未登录提示 -->
    <div v-if="!isLoggedIn" class="auth-required fluent-card">
      <h2>需要登录</h2>
      <p>登录后才能上传图片</p>
      <NuxtLink to="/login" class="fluent-btn fluent-btn-primary">前往登录</NuxtLink>
    </div>

    <template v-else>
      <h1 class="page-title">上传图片</h1>

      <!-- 上传模式切换 -->
      <div class="upload-tabs">
        <button v-for="tab in uploadTabs" :key="tab.key" class="tab-btn" :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">{{ tab.label }}</button>
      </div>

      <!-- 文件上传 -->
      <template v-if="activeTab === 'file'">
    <div class="upload-layout">
      <div class="upload-area fluent-card">
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
            <span class="dropzone-icon">+</span>
            <p class="dropzone-text">拖拽文件到此处或点击选择</p>
            <p class="dropzone-hint">支持 JPG、PNG、GIF、WebP、BMP 格式</p>
          </div>
        </div>

        <!-- 文件列表 -->
        <div class="file-list" v-if="selectedFiles.length > 0">
          <div v-for="(file, idx) in selectedFiles" :key="idx" class="file-item">
            <div class="file-preview">
              <img :src="file.preview" v-if="file.preview" />
              <span v-else class="file-icon">IMG</span>
            </div>
            <div class="file-info">
              <p class="file-name">{{ file.name }}</p>
              <p class="file-size">{{ formatSize(file.size) }}</p>
            </div>
            <button class="remove-btn" @click="removeFile(idx)">×</button>
          </div>
        </div>
      </div>

      <div class="upload-config fluent-card">
        <h3 class="config-title">上传配置</h3>

        <div class="config-item">
          <label>目标相册</label>
          <select v-model="uploadConfig.albumId" class="fluent-select">
            <option :value="null">不指定相册</option>
            <option v-for="album in albums" :key="album.id" :value="album.id">
              {{ album.name }}
            </option>
          </select>
        </div>

        <div class="config-item" v-if="isAdmin">
          <label>标签</label>
          <TagSelector
            :tags="tags"
            :selectedTagIds="uploadConfig.tagIds"
            @update:selectedTagIds="uploadConfig.tagIds = $event"
          />
          <div class="new-tag-input">
            <input v-model="newTagName" class="fluent-input" placeholder="输入新标签名，回车添加" @keyup.enter="addNewTag" />
            <button v-if="newTagName" class="fluent-btn fluent-btn-secondary" @click="addNewTag">添加</button>
          </div>
          <div v-if="uploadConfig.newTags.length > 0" class="new-tags-list">
            <span v-for="(nt, idx) in uploadConfig.newTags" :key="idx" class="new-tag-chip">
              {{ nt }} <button @click="uploadConfig.newTags.splice(idx, 1)">×</button>
            </span>
          </div>
        </div>

        <div class="config-item">
          <label><input type="checkbox" v-model="uploadConfig.isPublic" /> 设为公共图片（所有人可见）</label>
        </div>

        <div class="upload-actions">
          <button
            class="fluent-btn fluent-btn-primary upload-btn"
            :disabled="selectedFiles.length === 0 || uploading"
            @click="handleUpload"
          >
            {{ uploading ? `上传中 (${uploadProgress}%)` : `上传 ${selectedFiles.length} 个文件` }}
          </button>
          <button class="fluent-btn fluent-btn-secondary" @click="clearFiles">清空</button>
        </div>

        <!-- 上传结果 -->
        <div class="upload-results" v-if="uploadResults.length > 0">
          <h4>上传结果</h4>
          <div v-for="result in uploadResults" :key="result.id" class="result-item" :class="{ success: result.success, failed: !result.success }">
            <span>{{ result.filename || result.error }}</span>
            <span class="result-status">{{ result.success ? '成功' : '失败' }}</span>
          </div>
        </div>
      </div>
    </div>
      </template>

      <!-- URL上传 -->
      <template v-if="activeTab === 'url'">
        <div class="fluent-card">
          <h3>通过 URL 上传</h3>
          <p class="desc">输入图片 URL，每行一个，系统会自动下载并索引</p>
          <textarea v-model="urlList" class="fluent-textarea" rows="8" placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.png"></textarea>
          <div class="url-actions">
            <button class="fluent-btn fluent-btn-primary" @click="uploadFromUrls" :disabled="urlUploading">
              {{ urlUploading ? '上传中...' : '开始上传' }}
            </button>
          </div>
          <div v-if="urlResults.length > 0" class="upload-results">
            <h4>上传结果</h4>
            <div v-for="(r, idx) in urlResults" :key="idx" class="result-item" :class="{ success: r.success, failed: !r.success }">
              <span>{{ r.url || r.error }}</span>
              <span>{{ r.success ? '成功' : '失败' }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- API上传说明 -->
      <template v-if="activeTab === 'api'">
        <div class="fluent-card">
          <h3>API 接口上传</h3>
          <p class="desc">通过 API 接口上传图片，支持单文件和批量上传</p>

          <div class="api-section">
            <h4>上传接口</h4>
            <div class="code-block">
              <pre><code>POST /api/upload
Content-Type: multipart/form-data
Authorization: Bearer &lt;your_token&gt;

# 单文件上传
curl -X POST {{ baseUrl }}/api/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@image.jpg"

# 批量上传
curl -X POST {{ baseUrl }}/api/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@image1.jpg" \
  -F "files=@image2.png" \
  -F "album_id=1" \
  -F 'tags=[1,2,3]'</code></pre>
            </div>
          </div>

          <div class="api-section">
            <h4>参数说明</h4>
            <table class="param-table">
              <tr><th>参数</th><th>类型</th><th>说明</th></tr>
              <tr><td>files</td><td>File[]</td><td>图片文件，支持多文件</td></tr>
              <tr><td>album_id</td><td>Number</td><td>目标相册 ID（可选）</td></tr>
              <tr><td>tags</td><td>JSON Array</td><td>标签 ID 数组，如 [1,2,3]（可选）</td></tr>
            </table>
          </div>

          <div class="api-section">
            <h4>返回示例</h4>
            <div class="code-block">
              <pre><code>{
  "message": "上传完成: 1 成功, 0 失败",
  "results": [
    {
      "success": true,
      "id": 1,
      "filename": "image.jpg",
      "hash_path": "image/2026-06-24/abc123def456.jpg",
      "url": "/image/2026-06-24/abc123def456.jpg"
    }
  ]
}</code></pre>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import TagSelector from '~/components/tags/TagSelector.vue'

const config = useRuntimeConfig()
const { tags, fetchTags } = useTags()

// 登录检查
const isLoggedIn = ref(false)
const isAdmin = ref(false)
const activeTab = ref('file')
const uploadTabs = [
  { key: 'file', label: '文件上传' },
  { key: 'url', label: 'URL 上传' },
  { key: 'api', label: 'API 上传' }
]

onMounted(() => {
  const token = localStorage.getItem('jwt_token')
  isLoggedIn.value = !!token
  if (isLoggedIn.value) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      isAdmin.value = payload.role === 'admin'
    } catch {}
    if (isAdmin.value) {
      fetchTags()
    }
    fetchAlbums()
  }
})

const fileInput = ref(null)
const selectedFiles = ref([])
const isDragover = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadResults = ref([])
const albums = ref([])

const uploadConfig = reactive({
  albumId: null,
  tagIds: [],
  newTags: [],
  isPublic: false
})

const newTagName = ref('')

const addNewTag = () => {
  const name = newTagName.value.trim()
  if (!name) return
  if (uploadConfig.newTags.includes(name)) return
  uploadConfig.newTags.push(name)
  newTagName.value = ''
}

const fetchAlbums = async () => {
  try {
    const api = useApi()
    const data = await api.get('/api/internal/albums')
    albums.value = data.albums || []
  } catch (err) {
    console.error('获取相册失败:', err)
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (e) => {
  addFiles(e.target.files)
}

const handleDrop = (e) => {
  isDragover.value = false
  addFiles(e.dataTransfer.files)
}

const addFiles = (fileList) => {
  for (const file of fileList) {
    if (!file.type.startsWith('image/')) continue

    const preview = URL.createObjectURL(file)
    selectedFiles.value.push({
      file,
      name: file.name,
      size: file.size,
      preview
    })
  }
}

const removeFile = (idx) => {
  URL.revokeObjectURL(selectedFiles.value[idx].preview)
  selectedFiles.value.splice(idx, 1)
}

const clearFiles = () => {
  selectedFiles.value.forEach(f => URL.revokeObjectURL(f.preview))
  selectedFiles.value = []
  uploadResults.value = []
}

const handleUpload = async () => {
  if (selectedFiles.value.length === 0) return

  uploading.value = true
  uploadProgress.value = 0
  uploadResults.value = []

  try {
    const formData = new FormData()
    selectedFiles.value.forEach(f => formData.append('files', f.file))

    if (uploadConfig.albumId) {
      formData.append('album_id', uploadConfig.albumId)
    }
    if (uploadConfig.tagIds.length > 0) {
      formData.append('tags', JSON.stringify(uploadConfig.tagIds))
    }
    if (uploadConfig.newTags.length > 0) {
      formData.append('newTags', JSON.stringify(uploadConfig.newTags))
    }
    if (uploadConfig.isPublic) {
      formData.append('is_public', '1')
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${config.public.apiBase}/api/upload`)

    const jwt = localStorage.getItem('jwt_token')
    if (jwt) xhr.setRequestHeader('Authorization', `Bearer ${jwt}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100)
      }
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        uploadResults.value = data.results || []
      } catch {
        uploadResults.value = [{ success: false, error: '解析响应失败' }]
      }
      uploading.value = false
    }

    xhr.onerror = () => {
      uploadResults.value = [{ success: false, error: '网络错误' }]
      uploading.value = false
    }

    xhr.send(formData)
  } catch (err) {
    uploadResults.value = [{ success: false, error: err.message }]
    uploading.value = false
  }
}

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// URL 上传
const urlList = ref('')
const urlUploading = ref(false)
const urlResults = ref([])

const uploadFromUrls = async () => {
  if (!urlList.value.trim()) return
  urlUploading.value = true
  urlResults.value = []

  const urls = urlList.value.split('\n').map(u => u.trim()).filter(u => u)
  const api = useApi()

  for (const url of urls) {
    try {
      const data = await api.post('/api/upload/url', { url })
      urlResults.value.push({ url, success: true, ...data })
    } catch (err) {
      urlResults.value.push({ url, success: false, error: err.data?.error || err.message })
    }
  }

  urlUploading.value = false
}

const baseUrl = computed(() => config.public.apiBase || window.location.origin)
</script>

<style scoped>
.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: var(--space-xl);
}

.upload-layout {
  display: flex;
  gap: var(--space-lg);
}

.upload-area {
  flex: 1;
}

.dropzone {
  border: 2px dashed var(--fluent-border);
  border-radius: var(--radius-md);
  padding: var(--space-2xl);
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-normal);
}

.dropzone:hover, .dropzone.dragover {
  border-color: var(--fluent-blue);
  background: var(--fluent-blue-light);
}

.dropzone-icon {
  font-size: 48px;
  color: var(--fluent-text-secondary);
}

.dropzone-text {
  font-size: 16px;
  margin-top: var(--space-md);
}

.dropzone-hint {
  font-size: 13px;
  color: var(--fluent-text-secondary);
  margin-top: var(--space-sm);
}

.file-list {
  margin-top: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.file-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm);
  border: 1px solid var(--fluent-border);
  border-radius: var(--radius-sm);
}

.file-preview {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--fluent-hover);
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-info {
  flex: 1;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
}

.file-size {
  font-size: 12px;
  color: var(--fluent-text-secondary);
}

.remove-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  color: var(--fluent-text-secondary);
}

.remove-btn:hover {
  background: #fde7e9;
  color: #d13438;
}

.upload-config {
  width: 360px;
  flex-shrink: 0;
}

.config-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: var(--space-lg);
}

.config-item {
  margin-bottom: var(--space-lg);
}

.config-item label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: var(--space-sm);
}

.fluent-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--fluent-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: white;
}

.upload-actions {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.new-tag-input { display: flex; gap: var(--space-sm); margin-top: var(--space-sm); }
.new-tag-input .fluent-input { flex: 1; padding: 6px 10px; font-size: 13px; }
.new-tags-list { display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-top: var(--space-sm); }
.new-tag-chip { font-size: 12px; padding: 2px 8px; background: #e6f4ea; color: #107c10; border-radius: 12px; display: flex; align-items: center; gap: 4px; }
.new-tag-chip button { background: none; border: none; cursor: pointer; font-size: 14px; color: #107c10; padding: 0; line-height: 1; }

.upload-btn {
  flex: 1;
}

.upload-results {
  margin-top: var(--space-lg);
  border-top: 1px solid var(--fluent-border);
  padding-top: var(--space-lg);
}

.upload-results h4 {
  font-size: 14px;
  margin-bottom: var(--space-md);
}

.result-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
}

.result-item.success { color: #107c10; }
.result-item.failed { color: #d13438; }

@media (max-width: 768px) {
  .upload-layout {
    flex-direction: column;
  }

  .upload-config {
    width: 100%;
  }
}

.upload-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: var(--space-lg);
  background: var(--fluent-hover);
  border-radius: var(--radius-sm);
  padding: 2px;
  width: fit-content;
}

.tab-btn {
  padding: 8px 20px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  transition: all var(--transition-fast);
}

.tab-btn.active {
  background: white;
  box-shadow: var(--shadow-1);
  font-weight: 500;
}

.desc {
  color: var(--fluent-text-secondary);
  margin-bottom: var(--space-lg);
  font-size: 14px;
}

.fluent-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--fluent-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-family: monospace;
  resize: vertical;
  box-sizing: border-box;
}

.fluent-textarea:focus {
  outline: none;
  border-color: var(--fluent-blue);
}

.url-actions {
  margin-top: var(--space-md);
}

.api-section {
  margin-bottom: var(--space-xl);
}

.api-section h4 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.code-block {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: var(--space-md);
  border-radius: var(--radius-sm);
  overflow-x: auto;
}

.code-block pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}

.param-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.param-table th, .param-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--fluent-border);
}

.param-table th {
  background: var(--fluent-hover);
  font-weight: 600;
}
</style>
