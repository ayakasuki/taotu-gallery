<template>
  <div class="api-docs-page page-container">
    <h1 class="page-title">API 接口</h1>
    <div class="api-notice">
      <span>说明：未注册用户或未生成 API Token，无需 API Token 即可访问公共图库，但无法调用他人或自己图库的私有图片。生成 Token 后可通过 Authorization Header 或 URL 参数 ?tk= 进行认证访问。</span>
    </div>

    <div class="api-layout">
      <!-- 左侧配置面板 -->
      <div class="api-sidebar fluent-card">
        <h3>参数配置</h3>

        <!-- API Token -->
        <div class="config-section">
          <label class="config-label">API Token</label>
          <input v-model="apiToken" class="fluent-input" placeholder="输入 API Token（可选）" />
        </div>

        <!-- 端点选择 -->
        <div class="config-section">
          <label class="config-label">接口端点</label>
          <select v-model="selectedEndpoint" class="fluent-select">
            <option v-for="ep in endpoints" :key="ep.key" :value="ep.key">{{ ep.label }}</option>
          </select>
        </div>

        <!-- 标签选择 -->
        <div class="config-section" v-if="showTagSelector">
          <label class="config-label">标签筛选</label>
          <TagSelector :tags="tags" :selectedTagIds="selectedTagIds" @update:selectedTagIds="selectedTagIds = $event" />
        </div>

        <!-- 相册选择 -->
        <div class="config-section" v-if="showAlbumSelector">
          <label class="config-label">相册</label>
          <select v-model="selectedAlbum" class="fluent-select">
            <option :value="null">全部相册</option>
            <option v-for="album in albums" :key="album.id" :value="album.id">{{ album.name }}</option>
          </select>
        </div>

        <!-- 模式选择 -->
        <div class="config-section" v-if="showModeSelector">
          <label class="config-label">展示模式</label>
          <div class="radio-group">
            <label><input type="radio" v-model="apiMode" value="fixed" /> 固定列表</label>
            <label><input type="radio" v-model="apiMode" value="random" /> 随机</label>
          </div>
        </div>

        <!-- 随机数量 -->
        <div class="config-section" v-if="apiMode === 'random'">
          <label class="config-label">随机数量</label>
          <input v-model.number="randomCount" type="number" min="1" max="50" class="fluent-input" />
        </div>

        <!-- 中等图选项 -->
        <div class="config-section" v-if="selectedEndpoint === 'images-random'">
          <label class="checkbox-label">
            <input type="checkbox" v-model="useMedium" /> 中等图（减少带宽）
          </label>
          <p class="form-hint">勾选后返回中等尺寸图片，参数 pic=md</p>
        </div>

        <!-- 嵌入格式 -->
        <div class="config-section" v-if="selectedEndpoint === 'embed-image' || selectedEndpoint === 'embed-album'">
          <label class="config-label">嵌入格式</label>
          <select v-model="embedFormat" class="fluent-select">
            <option value="source">源地址</option>
            <option value="html">HTML</option>
            <option value="bbcode">BBCode</option>
            <option value="markdown">Markdown</option>
          </select>
        </div>

        <!-- 嵌入尺寸 -->
        <div class="config-section" v-if="selectedEndpoint === 'embed-image'">
          <label class="config-label">图片尺寸</label>
          <select v-model="embedSize" class="fluent-select">
            <option value="thumb">缩略图</option>
            <option value="medium">中等</option>
            <option value="full">完整</option>
          </select>
        </div>
      </div>

      <!-- 右侧结果面板 -->
      <div class="api-main">
        <!-- 生成的 API URL -->
        <div class="fluent-card">
          <h3>API 地址</h3>
          <div class="url-box">
            <code>{{ generatedUrl }}</code>
            <button class="copy-btn fluent-btn fluent-btn-primary" @click="copyText(generatedUrl)">复制</button>
          </div>
        </div>

        <!-- 调用方法 -->
        <div class="fluent-card">
          <h3>调用方法</h3>
          <div class="code-block">
            <pre><code v-html="curlExample"></code></pre>
            <button class="copy-btn-corner" @click="copyText(curlExamplePlain)">复制</button>
          </div>
        </div>

        <!-- 返回参数预览 -->
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
            <button class="fluent-btn fluent-btn-secondary refresh-btn" @click="fetchPreview" :disabled="previewLoading">
              {{ previewLoading ? '加载中...' : '刷新' }}
            </button>
          </h3>
          <div v-if="previewLoading" class="preview-loading">正在请求 API...</div>
          <div v-else-if="previewData" class="preview-data">
            <pre><code>{{ JSON.stringify(previewData, null, 2) }}</code></pre>
            <button class="copy-btn-corner" @click="copyText(JSON.stringify(previewData, null, 2))">复制</button>
          </div>
          <div v-else class="preview-empty">点击"刷新"获取实时数据</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import TagSelector from '~/components/tags/TagSelector.vue'

const config = useRuntimeConfig()
const api = useApi()
const { tags, selectedTagIds, fetchTags } = useTags()

const albums = ref([])
const selectedAlbum = ref(null)
const apiMode = ref('random')
const randomCount = ref(1)
const apiToken = ref('')
const useMedium = ref(true)
const selectedEndpoint = ref('images-random')
const embedFormat = ref('html')
const embedSize = ref('thumb')
const previewData = ref(null)
const previewLoading = ref(false)

const endpoints = [
  { key: 'images', label: '图片列表', showTags: true, showAlbum: true, showMode: false },
  { key: 'images-random', label: '随机图片', showTags: true, showAlbum: true, showMode: false },
  { key: 'albums', label: '相册列表', showTags: false, showAlbum: false, showMode: false },
  { key: 'albums-random', label: '随机相册', showTags: false, showAlbum: false, showMode: false },
  { key: 'embed-image', label: '图片嵌入', showTags: false, showAlbum: false, showMode: false },
  { key: 'embed-album', label: '相册嵌入', showTags: false, showAlbum: false, showMode: false },
  { key: 'tags', label: '标签列表', showTags: false, showAlbum: false, showMode: false }
]

const currentEndpoint = computed(() => endpoints.find(e => e.key === selectedEndpoint.value) || endpoints[0])
const showTagSelector = computed(() => currentEndpoint.value.showTags)
const showAlbumSelector = computed(() => currentEndpoint.value.showAlbum)
const showModeSelector = computed(() => currentEndpoint.value.showMode)

const generatedUrl = computed(() => {
  // 自动使用当前访问域名
  const base = import.meta.client ? window.location.origin : (config.public.apiBase || '')
  const ep = selectedEndpoint.value
  const params = new URLSearchParams()

  if (selectedTagIds.value.length > 0) params.set('tags', selectedTagIds.value.join(','))
  if (selectedAlbum.value) params.set('album', selectedAlbum.value)

  switch (ep) {
    case 'images':
      return `${base}/api/images?${params.toString()}`
    case 'images-random':
      params.set('count', randomCount.value)
      if (useMedium.value) params.set('pic', 'md')
      return `${base}/api/images/random?${params.toString()}`
    case 'albums':
      return `${base}/api/albums`
    case 'albums-random':
      return `${base}/api/albums/random`
    case 'embed-image':
      params.set('format', embedFormat.value)
      params.set('size', embedSize.value)
      if (apiMode.value === 'random') params.set('random', '1')
      return `${base}/api/embed/image?${params.toString()}`
    case 'embed-album':
      params.set('format', embedFormat.value)
      if (apiMode.value === 'random') params.set('random', '1')
      return `${base}/api/embed/album?${params.toString()}`
    case 'tags':
      return `${base}/api/tags`
    default:
      return `${base}/api/images`
  }
})

const tokenPlaceholder = '<span class="token-highlight">YOUR_TOKEN</span>'

const curlExample = computed(() => {
  const url = generatedUrl.value
  return `# 方式一：通过 Authorization Header
curl -H "Authorization: Bearer ${tokenPlaceholder}" \\
     "${url}"

# 方式二：通过 URL 参数
curl "${url}${url.includes('?') ? '&' : '?'}tk=${tokenPlaceholder}"`
})

const curlExamplePlain = computed(() => {
  const token = apiToken.value || 'YOUR_TOKEN'
  const url = generatedUrl.value
  return `# 方式一：通过 Authorization Header
curl -H "Authorization: Bearer ${token}" \\
     "${url}"

# 方式二：通过 URL参数
curl "${url}${url.includes('?') ? '&' : '?'}tk=${token}"`
})

const responseStructure = computed(() => {
  const ep = selectedEndpoint.value
  if (ep === 'images' || ep === 'images-random') {
    if (ep === 'images-random') {
      return JSON.stringify({
        '说明': 'count=1 时直接返回图片二进制（Content-Type: image/jpeg），不返回 JSON',
        'count > 1 时返回': {
          images: [{ id: 1, filename: '...', url: '/image/...', width: 1920, height: 1080 }]
        },
        '认证方式二选一': [
          'Authorization: Bearer <token>',
          'URL 参数: ?tk=<token>'
        ]
      }, null, 2)
    }
    return JSON.stringify({
      images: [{
        id: 1, filename: 'example.jpg',
        url: '/image/2026-06-24/abc123.jpg',
        thumb_url: '/thumb/2026-06-24/abc123.jpg?s=thumb',
        width: 1920, height: 1080,
        tags: [{ id: 1, name: 'landscape', display_name: '风景' }]
      }],
      total: 100, page: 1, limit: 20
    }, null, 2)
  }
  if (ep === 'albums' || ep === 'albums-random') {
    return JSON.stringify({
      albums: [{ id: 1, name: '相册名', image_count: 10, tags: [] }],
      total: 5, page: 1, limit: 20
    }, null, 2)
  }
  if (ep === 'tags') {
    return JSON.stringify({
      combinable: [{ id: 1, name: 'landscape', display_name: '风景' }],
      nonCombinable: [{ id: 10, name: 'sfw', display_name: '安全' }],
      all: []
    }, null, 2)
  }
  if (ep.startsWith('embed-')) {
    return embedFormat.value === 'source'
      ? JSON.stringify({ url: 'http://your-domain.com/image/...', image: {} }, null, 2)
      : '// 返回 ' + embedFormat.value + ' 格式的字符串\n' + (embedFormat.value === 'html' ? '<img src="..." />' : embedFormat.value === 'markdown' ? '![](url)' : '[img]url[/img]')
  }
  return '{}'
})

const fetchPreview = async () => {
  previewLoading.value = true
  previewData.value = null
  try {
    const url = generatedUrl.value.replace(config.public.apiBase || '', '')
    const headers = {}
    if (apiToken.value) headers['Authorization'] = `Bearer ${apiToken.value}`
    previewData.value = await api.request(url, { headers })
  } catch (err) {
    previewData.value = { error: err.data?.error || err.message }
  } finally {
    previewLoading.value = false
  }
}

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text)
    alert('已复制')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    alert('已复制')
  }
}

onMounted(async () => {
  await fetchTags()
  try {
    const data = await api.get('/api/albums')
    albums.value = data.albums || []
  } catch {}
})
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-md); }
.api-notice { background: var(--fluent-blue-light); padding: var(--space-md) var(--space-lg); border-radius: var(--radius-sm); margin-bottom: var(--space-xl); font-size: 13px; color: var(--fluent-text); line-height: 1.6; }
.api-layout { display: flex; gap: var(--space-lg); }
.api-sidebar { width: 300px; flex-shrink: 0; position: sticky; top: 72px; align-self: flex-start; }
.api-sidebar h3 { font-size: 16px; font-weight: 600; margin-bottom: var(--space-lg); }
.config-section { margin-bottom: var(--space-lg); }
.config-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); color: var(--fluent-text-secondary); }
.fluent-input, .fluent-select { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; background: white; }
.radio-group { display: flex; flex-direction: column; gap: var(--space-sm); }
.radio-group label { display: flex; align-items: center; gap: 6px; font-size: 14px; cursor: pointer; }
.checkbox-label { display: flex; align-items: center; gap: var(--space-sm); font-size: 14px; cursor: pointer; }
.checkbox-label input { margin: 0; }
.form-hint { font-size: 12px; color: var(--fluent-text-secondary); margin-top: var(--space-xs); }
.api-main { flex: 1; display: flex; flex-direction: column; gap: var(--space-lg); }
.api-main h3 { font-size: 15px; font-weight: 600; margin-bottom: var(--space-md); display: flex; align-items: center; justify-content: space-between; }
.url-box { display: flex; align-items: center; gap: var(--space-md); background: #f5f5f5; padding: var(--space-md); border-radius: var(--radius-sm); overflow-x: auto; }
.url-box code { flex: 1; font-size: 13px; word-break: break-all; }
.copy-btn { flex-shrink: 0; font-size: 12px; padding: 4px 12px; }
.code-block { position: relative; background: #1e1e1e; color: #d4d4d4; padding: var(--space-md); border-radius: var(--radius-sm); overflow-x: auto; }
.code-block pre { margin: 0; font-size: 12px; line-height: 1.6; }
.copy-btn-corner { position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 10px; border-radius: var(--radius-sm); font-size: 11px; cursor: pointer; }
.copy-btn-corner:hover { background: rgba(255,255,255,0.3); }
.token-highlight { color: #4caf50; font-weight: 700; background: rgba(76,175,80,0.15); padding: 1px 4px; border-radius: 3px; }
.refresh-btn { font-size: 12px; padding: 4px 12px; }
.preview-loading, .preview-empty { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
.preview-data { position: relative; }
.preview-data pre { background: #f5f5f5; padding: var(--space-md); border-radius: var(--radius-sm); font-size: 12px; max-height: 500px; overflow: auto; }
@media (max-width: 768px) { .api-layout { flex-direction: column; } .api-sidebar { width: 100%; position: static; } }
</style>
