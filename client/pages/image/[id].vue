<template>
  <div class="image-detail page-container">
    <div v-if="image" class="detail-layout">
      <div class="detail-image">
        <div class="image-viewer">
          <img :src="fullImageUrl" :alt="image.filename" />
        </div>
        <div class="size-switcher">
          <button
            v-for="size in sizes"
            :key="size.key"
            class="size-btn"
            :class="{ active: currentSize === size.key }"
            @click="currentSize = size.key"
          >{{ size.label }}</button>
        </div>
      </div>

      <div class="detail-info">
        <h1 class="image-title">{{ image.filename }}</h1>
        <p class="image-uploader" v-if="image.uploader_name">上传者: {{ image.uploader_name }}</p>

        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">尺寸</span>
            <span class="info-value">{{ image.width }} × {{ image.height }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">大小</span>
            <span class="info-value">{{ formatSize(image.size_bytes) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">方向</span>
            <span class="info-value">{{ orientationMap[image.orientation] || '未知' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">浏览</span>
            <span class="info-value">{{ image.view_count }} 次</span>
          </div>
        </div>

        <div class="tags-section" v-if="image.tags && image.tags.length > 0">
          <h3>标签</h3>
          <div class="tag-list">
            <span v-for="tag in image.tags" :key="tag.id" class="tag-badge">
              {{ tag.display_name || tag.name }}
              <span class="tag-source" v-if="tag.source">({{ sourceMap[tag.source] }})</span>
            </span>
          </div>
        </div>

        <div class="embed-section">
          <h3>嵌入代码</h3>
          <div class="embed-tabs">
            <button
              v-for="fmt in embedFormats"
              :key="fmt.key"
              class="embed-tab"
              :class="{ active: currentFormat === fmt.key }"
              @click="currentFormat = fmt.key"
            >{{ fmt.label }}</button>
          </div>
          <div class="embed-code">
            <pre><code>{{ currentEmbedCode }}</code></pre>
            <button class="copy-btn fluent-btn fluent-btn-primary" @click="copyCode">复制</button>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="loading" class="loading-state">加载中...</div>
    <div v-else class="error-state">图片不存在</div>
  </div>
</template>

<script setup>
const route = useRoute()
const config = useRuntimeConfig()

const image = ref(null)
const loading = ref(true)
const currentSize = ref('full')
const currentFormat = ref('html')

const sizes = [
  { key: 'thumb', label: '缩略图' },
  { key: 'medium', label: '中等' },
  { key: 'full', label: '完整' }
]

const embedFormats = [
  { key: 'source', label: '源地址' },
  { key: 'html', label: 'HTML' },
  { key: 'bbcode', label: 'BBCode' },
  { key: 'markdown', label: 'Markdown' }
]

const orientationMap = {
  landscape: '横图',
  portrait: '竖图',
  square: '正方形'
}

const sourceMap = {
  manual: '人工',
  ai: 'AI',
  condition: '条件'
}

const fullImageUrl = computed(() => {
  if (!image.value) return ''
  const url = image.value.url
  return url ? `${config.public.apiBase}${url}` : ''
})

const currentEmbedCode = computed(() => {
  if (!image.value?.embed_codes) return ''
  const sizeCodes = image.value.embed_codes[currentSize.value]
  if (!sizeCodes) return ''
  return sizeCodes[currentFormat.value] || ''
})

const formatSize = (bytes) => {
  if (!bytes) return '未知'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(currentEmbedCode.value)
    alert('已复制到剪贴板')
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = currentEmbedCode.value
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    alert('已复制到剪贴板')
  }
}

onMounted(async () => {
  try {
    const api = useApi()
    const data = await api.get(`/api/images/${route.params.id}`)
    image.value = data
  } catch (err) {
    console.error('获取图片详情失败:', err)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.detail-layout {
  display: flex;
  gap: var(--space-xl);
}

.detail-image {
  flex: 1;
  min-width: 0;
}

.image-viewer {
  background: #1a1a1a;
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
}

.image-viewer img {
  max-width: 100%;
  max-height: 600px;
  object-fit: contain;
}

.size-switcher {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.size-btn {
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--fluent-border);
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  transition: all var(--transition-fast);
}

.size-btn.active {
  background: var(--fluent-blue);
  color: white;
  border-color: var(--fluent-blue);
}

.detail-info {
  width: 360px;
  flex-shrink: 0;
}

.image-title {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: var(--space-xs);
  word-break: break-all;
}

.image-uploader {
  font-size: 13px;
  color: var(--fluent-text-secondary);
  margin-bottom: var(--space-lg);
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 12px;
  color: var(--fluent-text-secondary);
}

.info-value {
  font-size: 14px;
  font-weight: 500;
}

.tags-section, .embed-section {
  margin-bottom: var(--space-lg);
}

.tags-section h3, .embed-section h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.tag-source {
  font-size: 11px;
  opacity: 0.7;
}

.embed-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: var(--space-sm);
  background: var(--fluent-hover);
  border-radius: var(--radius-sm);
  padding: 2px;
}

.embed-tab {
  flex: 1;
  padding: 6px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.embed-tab.active {
  background: white;
  box-shadow: var(--shadow-1);
}

.embed-code {
  position: relative;
}

.embed-code pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: var(--space-md);
  border-radius: var(--radius-sm);
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 12px;
  padding: 4px 12px;
}

.loading-state, .error-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--fluent-text-secondary);
}

@media (max-width: 768px) {
  .detail-layout {
    flex-direction: column;
  }

  .detail-info {
    width: 100%;
  }
}
</style>
