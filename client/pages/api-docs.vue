<template>
  <div class="api-docs-page page-container">
    <h1 class="page-title">API 接口</h1>
    <div class="api-notice">
      <span>说明：未注册用户无需 Token 即可访问公共图库。生成 Token 后可通过 Authorization Header 或 URL 参数 ?tk= 认证访问私有内容。</span>
    </div>

    <div class="api-layout">
      <!-- 左侧配置面板 -->
      <div class="api-sidebar fluent-card">
        <h3>参数配置</h3>

        <div class="config-section">
          <label class="config-label">API Token</label>
          <input v-model="apiToken" class="fluent-input" placeholder="输入 Token（可选）" @input="debouncedRefresh" />
        </div>

        <div class="config-section">
          <label class="config-label">接口端点</label>
          <select v-model="selectedEndpoint" class="fluent-select" @change="onEndpointChange">
            <option v-for="ep in endpoints" :key="ep.key" :value="ep.key">{{ ep.label }}</option>
          </select>
        </div>

        <div class="config-section" v-if="currentEp.showTags">
          <label class="config-label">分组 / 标签筛选</label>
          <TagGroupSelectorFlat
            :tags="tags"
            :selectedGroupIds="selectedGroupIds"
            :selectedSids="selectedSids"
            :selectedTagIds="selectedTagIds"
            @update:selectedGroupIds="selectedGroupIds = $event; debouncedRefresh()"
            @update:selectedSids="selectedSids = $event; debouncedRefresh()"
            @update:selectedTagIds="selectedTagIds = $event; debouncedRefresh()"
          />
        </div>

        <div class="config-section" v-if="currentEp.showAlbum">
          <label class="config-label">相册</label>
          <select v-model="selectedAlbum" class="fluent-select" @change="debouncedRefresh">
            <option :value="null">全部相册</option>
            <option v-for="a in albums" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
        </div>

        <div class="config-section" v-if="currentEp.showCount">
          <label class="config-label">数量</label>
          <input v-model.number="randomCount" type="number" min="1" max="50" class="fluent-input" @input="debouncedRefresh" />
        </div>

        <div class="config-section" v-if="selectedEndpoint === 'images-random'">
          <label class="checkbox-label">
            <input type="checkbox" v-model="useMedium" @change="debouncedRefresh" /> 中等图（减少带宽）
          </label>
        </div>

        <div class="config-section" v-if="selectedEndpoint === 'embed-image' || selectedEndpoint === 'embed-album'">
          <label class="config-label">嵌入格式</label>
          <select v-model="embedFormat" class="fluent-select" @change="debouncedRefresh">
            <option value="source">源地址</option>
            <option value="html">HTML</option>
            <option value="bbcode">BBCode</option>
            <option value="markdown">Markdown</option>
          </select>
        </div>

        <div class="config-section" v-if="selectedEndpoint === 'embed-image'">
          <label class="config-label">图片尺寸</label>
          <select v-model="embedSize" class="fluent-select" @change="debouncedRefresh">
            <option value="thumb">缩略图</option>
            <option value="medium">中等</option>
            <option value="full">完整</option>
          </select>
        </div>
      </div>

      <!-- 右侧结果面板 -->
      <div class="api-main">
        <div class="fluent-card">
          <h3>API 地址</h3>
          <div class="url-box">
            <code>{{ generatedUrl }}</code>
            <button class="copy-btn fluent-btn fluent-btn-primary" @click="copyText(generatedUrl)">复制</button>
          </div>
        </div>

        <div class="fluent-card">
          <h3>调用方法</h3>
          <div class="code-block">
            <pre><code v-html="curlExample"></code></pre>
            <button class="copy-btn-corner" @click="copyText(curlExamplePlain)">复制</button>
          </div>
        </div>

        <div class="fluent-card">
          <h3>返回参数结构</h3>
          <div class="code-block">
            <pre><code>{{ responseStructure }}</code></pre>
          </div>
        </div>

        <!-- 实时预览 -->
        <div class="fluent-card">
          <h3>
            实时预览
            <span v-if="previewLoading" class="loading-text">加载中...</span>
          </h3>
          <!-- 图片预览（随机图片 count=1 时） -->
          <div v-if="previewImageUrl" class="image-preview">
            <img :src="previewImageUrl" @load="previewLoading = false" @error="onImageError" />
          </div>
          <div v-else-if="previewNoImage" class="preview-empty">暂无符合条件的图片</div>
          <!-- JSON 预览 -->
          <div v-else-if="previewData" class="preview-data">
            <pre><code>{{ JSON.stringify(previewData, null, 2) }}</code></pre>
            <button class="copy-btn-corner" @click="copyText(JSON.stringify(previewData, null, 2))">复制</button>
          </div>
          <div v-else-if="previewLoading" class="preview-loading">正在请求 API...</div>
          <div v-else class="preview-empty">参数变动后自动预览</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ ssr: false })

import TagSelector from '~/components/tags/TagSelector.vue'
import TagGroupSelectorFlat from '~/components/tags/TagGroupSelectorFlat.vue'

const config = useRuntimeConfig()
const api = useApi()
const { tags, selectedTagIds, fetchTags } = useTags()

const albums = ref([])
const selectedAlbum = ref(null)
const randomCount = ref(1)
const apiToken = ref('')
const useMedium = ref(true)
const tagGroups = ref([])
const selectedGroupIds = ref([])
const selectedSids = ref([])
const selectedSubName = ref('')
const selectedEndpoint = ref('images-random')
const embedFormat = ref('html')
const embedSize = ref('thumb')
const previewData = ref(null)
const previewImageUrl = ref(null)
const previewLoading = ref(false)
const previewNoImage = ref(false)

const endpoints = [
  { key: 'images', label: '图片列表', showTags: true, showAlbum: true, showCount: false },
  { key: 'images-random', label: '随机图片', showTags: true, showAlbum: true, showCount: true },
  { key: 'albums', label: '相册列表', showTags: false, showAlbum: false, showCount: false },
  { key: 'albums-random', label: '随机相册', showTags: false, showAlbum: false, showCount: true },
  { key: 'embed-image', label: '图片嵌入', showTags: true, showAlbum: false, showCount: false },
  { key: 'embed-album', label: '相册嵌入', showTags: false, showAlbum: false, showCount: false },
  { key: 'tags', label: '标签列表', showTags: false, showAlbum: false, showCount: false }
]

const currentEp = computed(() => endpoints.find(e => e.key === selectedEndpoint.value) || endpoints[0])

// 生成 URL（含 token 拼接）
const generatedUrl = computed(() => {
  const base = import.meta.client ? window.location.origin : 'http://localhost'
  const ep = selectedEndpoint.value
  const params = new URLSearchParams()

  // 分组/子分组/标签筛选（叠加）
  if (selectedGroupIds.value.length > 0) params.set('tag_g', selectedGroupIds.value.join(','))
  if (selectedSids.value.length > 0) params.set('sid', selectedSids.value.join(','))
  if (selectedTagIds.value.length > 0) params.set('tags', selectedTagIds.value.join(','))
  if (selectedAlbum.value) params.set('album', selectedAlbum.value)
  if (apiToken.value) params.set('tk', apiToken.value)

  switch (ep) {
    case 'images':
      return `${base}/api/images?${params.toString()}`
    case 'images-random':
      params.set('count', randomCount.value)
      if (useMedium.value) params.set('pic', 'md')
      return `${base}/api/images/random?${params.toString()}`
    case 'albums':
      return `${base}/api/albums${params.toString() ? '?' + params.toString() : ''}`
    case 'albums-random':
      params.set('count', randomCount.value)
      return `${base}/api/albums/random?${params.toString()}`
    case 'embed-image':
      params.set('format', embedFormat.value)
      params.set('size', embedSize.value)
      params.set('random', '1')
      if (selectedTagIds.value.length > 0) params.set('tags', selectedTagIds.value.join(','))
      return `${base}/api/embed/image?${params.toString()}`
    case 'embed-album':
      params.set('format', embedFormat.value)
      params.set('random', '1')
      return `${base}/api/embed/album?${params.toString()}`
    case 'tags':
      return `${base}/api/tags${params.toString() ? '?' + params.toString() : ''}`
    default:
      return `${base}/api/images`
  }
})

const tokenPlaceholder = '<span class="token-highlight">YOUR_TOKEN</span>'

const curlExample = computed(() => {
  const url = generatedUrl.value
  const token = apiToken.value || 'YOUR_TOKEN'
  return `# 方式一：通过 Authorization Header
curl -H "Authorization: Bearer ${apiToken.value ? token : tokenPlaceholder}" \\
     "${url}"

# 方式二：通过 URL 参数（已自动拼接 tk=）
curl "${url}"`
})

const curlExamplePlain = computed(() => {
  const url = generatedUrl.value
  const token = apiToken.value || 'YOUR_TOKEN'
  return `# 方式一：通过 Authorization Header
curl -H "Authorization: Bearer ${token}" \\
     "${url}"

# 方式二：通过 URL 参数
curl "${url}"`
})

const responseStructure = computed(() => {
  const ep = selectedEndpoint.value
  if (ep === 'images-random') {
    if (randomCount.value === 1) {
      return '// count=1 时直接返回图片二进制 (Content-Type: image/jpeg)\n// 浏览器直接访问 URL 即可预览图片'
    }
    return JSON.stringify({ images: [{ id: 1, filename: '...', url: '/image/...' }] }, null, 2)
  }
  if (ep === 'images') return JSON.stringify({ images: [{ id: 1, filename: '...', url: '/image/...' }], total: 100, page: 1 }, null, 2)
  if (ep === 'albums') return JSON.stringify({ albums: [{ id: 1, name: '...', image_count: 10 }], total: 5 }, null, 2)
  if (ep === 'albums-random') return JSON.stringify({ albums: [{ id: 1, name: '...' }] }, null, 2)
  if (ep === 'tags') return JSON.stringify({ combinable: [{ id: 1, name: '...' }], nonCombinable: [] }, null, 2)
  if (ep.startsWith('embed-')) return '// 返回 ' + embedFormat.value + ' 格式字符串'
  return '{}'
})

// 防抖自动刷新
let refreshTimer = null
const debouncedRefresh = () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(fetchPreview, 500)
}

const onEndpointChange = () => {
  previewData.value = null
  previewImageUrl.value = null
  previewNoImage.value = false
  debouncedRefresh()
}

const onImageError = () => {
  previewLoading.value = false
  previewImageUrl.value = null
  previewNoImage.value = true
}

const onTagChange = (ids) => {
  selectedTagIds.value = ids
  debouncedRefresh()
}

// 获取预览
const fetchPreview = async () => {
  previewLoading.value = true
  previewData.value = null
  previewImageUrl.value = null
  previewNoImage.value = false

  try {
    const ep = selectedEndpoint.value
    const url = generatedUrl.value

    // 随机图片 count=1 时直接返回图片
    if (ep === 'images-random' && randomCount.value === 1) {
      previewImageUrl.value = url
      return
    }

    // 嵌入端点返回 HTML/文本
    if (ep.startsWith('embed-') && embedFormat.value !== 'source') {
      const res = await fetch(url)
      const text = await res.text()
      previewData.value = { format: embedFormat.value, content: text }
      previewLoading.value = false
      return
    }

    // 其他端点返回 JSON
    const headers = {}
    if (apiToken.value) headers['Authorization'] = `Bearer ${apiToken.value}`
    const data = await $fetch(url, { headers })
    previewData.value = data
  } catch (err) {
    previewData.value = { error: err.data?.error || err.message || '请求失败' }
  } finally {
    previewLoading.value = false
  }
}

const copyText = async (text) => {
  try { await navigator.clipboard.writeText(text); alert('已复制') } catch {
    const ta = document.createElement('textarea'); ta.value = text
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    alert('已复制')
  }
}

onMounted(async () => {
  await fetchTags()
  try { const d = await api.get('/api/albums'); albums.value = d.albums || [] } catch {}
  try { const g = await api.get('/api/tag-groups'); tagGroups.value = g.groups || [] } catch {}
  fetchPreview()
})
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-md); }
.api-notice { background: var(--fluent-blue-light); padding: var(--space-md) var(--space-lg); border-radius: var(--radius-sm); margin-bottom: var(--space-xl); font-size: 13px; line-height: 1.6; }
.api-layout { display: flex; gap: var(--space-lg); }
.api-sidebar { width: 300px; flex-shrink: 0; position: sticky; top: 72px; align-self: flex-start; }
.api-sidebar h3 { font-size: 16px; font-weight: 600; margin-bottom: var(--space-lg); }
.config-section { margin-bottom: var(--space-lg); }
.config-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); color: var(--fluent-text-secondary); }
.fluent-input, .fluent-select { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; background: white; }
.fluent-input:focus, .fluent-select:focus { outline: none; border-color: var(--fluent-blue); }
.checkbox-label { display: flex; align-items: center; gap: var(--space-sm); font-size: 14px; cursor: pointer; }
.checkbox-label input { margin: 0; }
.config-divider { border-top: 1px solid var(--fluent-border); margin: var(--space-md) 0; }
.selected-group-info { display: flex; align-items: center; gap: var(--space-sm); padding: 6px 10px; background: var(--fluent-blue-light); border-radius: var(--radius-sm); font-size: 13px; margin-top: var(--space-sm); }
.btn-sm { padding: 3px 8px; font-size: 12px; }
.api-main { flex: 1; display: flex; flex-direction: column; gap: var(--space-lg); }
.api-main h3 { font-size: 15px; font-weight: 600; margin-bottom: var(--space-md); display: flex; align-items: center; justify-content: space-between; }
.loading-text { font-size: 12px; color: var(--fluent-text-secondary); font-weight: 400; }
.url-box { display: flex; align-items: center; gap: var(--space-md); background: #f5f5f5; padding: var(--space-md); border-radius: var(--radius-sm); overflow-x: auto; }
.url-box code { flex: 1; font-size: 13px; word-break: break-all; }
.copy-btn { flex-shrink: 0; font-size: 12px; padding: 4px 12px; }
.code-block { position: relative; background: #1e1e1e; color: #d4d4d4; padding: var(--space-md); border-radius: var(--radius-sm); overflow-x: auto; }
.code-block pre { margin: 0; font-size: 12px; line-height: 1.6; }
.copy-btn-corner { position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 10px; border-radius: var(--radius-sm); font-size: 11px; cursor: pointer; }
.copy-btn-corner:hover { background: rgba(255,255,255,0.3); }
.token-highlight { color: #4caf50; font-weight: 700; background: rgba(76,175,80,0.15); padding: 1px 4px; border-radius: 3px; }
.image-preview { text-align: center; padding: var(--space-md); }
.image-preview img { max-width: 100%; max-height: 400px; border-radius: var(--radius-sm); object-fit: contain; }
.preview-loading, .preview-empty { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
.preview-data { position: relative; }
.preview-data pre { background: #f5f5f5; padding: var(--space-md); border-radius: var(--radius-sm); font-size: 12px; max-height: 500px; overflow: auto; }
@media (max-width: 768px) { .api-layout { flex-direction: column; } .api-sidebar { width: 100%; position: static; } }
</style>
