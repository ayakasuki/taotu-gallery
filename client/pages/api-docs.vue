<template>
  <div class="api-docs-page">
    <div class="api-layout">
      <aside class="api-sidebar">
        <div class="panel-title">
          <h1>API 参数配置</h1>
          <span class="help-tip" tabindex="0">
            <TaotuIcon name="warning" />
            <span class="help-popover">未注册用户无需 Token 即可访问公共图库。生成 Token 后可通过 Authorization Header 或 URL 参数 ?tk= 认证访问私有内容。</span>
          </span>
        </div>

        <label class="form-row token-row">
          <span class="config-label">API Token</span>
          <div ref="tokenPickerRef" class="token-picker" :class="{ open: tokenDropdownOpen }">
            <div class="token-input">
              <input
                v-model="apiToken"
                :type="showToken ? 'text' : 'password'"
                placeholder="输入或选择 Token（可选）"
                @focus="openTokenDropdown"
                @input="tokenDropdownOpen = true; debouncedRefresh()"
              />
              <button type="button" class="token-dropdown-btn" title="选择 Token" @click="toggleTokenDropdown">
                <TaotuIcon name="chevron-down" />
              </button>
              <button type="button" title="显示 Token" @click="showToken = !showToken">
                <TaotuIcon :name="showToken ? 'eye-off' : 'eye'" />
              </button>
            </div>
            <div v-if="tokenDropdownOpen" class="token-menu">
              <button
                v-for="token in filteredTokenOptions"
                :key="token.id"
                type="button"
                class="token-option"
                :class="{ selected: apiToken === token.token }"
                :title="`${token.label || `Token #${token.id}`}\n${maskToken(token.token)}`"
                @click="selectToken(token)"
              >
                <span class="token-option-copy">
                  <strong>{{ token.label || `Token #${token.id}` }}</strong>
                  <span>{{ maskToken(token.token) }}</span>
                </span>
                <TaotuIcon v-if="apiToken === token.token" name="success" />
              </button>
              <div v-if="tokenOptions.length === 0" class="token-empty">当前账号暂无 API Token</div>
              <div v-else-if="filteredTokenOptions.length === 0" class="token-empty">没有匹配的 Token</div>
            </div>
          </div>
          <small>提示：Token 仅用于当前会话，不会被保存到服务器</small>
        </label>

        <div class="config-section">
          <span class="config-label">接口端点</span>
          <div class="endpoint-grid">
            <button
              v-for="ep in endpoints"
              :key="ep.key"
              type="button"
              class="endpoint-btn"
              :class="{ active: selectedEndpoint === ep.key }"
              @click="selectedEndpoint = ep.key; onEndpointChange()"
            >
              <TaotuIcon :name="ep.icon" />
              <span>{{ ep.label }}</span>
            </button>
          </div>
        </div>

        <div class="config-section tag-filter-section" v-if="currentEp.showTags">
          <div class="section-head">
            <span class="config-label">标签筛选</span>
            <span v-if="selectedFilterCount > 0">已选筛选 ({{ selectedFilterCount }})</span>
            <button v-if="selectedFilterCount > 0" type="button" @click="clearFilters">清除全部</button>
          </div>
          <div class="important-filter-box">
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
        </div>

        <label class="form-row" v-if="currentEp.showAlbum">
          <span class="config-label">相册选择</span>
          <TaotuSelect v-model="selectedAlbum" :options="albumOptions" @change="debouncedRefresh" />
        </label>

        <div class="form-row count-row" v-if="currentEp.showCount">
          <span class="config-label">返回数量</span>
          <div class="count-control">
            <button type="button" @click="changeCount(-1)">−</button>
            <input v-model.number="randomCount" type="number" min="1" max="100" @input="normalizeCount" />
            <button type="button" @click="changeCount(1)">＋</button>
          </div>
          <span class="range-text">1-100</span>
        </div>

        <div class="form-row switch-row" v-if="selectedEndpoint === 'images-random'">
          <span class="config-label">随机图片使用中等图</span>
          <button type="button" class="pink-switch" :class="{ active: useMedium }" @click="useMedium = !useMedium; debouncedRefresh()">
            <i></i>
          </button>
        </div>

        <label class="form-row" v-if="selectedEndpoint === 'embed-image' || selectedEndpoint === 'embed-album'">
          <span class="config-label">嵌入格式</span>
          <TaotuSelect v-model="embedFormat" :options="embedFormatOptions" @change="debouncedRefresh" />
        </label>

        <label class="form-row" v-if="selectedEndpoint === 'embed-image'">
          <span class="config-label">嵌入尺寸</span>
          <TaotuSelect v-model="embedSize" :options="embedSizeOptions" @change="debouncedRefresh" />
        </label>

        <div v-if="previewError" class="error-banner">
          <TaotuIcon name="config-warning" />
          <span>{{ previewError }}</span>
          <button type="button" @click="previewError = ''">×</button>
        </div>

        <div class="sidebar-actions">
          <button class="reset-btn" type="button" @click="resetConfig">重置</button>
          <button class="send-btn" type="button" @click="fetchPreview(true)">
            <TaotuIcon name="send-request" />
            发送请求
          </button>
        </div>
      </aside>

      <section class="request-panel">
        <header class="result-heading">
          <h2>请求与结果</h2>
          <span class="status-pill" :class="{ loading: previewLoading, error: !!previewError }">
            <TaotuIcon :name="previewLoading ? 'loading' : (previewError ? 'failure' : 'success')" />
            {{ previewLoading ? '请求中' : (previewError ? '请求异常' : '请求成功') }}
          </span>
        </header>

        <div class="url-card">
          <label>生成的 API URL</label>
          <div class="url-box">
            <input :value="generatedUrl" readonly />
            <button class="copy-pink" @click="copyText(generatedUrl)">
              <TaotuIcon name="copy-url" />
              复制 URL
            </button>
          </div>
        </div>

        <div class="result-grid">
          <div class="left-results">
            <article class="mini-result-card">
              <h3>cURL 示例</h3>
              <div class="code-block">
                <pre><code v-html="curlExample"></code></pre>
                <button class="copy-btn-corner" @click="copyText(curlExamplePlain)">
                  <TaotuIcon name="copy" />
                  复制 cURL
                </button>
              </div>
            </article>

            <article class="mini-result-card response-card">
              <h3>响应结构说明</h3>
              <div class="response-code">
                <pre><code>{{ responseStructure }}</code></pre>
              </div>
            </article>
          </div>

          <article class="mini-result-card preview-card">
            <header class="preview-head">
              <h3>实时预览</h3>
              <button class="copy-outline" @click="copyText(previewCopyText)">
                <TaotuIcon name="copy" />
                复制结果
              </button>
            </header>

            <div class="preview-tabs">
              <button type="button" :class="{ active: previewMode === 'images' }" @click="previewMode = 'images'">图片预览</button>
              <button type="button" :class="{ active: previewMode === 'json' }" @click="previewMode = 'json'">JSON 预览</button>
              <button type="button" :class="{ active: previewMode === 'text' }" @click="previewMode = 'text'">文本预览</button>
            </div>

            <div v-if="previewLoading" class="preview-loading">正在请求 API...</div>
            <div v-else-if="previewNoImage" class="preview-empty">
              <TaotuIcon name="search-empty" />
              <span>暂无符合条件的图片</span>
            </div>
            <div v-else-if="previewMode === 'images' && previewImages.length > 0" class="preview-grid">
              <figure v-for="img in visiblePreviewImages" :key="img.id || img.url" class="preview-tile">
                <img :src="previewImageSrc(img)" :alt="img.alt || img.filename || '图片预览'" />
                <figcaption>{{ imageSizeText(img) }}</figcaption>
              </figure>
            </div>
            <div v-else-if="previewMode === 'images' && previewImageUrl" class="single-preview">
              <img :src="previewImageUrl" @error="onImageError" />
            </div>
            <div v-else-if="previewMode === 'json'" class="preview-data">
              <pre><code>{{ previewJsonText }}</code></pre>
            </div>
            <div v-else-if="previewMode === 'text'" class="preview-data">
              <pre><code>{{ previewText || previewJsonText }}</code></pre>
            </div>
            <div v-else class="preview-empty">
              <TaotuIcon name="no-data" />
              <span>点击发送请求获取预览</span>
            </div>

            <button v-if="previewImages.length > visiblePreviewLimit" class="load-more-preview" type="button" @click="visiblePreviewLimit += 9">
              <TaotuIcon name="refresh" />
              加载更多（还有 {{ previewImages.length - visiblePreviewLimit }} 张）
            </button>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ ssr: false })

import TagGroupSelectorFlat from '~/components/tags/TagGroupSelectorFlat.vue'

const config = useRuntimeConfig()
const api = useApi()
const { tags, selectedTagIds, fetchTags } = useTags()

const albums = ref([])
const selectedAlbum = ref(null)
const randomCount = ref(1)
const apiToken = ref('')
const useMedium = ref(true)
const selectedGroupIds = ref([])
const selectedSids = ref([])
const selectedEndpoint = ref('images-random')
const embedFormat = ref('markdown')
const embedSize = ref('medium')
const previewData = ref(null)
const previewImageUrl = ref(null)
const previewText = ref('')
const previewMode = ref('images')
const previewLoading = ref(false)
const previewNoImage = ref(false)
const previewError = ref('')
const showToken = ref(false)
const tokenDropdownOpen = ref(false)
const tokenPickerRef = ref(null)
const tokenOptions = ref([])
const visiblePreviewLimit = ref(9)
const requestSeq = ref(0)

const endpoints = [
  { key: 'images', label: '图片列表', icon: 'image-list', showTags: true, showAlbum: true, showCount: true },
  { key: 'images-random', label: '随机图片', icon: 'random-image', showTags: true, showAlbum: true, showCount: true },
  { key: 'albums', label: '相册列表', icon: 'album-list', showTags: false, showAlbum: false, showCount: true },
  { key: 'albums-random', label: '随机相册', icon: 'random-album', showTags: false, showAlbum: false, showCount: true },
  { key: 'embed-image', label: '图片嵌入', icon: 'embed-image', showTags: true, showAlbum: false, showCount: false },
  { key: 'embed-album', label: '相册嵌入', icon: 'embed-album', showTags: false, showAlbum: false, showCount: false },
  { key: 'tags', label: '标签列表', icon: 'tag-list', showTags: false, showAlbum: false, showCount: false }
]

const currentEp = computed(() => endpoints.find(e => e.key === selectedEndpoint.value) || endpoints[0])
const albumOptions = computed(() => [
  { label: '全部相册', value: null },
  ...albums.value.map(album => ({ label: album.name, value: album.id }))
])
const embedFormatOptions = [
  { label: '源地址', value: 'source' },
  { label: 'HTML', value: 'html' },
  { label: 'BBCode', value: 'bbcode' },
  { label: 'Markdown', value: 'markdown' }
]
const embedSizeOptions = [
  { label: '缩略图', value: 'thumb' },
  { label: '中图（1280px）', value: 'medium' },
  { label: '完整图', value: 'full' }
]
const selectedFilterCount = computed(() => selectedGroupIds.value.length + selectedSids.value.length + selectedTagIds.value.length)
const previewImages = computed(() => extractPreviewImages(previewData.value))
const visiblePreviewImages = computed(() => previewImages.value.slice(0, visiblePreviewLimit.value))
const previewJsonText = computed(() => previewData.value ? JSON.stringify(previewData.value, null, 2) : '')
const previewCopyText = computed(() => previewMode.value === 'text' ? (previewText.value || previewJsonText.value) : previewJsonText.value)
const filteredTokenOptions = computed(() => {
  const keyword = apiToken.value.trim().toLowerCase()
  if (!keyword) return tokenOptions.value
  return tokenOptions.value.filter(token => {
    return String(token.label || '').toLowerCase().includes(keyword) || String(token.token || '').toLowerCase().includes(keyword)
  })
})

const generatedUrl = computed(() => {
  const base = import.meta.client ? window.location.origin : 'http://localhost'
  const params = new URLSearchParams()
  if (selectedGroupIds.value.length > 0) params.set('tag_g', selectedGroupIds.value.join(','))
  if (selectedSids.value.length > 0) params.set('sid', selectedSids.value.join(','))
  if (selectedTagIds.value.length > 0) params.set('tags', selectedTagIds.value.join(','))
  if (selectedAlbum.value) params.set('album', selectedAlbum.value)
  if (apiToken.value) params.set('tk', apiToken.value)

  switch (selectedEndpoint.value) {
    case 'images':
      params.set('limit', randomCount.value)
      return `${base}/api/images?${params.toString()}`
    case 'images-random':
      params.set('count', randomCount.value)
      if (useMedium.value) params.set('pic', 'md')
      return `${base}/api/images/random?${params.toString()}`
    case 'albums':
      params.set('limit', randomCount.value)
      return `${base}/api/albums?${params.toString()}`
    case 'albums-random':
      params.set('count', randomCount.value)
      return `${base}/api/albums/random?${params.toString()}`
    case 'embed-image':
      params.set('format', embedFormat.value)
      params.set('size', embedSize.value)
      params.set('random', '1')
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
const curlExample = computed(() => `curl -G "${escapeHtml(generatedUrl.value.split('?')[0])}" \\
  -H "Authorization: Bearer ${apiToken.value || tokenPlaceholder}" \\
${curlDataParams.value}`)
const curlExamplePlain = computed(() => `curl -G "${generatedUrl.value.split('?')[0]}" \\
  -H "Authorization: Bearer ${apiToken.value || 'YOUR_TOKEN'}" \\
${curlDataParamsPlain.value}`)
const curlDataParams = computed(() => curlParamLines(true))
const curlDataParamsPlain = computed(() => curlParamLines(false))

const responseStructure = computed(() => {
  if (selectedEndpoint.value === 'images-random' && Number(randomCount.value) === 1) {
    return '// count=1 时直接返回图片二进制\n// Content-Type: image/jpeg 或图片原 mime_type\n// 使用 pic=md 时优先返回中等图'
  }
  if (selectedEndpoint.value === 'images-random') return JSON.stringify({ images: [{ id: 1, filename: '...', url: '/image/...', medium_url: '/thumb/...?s=medium', width: 1920, height: 1080 }] }, null, 2)
  if (selectedEndpoint.value === 'images') return JSON.stringify({ images: [{ id: 1, filename: '...', url: '/image/...', thumb_url: '/thumb/...?s=thumb', medium_url: '/thumb/...?s=medium' }], total: 100, page: 1, limit: 20 }, null, 2)
  if (selectedEndpoint.value === 'albums') return JSON.stringify({ albums: [{ id: 1, name: '...', image_count: 10, cover_image: {} }], total: 5, page: 1 }, null, 2)
  if (selectedEndpoint.value === 'albums-random') return JSON.stringify({ albums: [{ id: 1, name: '...', cover_image: {} }] }, null, 2)
  if (selectedEndpoint.value === 'tags') return JSON.stringify({ combinable: [{ id: 1, name: '...' }], nonCombinable: [] }, null, 2)
  if (selectedEndpoint.value.startsWith('embed-')) return `// 返回 ${embedFormat.value} 格式\n// source 格式返回 JSON；HTML、BBCode、Markdown 返回文本`
  return '{}'
})

let refreshTimer = null
const debouncedRefresh = () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => fetchPreview(false), 500)
}

const onEndpointChange = () => {
  previewData.value = null
  previewText.value = ''
  previewImageUrl.value = null
  previewNoImage.value = false
  previewError.value = ''
  visiblePreviewLimit.value = 9
  randomCount.value = defaultCountForEndpoint(selectedEndpoint.value)
  debouncedRefresh()
}

const defaultCountForEndpoint = (endpoint) => endpoint === 'images-random' ? 1 : 20

const normalizeAssetUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${config.public.apiBase || ''}${url}`
}

const fetchPreview = async (force = false) => {
  requestSeq.value += 1
  const seq = requestSeq.value
  previewLoading.value = true
  previewData.value = null
  previewText.value = ''
  previewImageUrl.value = null
  previewNoImage.value = false
  previewError.value = ''
  visiblePreviewLimit.value = 9

  try {
    const headers = {}
    if (apiToken.value) headers.Authorization = `Bearer ${apiToken.value}`
    const url = withRefreshParam(generatedUrl.value, force ? Date.now() : requestSeq.value)

    if (selectedEndpoint.value === 'images-random' && Number(randomCount.value) === 1) {
      previewImageUrl.value = url
      previewMode.value = 'images'
      return
    }

    if (selectedEndpoint.value.startsWith('embed-') && embedFormat.value !== 'source') {
      const res = await fetch(url, { headers })
      const text = await res.text()
      if (seq !== requestSeq.value) return
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`)
      previewText.value = text
      previewData.value = { format: embedFormat.value, content: text }
      previewMode.value = 'text'
      return
    }

    const data = await $fetch(url, { headers })
    if (seq !== requestSeq.value) return
    previewData.value = data
    previewMode.value = previewImages.value.length > 0 ? 'images' : 'json'
    if (previewImages.value.length === 0 && selectedEndpoint.value.includes('image')) previewNoImage.value = true
  } catch (err) {
    previewError.value = err.data?.error || err.message || '请求失败'
    previewData.value = { error: previewError.value }
    previewMode.value = 'json'
  } finally {
    if (seq === requestSeq.value) previewLoading.value = false
  }
}

const withRefreshParam = (url, value) => {
  const joiner = url.includes('?') ? '&' : '?'
  return `${url}${joiner}_preview=${value}`
}

const onImageError = () => {
  previewLoading.value = false
  previewImageUrl.value = null
  previewNoImage.value = true
}

const extractPreviewImages = (data) => {
  if (!data) return []
  if (Array.isArray(data.images)) return data.images
  if (Array.isArray(data.data?.images)) return data.data.images
  if (data.image) return [data.image]
  if (Array.isArray(data.albums)) return data.albums.map(album => album.cover_image || album.images?.[0]).filter(Boolean)
  return []
}

const previewImageSrc = (img) => normalizeAssetUrl(img.medium_url || img.thumb_url || img.url)
const imageSizeText = (img) => img.width && img.height ? `${img.width} × ${img.height}` : (img.filename || '预览')

const curlParamLines = (html = false) => {
  const query = generatedUrl.value.split('?')[1] || ''
  const params = new URLSearchParams(query)
  const lines = []
  for (const [key, value] of params.entries()) {
    if (key === '_preview') continue
    const escaped = html ? escapeHtml(value) : value
    lines.push(`  --data-urlencode "${key}=${escaped}" \\`)
  }
  return lines.join('\n').replace(/ \\$/, '')
}

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const changeCount = (step) => {
  randomCount.value = Math.max(1, Math.min(100, Number(randomCount.value || 1) + step))
  debouncedRefresh()
}

const normalizeCount = () => {
  randomCount.value = Math.max(1, Math.min(100, Number(randomCount.value || 1)))
  debouncedRefresh()
}

const clearFilters = () => {
  selectedGroupIds.value = []
  selectedSids.value = []
  selectedTagIds.value = []
  debouncedRefresh()
}

const resetConfig = () => {
  apiToken.value = ''
  selectedAlbum.value = null
  randomCount.value = defaultCountForEndpoint(selectedEndpoint.value)
  useMedium.value = true
  embedFormat.value = 'markdown'
  embedSize.value = 'medium'
  clearFilters()
}

const loadTokenOptions = async () => {
  try {
    const data = await api.get('/api/admin/api/tokens')
    tokenOptions.value = (data.tokens || []).filter(token => token.token)
  } catch {
    tokenOptions.value = []
  }
}

const openTokenDropdown = () => {
  tokenDropdownOpen.value = true
  if (tokenOptions.value.length === 0) loadTokenOptions()
}

const toggleTokenDropdown = () => {
  tokenDropdownOpen.value = !tokenDropdownOpen.value
  if (tokenDropdownOpen.value && tokenOptions.value.length === 0) loadTokenOptions()
}

const selectToken = (token) => {
  apiToken.value = token.token || ''
  tokenDropdownOpen.value = false
  debouncedRefresh()
}

const maskToken = (token) => {
  const value = String(token || '')
  if (value.length <= 12) return value
  return `${value.slice(0, 6)}••••••${value.slice(-6)}`
}

const handleTokenPickerPointer = (event) => {
  if (!tokenDropdownOpen.value) return
  if (tokenPickerRef.value?.contains(event.target)) return
  tokenDropdownOpen.value = false
}

const copyText = async (text) => {
  try { await navigator.clipboard.writeText(text || ''); alert('已复制') } catch {
    const ta = document.createElement('textarea'); ta.value = text || ''
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    alert('已复制')
  }
}

onMounted(async () => {
  document.addEventListener('pointerdown', handleTokenPickerPointer)
  await fetchTags()
  try { const d = await api.get('/api/albums'); albums.value = d.albums || [] } catch {}
  await loadTokenOptions()
  fetchPreview(true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleTokenPickerPointer)
  if (refreshTimer) clearTimeout(refreshTimer)
})
</script>

<style scoped>
.api-docs-page {
  width: min(100%, 1508px);
  margin: 0 auto;
}

.api-layout {
  display: grid;
  grid-template-columns: minmax(420px, 520px) minmax(0, 1fr);
  gap: 14px;
  align-items: stretch;
}

.api-layout > * {
  min-width: 0;
}

.api-sidebar,
.request-panel {
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 16px 42px rgba(84, 74, 112, 0.1);
  backdrop-filter: blur(24px);
}

.api-sidebar {
  position: sticky;
  top: 84px;
  align-self: stretch;
  height: 100%;
  padding: 18px 16px;
}

.panel-title,
.result-heading,
.preview-head,
.section-head,
.form-row,
.switch-row,
.count-row {
  display: flex;
  align-items: center;
}

.panel-title {
  gap: 8px;
  margin-bottom: 18px;
}

.panel-title h1,
.result-heading h2 {
  color: #2f3850;
  font-size: 18px;
  font-weight: 900;
}

.help-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  cursor: help;
}

.help-tip .taotu-svg-icon {
  width: 16px;
  height: 16px;
}

.help-popover {
  position: absolute;
  left: 50%;
  top: calc(100% + 10px);
  z-index: 20;
  width: 360px;
  max-width: min(360px, calc(100vw - 48px));
  padding: 12px 14px;
  border: 1px solid rgba(230, 219, 236, 0.92);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 16px 38px rgba(84, 74, 112, 0.16);
  color: #65708a;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.7;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, -4px);
  transition: opacity 0.16s ease, transform 0.16s ease;
  backdrop-filter: blur(18px);
}

.help-tip:hover .help-popover,
.help-tip:focus-visible .help-popover {
  opacity: 1;
  transform: translate(-50%, 0);
}

.config-section,
.form-row {
  margin-bottom: 15px;
}

.form-row {
  display: grid;
  grid-template-columns: 126px minmax(0, 1fr);
  gap: 12px;
}

.token-row small {
  grid-column: 2;
  margin-top: -7px;
  color: #9aa3b8;
  font-size: 12px;
}

.config-label {
  color: #4b566e;
  font-size: 14px;
  font-weight: 900;
}

.token-picker,
.token-input,
.url-box,
.count-control {
  display: flex;
  align-items: center;
  min-width: 0;
}

.token-picker {
  position: relative;
  width: 100%;
}

.token-input,
.url-box input,
.count-control,
:deep(.taotu-select-trigger) {
  border: 1px solid rgba(220, 225, 238, 0.82);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.68);
}

.token-input input,
.url-box input,
.count-control input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #65708a;
  font-size: 14px;
}

.token-input {
  width: 100%;
  height: 32px;
  padding-left: 11px;
}

.token-input button {
  width: 34px;
  height: 30px;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.token-input .taotu-svg-icon {
  width: 16px;
  height: 16px;
}

.token-dropdown-btn .taotu-svg-icon {
  transition: transform 0.16s ease;
}

.token-picker.open .token-dropdown-btn .taotu-svg-icon {
  transform: rotate(180deg);
}

.token-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 25;
  max-height: 221px;
  overflow-y: auto;
  padding: 7px;
  border: 1px solid rgba(202, 204, 210, 0.88);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 16px 38px rgba(84, 74, 112, 0.16);
  backdrop-filter: blur(18px);
  scrollbar-width: thin;
  scrollbar-color: rgba(248, 95, 154, 0.5) rgba(255, 240, 246, 0.7);
}

.token-menu::-webkit-scrollbar {
  width: 4px;
}

.token-menu::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(248, 95, 154, 0.5);
}

.token-menu::-webkit-scrollbar-track {
  border-radius: 999px;
  background: rgba(255, 240, 246, 0.72);
}

.token-option {
  width: 100%;
  min-height: 48px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 15px;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
  border: 2px solid rgba(226, 226, 226, 0.9);
  border-radius: 8px;
  background: rgba(246, 246, 246, 0.76);
  color: rgba(122, 127, 140, 0.56);
  cursor: pointer;
  padding: 6px 9px;
  text-align: left;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition: border-color var(--taotu-transition), background var(--taotu-transition), color var(--taotu-transition), transform var(--taotu-transition), box-shadow var(--taotu-transition);
}

.token-option:last-child {
  margin-bottom: 0;
}

.token-option:hover {
  border-color: rgba(248, 95, 154, 0.82);
  background: rgba(255, 247, 251, 0.94);
  color: var(--taotu-pink);
  transform: translateY(-0.5px);
  box-shadow: 0 6px 14px rgba(248, 95, 154, 0.08);
}

.token-option.selected {
  border-color: rgba(248, 95, 154, 0.95);
  background: rgba(255, 246, 250, 0.98);
  color: #f05b96;
}

.token-option-copy {
  min-width: 0;
  display: grid;
  gap: 1px;
}

.token-option strong {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 15px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-option-copy span,
.token-empty {
  min-width: 0;
  overflow: hidden;
  color: color-mix(in srgb, currentColor 48%, #c8c8c8);
  font-size: 10px;
  font-weight: 850;
  line-height: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-option > .taotu-svg-icon {
  width: 15px;
  height: 15px;
  color: #f05b96;
}

.token-empty {
  padding: 12px 10px;
  text-align: center;
}

.endpoint-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
  margin-top: 10px;
}

.endpoint-btn {
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid rgba(220, 225, 238, 0.82);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.62);
  color: #65708a;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
}

.endpoint-btn.active {
  border-color: rgba(248, 95, 154, 0.55);
  background: rgba(255, 235, 244, 0.74);
  color: #f15c96;
}

.endpoint-btn .taotu-svg-icon {
  width: 18px;
  height: 18px;
}

.section-head {
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-head span:not(.config-label),
.section-head button {
  color: #f15c96;
  font-size: 12px;
  font-weight: 900;
}

.section-head button {
  border: 0;
  background: transparent;
  cursor: pointer;
}

.important-filter-box {
  padding: 12px;
  border: 1px solid rgba(230, 219, 236, 0.86);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.5);
}

.count-row {
  grid-template-columns: 126px 142px auto;
}

.count-control {
  height: 32px;
  overflow: hidden;
}

.count-control button {
  width: 38px;
  height: 100%;
  border: 0;
  background: rgba(249, 250, 254, 0.72);
  color: #65708a;
  cursor: pointer;
  font-size: 18px;
  font-weight: 900;
}

.count-control input {
  height: 100%;
  text-align: center;
}

.range-text {
  align-self: center;
  color: #9aa3b8;
  font-size: 13px;
  font-weight: 800;
}

.switch-row {
  justify-content: space-between;
}

.pink-switch {
  width: 56px;
  height: 30px;
  border: 0;
  border-radius: 999px;
  background: rgba(220, 225, 238, 0.86);
  cursor: pointer;
  padding: 3px;
}

.pink-switch i {
  width: 24px;
  height: 24px;
  display: block;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 4px 12px rgba(60, 54, 82, 0.16);
  transition: transform 0.18s ease;
}

.pink-switch.active {
  background: linear-gradient(135deg, #ff7caf, #f15c96);
}

.pink-switch.active i {
  transform: translateX(26px);
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  margin: 6px 0 16px;
  padding: 0 12px;
  border: 1px solid rgba(255, 99, 139, 0.55);
  border-radius: 8px;
  background: rgba(255, 235, 241, 0.82);
  color: #f15c72;
  font-size: 13px;
  font-weight: 900;
}

.error-banner .taotu-svg-icon {
  width: 16px;
  height: 16px;
}

.error-banner button {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: #f15c72;
  cursor: pointer;
}

.sidebar-actions {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 12px;
  margin-top: 18px;
}

.reset-btn,
.send-btn,
.copy-pink,
.copy-outline,
.load-more-preview {
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

.reset-btn {
  border: 1px solid rgba(220, 225, 238, 0.82);
  background: rgba(255, 255, 255, 0.62);
  color: #7d879d;
}

.send-btn,
.copy-pink {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 0;
  background: linear-gradient(135deg, #ff7caf, #f15c96);
  color: #fff;
}

.send-btn .taotu-svg-icon,
.copy-pink img,
.copy-outline img,
.copy-btn-corner .taotu-svg-icon,
.load-more-preview .taotu-svg-icon {
  width: 15px;
  height: 15px;
}

.request-panel {
  min-width: 0;
  padding: 18px;
}

.result-heading {
  justify-content: space-between;
  margin-bottom: 14px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(221, 250, 235, 0.88);
  color: #20ad79;
  font-size: 13px;
  font-weight: 900;
}

.status-pill.loading {
  background: rgba(226, 244, 255, 0.88);
  color: #3d9fd5;
}

.status-pill.error {
  background: rgba(255, 235, 241, 0.88);
  color: #f15c72;
}

.status-pill .taotu-svg-icon {
  width: 15px;
  height: 15px;
}

.url-card,
.mini-result-card {
  border: 1px solid rgba(230, 219, 236, 0.7);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.46);
  box-shadow: 0 8px 24px rgba(80, 70, 110, 0.05);
}

.url-card {
  padding: 14px;
}

.url-card label,
.mini-result-card h3 {
  display: block;
  margin-bottom: 10px;
  color: #4b566e;
  font-size: 14px;
  font-weight: 900;
}

.url-box {
  gap: 10px;
}

.url-box input {
  height: 38px;
  padding: 0 12px;
}

.copy-pink {
  flex: 0 0 106px;
  height: 38px;
}

.result-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.82fr) minmax(0, 1.18fr);
  gap: 12px;
  margin-top: 12px;
  min-width: 0;
}

.left-results {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.mini-result-card {
  min-width: 0;
  padding: 14px;
  overflow: hidden;
}

.code-block,
.response-code,
.preview-data pre {
  border: 1px solid rgba(220, 225, 238, 0.72);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.68);
  color: #596278;
}

.code-block {
  position: relative;
  min-height: 168px;
  padding: 14px;
  overflow: auto;
}

.code-block pre,
.response-code pre,
.preview-data pre {
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.62;
}

.copy-btn-corner {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  border: 0;
  border-radius: 7px;
  background: linear-gradient(135deg, #ff7caf, #f15c96);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 900;
  padding: 0 12px;
}

.response-code {
  min-height: 326px;
  max-height: 420px;
  overflow: auto;
  padding: 14px;
}

.token-highlight {
  color: #22af76;
  font-weight: 900;
}

.preview-card {
  min-height: 650px;
}

.preview-head {
  gap: 10px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.preview-head h3 {
  margin-bottom: 0;
}

.copy-outline {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 13px;
  border: 1px solid rgba(248, 95, 154, 0.42);
  background: rgba(255, 255, 255, 0.54);
  color: #f15c96;
}

.preview-tabs {
  display: flex;
  width: fit-content;
  max-width: 100%;
  overflow: hidden;
  margin-bottom: 14px;
  border: 1px solid rgba(220, 225, 238, 0.82);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.58);
}

.preview-tabs button {
  min-width: 0;
  flex: 1 1 92px;
  height: 36px;
  padding: 0 12px;
  border: 0;
  border-right: 1px solid rgba(220, 225, 238, 0.82);
  background: transparent;
  color: #7d879d;
  cursor: pointer;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
}

.preview-tabs button:last-child {
  border-right: 0;
}

.preview-tabs button.active {
  background: rgba(255, 235, 244, 0.78);
  color: #f15c96;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.preview-tile,
.single-preview {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background: #fff;
}

.preview-tile {
  aspect-ratio: 1.18 / 1;
}

.preview-tile img,
.single-preview img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.preview-tile figcaption {
  position: absolute;
  left: 7px;
  bottom: 7px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(31, 36, 50, 0.45);
  color: #fff;
  font-size: 11px;
  font-weight: 900;
  backdrop-filter: blur(10px);
}

.single-preview {
  height: 535px;
  max-width: 100%;
}

.single-preview img {
  object-fit: scale-down;
}

.preview-data {
  position: relative;
}

.preview-data pre {
  width: 100%;
  min-height: 420px;
  max-height: 620px;
  overflow: auto;
  padding: 14px;
}

.preview-loading,
.preview-empty {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #8b93a7;
  font-weight: 900;
}

.preview-empty .taotu-svg-icon {
  width: 96px;
  height: 96px;
}

.load-more-preview {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 14px;
  border: 1px solid rgba(220, 225, 238, 0.82);
  background: rgba(255, 255, 255, 0.58);
  color: #7d879d;
}

@media (max-width: 1280px) {
  .api-layout,
  .result-grid {
    grid-template-columns: 1fr;
  }

  .api-sidebar {
    position: static;
    height: auto;
  }
}

@media (max-width: 720px) {
  .api-sidebar,
  .request-panel {
    padding: 14px;
  }

  .form-row,
  .count-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .token-row small {
    grid-column: 1;
  }

  .endpoint-grid,
  .preview-grid {
    grid-template-columns: 1fr 1fr;
  }

  .url-box {
    flex-direction: column;
    align-items: stretch;
  }

  .copy-pink {
    flex-basis: auto;
    width: 100%;
  }
}
</style>
