<template>
  <div class="image-detail">
    <div v-if="image" class="detail-bg">
      <img :src="fullImageUrl" :alt="imageTitle" />
    </div>

    <div v-if="image" class="detail-shell">
      <div class="detail-topbar">
        <div class="topbar-left">
          <NuxtLink to="/" class="soft-back">
            <img src="/icons/image/back-64x64.png" class="detail-icon icon-16" alt="" />
            返回图库
          </NuxtLink>
          <div class="breadcrumb">
            <span>公共图库</span>
            <b>/</b>
            <span>{{ albumName }}</span>
            <b>/</b>
            <span>{{ imageTitle }}</span>
          </div>
        </div>
        <NuxtLink to="/" class="close-page" title="关闭">
          <img src="/icons/image/close-64x64.png" class="detail-icon icon-18" alt="" />
        </NuxtLink>
      </div>

      <div class="size-switcher" aria-label="图片尺寸">
        <button
          v-for="size in sizeOptions"
          :key="size.key"
          class="size-btn"
          :class="{ active: currentSize === size.key }"
          @click="currentSize = size.key"
        >
          <img :src="size.icon" class="detail-icon icon-16" alt="" />
          <span>{{ size.label }}</span>
        </button>
      </div>

      <div class="detail-grid">
        <aside class="thumb-rail">
          <button
            v-for="item in railImages"
            :key="item.id"
            class="thumb-card"
            :class="{ active: Number(item.id) === Number(image.id) }"
            @click="openImage(item.id)"
          >
            <img :src="imageSrc(item.thumb_url || item.medium_url || item.url)" :alt="item.filename || item.alt || '图片'" />
          </button>
          <button class="load-more-thumbs" :disabled="thumbLoading || !thumbHasMore" @click="loadMoreThumbs">
            <img src="/icons/image/load-more-64x64.png" class="detail-icon icon-16" alt="" />
          </button>
        </aside>

        <main class="viewer-column">
          <button class="side-nav prev" :disabled="!prevImage" @click="goSibling(-1)" title="上一张">
            <img src="/icons/image/previous-64x64.png" class="detail-icon icon-22" alt="" />
          </button>
          <section ref="viewerRef" class="image-viewer">
            <img
              :src="currentImageUrl"
              :alt="imageTitle"
              :style="{ transform: `scale(${zoom})` }"
              @dblclick="resetZoom"
            />
          </section>
          <button class="side-nav next" :disabled="!nextImage" @click="goSibling(1)" title="下一张">
            <img src="/icons/image/next-64x64.png" class="detail-icon icon-22" alt="" />
          </button>

          <div class="viewer-actions">
            <button class="action-btn" title="放大" @click="zoomIn">
              <img src="/icons/image/zoom-in-64x64.png" class="detail-icon icon-18" alt="" />
            </button>
            <button class="action-btn" title="缩小" @click="zoomOut">
              <img src="/icons/image/zoom-out-64x64.png" class="detail-icon icon-18" alt="" />
            </button>
            <span class="zoom-text">{{ Math.round(zoom * 100) }}%</span>
            <button class="action-btn" title="重置" @click="resetZoom">
              <img src="/icons/image/reset-64x64.png" class="detail-icon icon-18" alt="" />
            </button>
            <button class="action-btn" title="全屏" @click="toggleFullscreen">
              <img src="/icons/image/fullscreen-64x64.png" class="detail-icon icon-18" alt="" />
            </button>
            <span class="action-separator"></span>
            <button class="action-btn heart" title="收藏">
              <img src="/icons/image/favorite-64x64.png" class="detail-icon icon-18" alt="" />
            </button>
            <button class="action-btn mint" title="下载" @click="downloadImage">
              <img src="/icons/image/download-64x64.png" class="detail-icon icon-18" alt="" />
            </button>
          </div>
        </main>

        <aside class="info-column">
          <section class="detail-card info-card">
            <div class="title-row">
              <h1>{{ imageTitle }}</h1>
              <button class="collect-btn" type="button">
                <img src="/icons/image/favorite-64x64.png" class="detail-icon icon-16" alt="" />
                收藏
              </button>
            </div>
            <dl class="meta-list">
              <div>
                <dt>上传者</dt>
                <dd>
                  <span class="uploader-inline">
                    <img v-if="uploaderAvatarUrl" :src="uploaderAvatarUrl" alt="" />
                    <i v-else>{{ uploaderInitial }}</i>
                    <span>{{ image.uploader_name || '系统导入' }}</span>
                  </span>
                </dd>
              </div>
              <div>
                <dt>尺寸</dt>
                <dd>{{ image.width || '-' }} × {{ image.height || '-' }} px</dd>
              </div>
              <div>
                <dt>文件大小</dt>
                <dd>{{ formatSize(image.size_bytes || image.file_size) }}</dd>
              </div>
              <div>
                <dt>方向</dt>
                <dd>{{ orientationText }}</dd>
              </div>
              <div>
                <dt>浏览次数</dt>
                <dd>{{ image.view_count || 0 }} 次</dd>
              </div>
              <div>
                <dt>上传时间</dt>
                <dd>{{ formatDateTime(image.created_at || image.updated_at) }}</dd>
              </div>
            </dl>
          </section>

          <section class="detail-card tag-card">
            <div class="card-heading two-col">
              <h2>标签</h2>
              <span>来源</span>
            </div>
            <div v-if="visibleTags.length > 0" class="tag-table">
              <div v-for="(tag, index) in visibleTags" :key="tagKey(tag, index)" class="tag-row">
                <span class="pretty-tag" :class="tagTone(index, tag)">
                  <i></i>
                  {{ tag.display_name || tag.name }}
                </span>
                <span class="tag-source">{{ sourceText(tag.source) }}</span>
              </div>
            </div>
            <div v-else class="empty-tags">暂无标签</div>
            <button v-if="tagList.length > tagPreviewCount" class="view-more" @click="showAllTags = !showAllTags">
              {{ showAllTags ? '收起' : '查看更多' }}
              <img src="/icons/nav/chevron-down-64x64.png" class="detail-icon icon-14" :class="{ rotate: showAllTags }" alt="" />
            </button>
          </section>

          <section class="detail-card embed-card">
            <div class="card-heading">
              <h2>嵌入代码</h2>
            </div>
            <div class="embed-list">
              <label v-for="item in embedRows" :key="item.key" class="embed-row">
                <span>{{ item.label }}</span>
                <div class="copy-field">
                  <input :value="item.value" readonly />
                  <button type="button" @click="copyText(item.value)">
                    <img src="/icons/image/copy-code-64x64.png" class="detail-icon icon-15" alt="" />
                    复制
                  </button>
                </div>
              </label>
            </div>
          </section>
        </aside>
      </div>
    </div>

    <div v-else-if="loading" class="state-card">加载中...</div>
    <div v-else class="state-card">图片不存在</div>
  </div>
</template>

<script setup>
const route = useRoute()
const config = useRuntimeConfig()
const api = useApi()

const image = ref(null)
const loading = ref(true)
const viewerRef = ref(null)
const zoom = ref(1)
const currentSize = ref('full')
const railImages = ref([])
const thumbPage = ref(1)
const thumbTotal = ref(0)
const thumbLoading = ref(false)
const showAllTags = ref(false)
const tagPreviewCount = 5
const thumbPageSize = 6
const sizeOptions = [
  { key: 'thumb', label: '缩略图', icon: '/icons/image/thumbnail-64x64.png' },
  { key: 'medium', label: '中等', icon: '/icons/image/medium-64x64.png' },
  { key: 'full', label: '完整', icon: '/icons/image/full-64x64.png' }
]

const imageTitle = computed(() => image.value?.alt || image.value?.title || image.value?.filename || '图片')
const albumName = computed(() => image.value?.album_name || (image.value?.album_id ? `相册 #${image.value.album_id}` : '全部图片'))
const fullImageUrl = computed(() => imageSrc(image.value?.url))
const uploaderAvatarUrl = computed(() => imageSrc(image.value?.uploader_avatar))
const uploaderInitial = computed(() => (image.value?.uploader_name || 'U').slice(0, 1).toUpperCase())
const currentImageUrl = computed(() => {
  if (!image.value) return ''
  const key = currentSize.value === 'thumb' ? 'thumb_url' : currentSize.value === 'medium' ? 'medium_url' : 'url'
  return imageSrc(image.value[key] || image.value.url)
})
const tagList = computed(() => image.value?.tags || [])
const visibleTags = computed(() => showAllTags.value ? tagList.value : tagList.value.slice(0, tagPreviewCount))
const thumbHasMore = computed(() => railImages.value.length < thumbTotal.value)

const activeIndex = computed(() => railImages.value.findIndex(item => Number(item.id) === Number(image.value?.id)))
const prevImage = computed(() => activeIndex.value > 0 ? railImages.value[activeIndex.value - 1] : null)
const nextImage = computed(() => {
  const idx = activeIndex.value
  return idx >= 0 && idx < railImages.value.length - 1 ? railImages.value[idx + 1] : null
})

const orientationText = computed(() => {
  const map = { landscape: '横图', portrait: '竖图', square: '正方形' }
  if (image.value?.orientation && map[image.value.orientation]) return map[image.value.orientation]
  const width = Number(image.value?.width) || 0
  const height = Number(image.value?.height) || 0
  if (!width || !height) return '未知'
  if (Math.abs(width / height - 1) <= 0.1) return '正方形'
  return width > height ? '横图' : '竖图'
})

const embedRows = computed(() => {
  const codes = image.value?.embed_codes?.full || {}
  const source = codes.source || fullImageUrl.value
  return [
    { key: 'source', label: '源地址（URL）', value: source },
    { key: 'html', label: 'HTML', value: codes.html || `<img src="${source}" alt="${imageTitle.value}" />` },
    { key: 'bbcode', label: 'BBCode', value: codes.bbcode || `[img]${source}[/img]` },
    { key: 'markdown', label: 'Markdown', value: codes.markdown || `![${imageTitle.value}](${source})` }
  ]
})

watch(() => route.params.id, async () => {
  await loadImage()
})

const imageSrc = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${config.public.apiBase || ''}${url}`
}

const loadImage = async () => {
  loading.value = true
  showAllTags.value = false
  resetZoom()
  try {
    image.value = await api.get(`/api/internal/images/${route.params.id}`)
    ensureCurrentInRail()
  } catch (err) {
    console.error('获取图片详情失败:', err)
    image.value = null
  } finally {
    loading.value = false
  }
}

const loadThumbs = async ({ append = false } = {}) => {
  if (thumbLoading.value) return
  thumbLoading.value = true
  try {
    const data = await api.get('/api/internal/images', {
      page: thumbPage.value,
      limit: thumbPageSize,
      sort: 'created_at',
      order: 'desc'
    })
    thumbTotal.value = Number(data.total) || 0
    const incoming = data.images || []
    railImages.value = append ? mergeImages(railImages.value, incoming) : mergeImages(incoming, [])
    ensureCurrentInRail()
  } catch (err) {
    console.error('加载缩略图列表失败:', err)
  } finally {
    thumbLoading.value = false
  }
}

const loadMoreThumbs = async () => {
  if (!thumbHasMore.value || thumbLoading.value) return
  thumbPage.value += 1
  await loadThumbs({ append: true })
}

const mergeImages = (base, extra) => {
  const seen = new Set()
  return [...base, ...extra].filter(item => {
    if (!item?.id || seen.has(Number(item.id))) return false
    seen.add(Number(item.id))
    return true
  })
}

const ensureCurrentInRail = () => {
  if (!image.value) return
  if (!railImages.value.some(item => Number(item.id) === Number(image.value.id))) {
    railImages.value = [image.value, ...railImages.value]
  }
}

const openImage = (id) => {
  if (Number(id) === Number(route.params.id)) return
  navigateTo(`/image/${id}`)
}

const goSibling = (direction) => {
  const target = direction < 0 ? prevImage.value : nextImage.value
  if (target) openImage(target.id)
}

const zoomIn = () => {
  zoom.value = Math.min(3, Number((zoom.value + 0.1).toFixed(2)))
}

const zoomOut = () => {
  zoom.value = Math.max(0.3, Number((zoom.value - 0.1).toFixed(2)))
}

function resetZoom() {
  zoom.value = 1
}

const toggleFullscreen = async () => {
  if (!import.meta.client || !viewerRef.value) return
  try {
    if (!document.fullscreenElement) await viewerRef.value.requestFullscreen()
    else await document.exitFullscreen()
  } catch (err) {
    console.error('全屏切换失败:', err)
  }
}

const downloadImage = () => {
  if (!import.meta.client || !fullImageUrl.value) return
  const link = document.createElement('a')
  link.href = fullImageUrl.value
  link.download = image.value?.filename || 'image'
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text || '')
    alert('已复制')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text || ''
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    alert('已复制')
  }
}

const formatSize = (bytes) => {
  const value = Number(bytes) || 0
  if (!value) return '未知'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(2)} MB`
}

const pad = (value) => String(value).padStart(2, '0')
const formatDateTime = (value) => {
  if (!value) return '未知'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').replace(/\.\d{3}Z$/, '')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const sourceText = (source) => {
  const map = { manual: '人工', ai: 'AI', condition: '条件', user: '用户' }
  return map[source] || source || '人工'
}

const tagKey = (tag, index) => `${tag.source || 'tag'}-${tag.id || tag.name || index}`
const tagTone = (index, tag) => {
  const tones = ['tone-purple', 'tone-pink', 'tone-blue', 'tone-rose', 'tone-violet']
  const seed = Number(tag.id) || index
  return tones[Math.abs(seed) % tones.length]
}

onMounted(async () => {
  await loadThumbs()
  await loadImage()
})
</script>

<style scoped>
.image-detail {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

.detail-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: var(--taotu-bg-gradient);
}

.detail-bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.16);
  filter: blur(46px) saturate(1.1) brightness(1.04);
  opacity: 0.34;
}

.detail-shell {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  padding: 26px clamp(18px, 1.8vw, 34px) 36px;
  background: transparent;
}

.detail-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: min(100%, 1840px);
  margin: 0 auto 18px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.soft-back,
.close-page,
.viewer-actions,
.thumb-rail,
.detail-card {
  border: 1px solid rgba(255,255,255,0.68);
  background: rgba(255,255,255,0.68);
  box-shadow: 0 16px 46px rgba(81, 91, 124, 0.11);
  backdrop-filter: blur(18px) saturate(1.14);
}

.soft-back {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 17px;
  border-radius: 15px;
  color: var(--taotu-text);
  font-size: 14px;
  font-weight: 900;
  white-space: nowrap;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  color: var(--taotu-text-muted);
  font-size: 13px;
  font-weight: 800;
}

.breadcrumb span {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.breadcrumb b {
  color: #b8bfd0;
}

.close-page {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.size-switcher {
  width: fit-content;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  margin: 0 auto 28px;
  padding: 5px;
  border: 1px solid rgba(255,255,255,0.72);
  border-radius: 10px;
  background: rgba(255,255,255,0.68);
  box-shadow: 0 12px 32px rgba(81,91,124,0.1);
  backdrop-filter: blur(18px) saturate(1.14);
}

.size-btn {
  min-width: 88px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--taotu-text-muted);
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.size-btn.active {
  border-color: rgba(248,95,154,0.2);
  background: rgba(255,255,255,0.78);
  color: var(--taotu-pink);
  box-shadow: 0 6px 18px rgba(248,95,154,0.13);
}

.detail-grid {
  display: grid;
  grid-template-columns: 114px minmax(620px, 1fr) 372px;
  column-gap: 78px;
  row-gap: 24px;
  width: min(100%, 1840px);
  margin: 0 auto;
  align-items: start;
}

.thumb-rail {
  min-height: 656px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
}

.thumb-card {
  width: 88px;
  height: 88px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 10px;
  background: rgba(255,255,255,0.72);
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(70,76,106,0.1);
}

.thumb-card img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.thumb-card.active {
  border-color: var(--taotu-pink);
  box-shadow: 0 0 0 3px rgba(248,95,154,0.16), 0 10px 24px rgba(248,95,154,0.18);
}

.load-more-thumbs {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: auto auto 0;
  border: 1px solid rgba(218, 224, 239, 0.86);
  border-radius: 50%;
  background: rgba(255,255,255,0.72);
  cursor: pointer;
}

.load-more-thumbs:disabled {
  opacity: 0.38;
  cursor: default;
}

.viewer-column {
  position: relative;
  min-width: 0;
}

.image-viewer {
  min-height: min(70vh, 760px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: 1px solid rgba(255,255,255,0.78);
  border-radius: 12px;
  background: rgba(255,255,255,0.46);
  box-shadow: 0 16px 46px rgba(81, 91, 124, 0.1);
  overflow: auto;
}

.image-viewer:fullscreen {
  padding: 28px;
  background: rgba(249,251,255,0.96);
}

.image-viewer img {
  max-width: 100%;
  max-height: calc(100vh - 260px);
  display: block;
  object-fit: contain;
  border-radius: 8px;
  transform-origin: center center;
  transition: transform 0.16s ease;
  box-shadow: 0 18px 46px rgba(45, 52, 82, 0.18);
}

.image-viewer:fullscreen img {
  max-height: calc(100vh - 58px);
}

.side-nav {
  position: absolute;
  top: 50%;
  z-index: 5;
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255,255,255,0.7);
  border-radius: 50%;
  background: rgba(255,255,255,0.78);
  box-shadow: 0 12px 28px rgba(72, 80, 110, 0.14);
  cursor: pointer;
  transform: translateY(-50%);
  backdrop-filter: blur(14px);
}

.side-nav.prev {
  left: -60px;
}

.side-nav.next {
  right: -60px;
}

.side-nav:disabled {
  opacity: 0.35;
  cursor: default;
}

.viewer-actions {
  width: fit-content;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 16px auto 0;
  padding: 7px 11px;
  border-radius: 999px;
}

.action-btn {
  width: 31px;
  height: 31px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.action-btn:hover {
  background: rgba(255,240,246,0.8);
}

.action-btn.heart {
  color: var(--taotu-pink);
}

.action-btn.mint {
  color: var(--taotu-mint);
}

.zoom-text {
  min-width: 48px;
  text-align: center;
  color: var(--taotu-text-muted);
  font-size: 12px;
  font-weight: 900;
}

.action-separator {
  width: 1px;
  height: 22px;
  margin: 0 2px;
  background: rgba(210, 218, 235, 0.78);
}

.info-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-card {
  border-radius: 12px;
  padding: 20px;
}

.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.title-row h1 {
  min-width: 0;
  color: var(--taotu-text-strong);
  font-size: 19px;
  line-height: 1.35;
  font-weight: 900;
  word-break: break-word;
}

.collect-btn {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border: 1px solid rgba(238,210,226,0.78);
  border-radius: 8px;
  background: rgba(255,255,255,0.58);
  color: var(--taotu-text-muted);
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.meta-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.meta-list div {
  display: grid;
  grid-template-columns: 82px minmax(0, 1fr);
  gap: 10px;
  align-items: baseline;
}

.meta-list dt,
.meta-list dd,
.card-heading h2,
.card-heading span,
.tag-source {
  font-size: 13px;
  line-height: 1.45;
}

.meta-list dt {
  color: var(--taotu-text-muted);
  font-weight: 800;
}

.meta-list dd {
  min-width: 0;
  color: var(--taotu-text);
  font-weight: 800;
  word-break: break-word;
}

.uploader-inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.uploader-inline img,
.uploader-inline i {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  border-radius: 50%;
}

.uploader-inline img {
  object-fit: cover;
  display: block;
}

.uploader-inline i {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--taotu-pink), var(--taotu-purple));
  color: white;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}

.card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-heading.two-col {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  gap: 12px;
}

.card-heading h2 {
  color: var(--taotu-text-strong);
  font-weight: 900;
}

.card-heading span,
.tag-source {
  color: var(--taotu-text-muted);
  font-weight: 800;
  text-align: right;
}

.tag-table {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.tag-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  gap: 12px;
  align-items: center;
}

.pretty-tag {
  width: fit-content;
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 11px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.45;
}

.pretty-tag i {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: currentColor;
}

.tone-purple {
  color: #9b7cff;
  background: rgba(155,124,255,0.1);
}

.tone-pink {
  color: #f85f9a;
  background: rgba(248,95,154,0.1);
}

.tone-blue {
  color: #6b9cff;
  background: rgba(107,156,255,0.1);
}

.tone-rose {
  color: #ff7ea9;
  background: rgba(255,126,169,0.1);
}

.tone-violet {
  color: #a66cff;
  background: rgba(166,108,255,0.1);
}

.view-more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 11px;
  border: 0;
  background: transparent;
  color: var(--taotu-purple);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.rotate {
  transform: rotate(180deg);
}

.empty-tags {
  color: var(--taotu-text-muted);
  font-size: 13px;
  font-weight: 800;
}

.embed-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.embed-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: var(--taotu-text-muted);
  font-size: 12px;
  font-weight: 900;
}

.copy-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-height: 34px;
  border: 1px solid rgba(218, 224, 239, 0.78);
  border-radius: 9px;
  background: rgba(255,255,255,0.64);
  overflow: hidden;
}

.copy-field input {
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--taotu-text-muted);
  font-size: 12px;
  font-weight: 800;
}

.copy-field button {
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 3px;
  padding: 0 10px;
  border: 0;
  border-left: 1px solid rgba(218, 224, 239, 0.6);
  border-radius: 7px;
  background: rgba(255,255,255,0.72);
  color: var(--taotu-purple);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.detail-icon {
  display: block;
  object-fit: contain;
}

.icon-14 { width: 14px; height: 14px; }
.icon-15 { width: 15px; height: 15px; }
.icon-16 { width: 16px; height: 16px; }
.icon-18 { width: 18px; height: 18px; }
.icon-22 { width: 22px; height: 22px; }

.state-card {
  position: relative;
  z-index: 1;
  width: min(420px, calc(100vw - 32px));
  margin: 20vh auto 0;
  padding: 44px;
  border: 1px solid rgba(255,255,255,0.68);
  border-radius: 16px;
  background: rgba(255,255,255,0.72);
  color: var(--taotu-text);
  text-align: center;
  font-size: 18px;
  font-weight: 900;
  box-shadow: var(--taotu-shadow);
  backdrop-filter: blur(18px);
}

@media (max-width: 1450px) {
  .detail-grid {
    grid-template-columns: 100px minmax(0, 1fr);
    column-gap: 76px;
  }

  .info-column {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .side-nav.prev { left: 12px; }
  .side-nav.next { right: 12px; }
}

@media (max-width: 900px) {
  .detail-shell {
    padding: 18px 14px 28px;
  }

  .detail-topbar,
  .topbar-left {
    align-items: flex-start;
  }

  .topbar-left {
    flex-direction: column;
  }

  .detail-grid {
    grid-template-columns: 1fr;
    column-gap: 0;
  }

  .thumb-rail {
    min-height: 0;
    flex-direction: row;
    overflow-x: auto;
  }

  .load-more-thumbs {
    margin: auto 0;
    flex: 0 0 34px;
  }

  .info-column {
    grid-template-columns: 1fr;
  }

  .image-viewer {
    min-height: 54vh;
  }
}
</style>
