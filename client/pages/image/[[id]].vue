<template>
  <div class="image-detail">
    <div v-if="image" class="detail-bg">
      <img :src="fullImageUrl" :alt="imageTitle" @load="markDetailBackgroundReady" @error="markDetailBackgroundReady" />
    </div>

    <div v-if="image" class="detail-shell" :class="{ 'detail-shell-ready': detailShellReady }">
      <div class="detail-topbar">
        <div class="topbar-left">
          <NuxtLink to="/" class="soft-back">
            <TaotuIcon name="back" class="detail-icon icon-16" />
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
          <TaotuIcon name="close" class="detail-icon icon-18" />
        </NuxtLink>
      </div>

      <div class="size-switcher-row">
        <div class="size-switcher" aria-label="图片尺寸">
          <button
            v-for="size in sizeOptions"
            :key="size.key"
            class="size-btn"
            :class="{ active: currentSize === size.key }"
            @click="currentSize = size.key"
          >
            <TaotuIcon :name="size.icon" class="detail-icon icon-16" />
            <span>{{ size.label }}</span>
          </button>
        </div>
      </div>

      <div class="detail-grid">
        <aside ref="thumbRailRef" class="thumb-rail">
          <TransitionGroup name="thumb-slide" tag="div" class="thumb-list">
            <button
              v-for="item in visibleRailImages"
              :key="item.id"
              class="thumb-card"
              :class="{ active: Number(item.id) === Number(image.id) }"
              @click="openImage(item.id)"
            >
              <img :src="imageSrc(item.thumb_url || item.medium_url || item.url)" :alt="item.filename || item.alt || '图片'" />
            </button>
          </TransitionGroup>
          <button class="load-more-thumbs" :disabled="thumbLoading || !canAdvanceRail" @click="advanceThumbRail">
            <TaotuIcon name="load-more" class="detail-icon icon-16" />
          </button>
        </aside>

        <main class="viewer-column">
          <button class="side-nav prev" :disabled="!prevImage" @click="goSibling(-1)" title="上一张">
            <TaotuIcon name="previous" class="detail-icon icon-22" />
          </button>
          <section ref="viewerRef" class="image-viewer">
            <img
              ref="imageRef"
              :src="currentImageUrl"
              :alt="imageTitle"
              :class="{ 'is-loaded': viewerImageLoaded, 'is-pannable': zoom > 1, 'is-panning': isPanning }"
              :style="viewerImageStyle"
              draggable="false"
              @load="onViewerImageLoad"
              @pointerdown="startPan"
              @dblclick="resetZoom"
            />
          </section>
          <button class="side-nav next" :disabled="!canGoNext" @click="goSibling(1)" title="下一张">
            <TaotuIcon name="next" class="detail-icon icon-22" />
          </button>

          <div class="viewer-actions">
            <button class="action-btn" title="放大" @click="zoomIn">
              <TaotuIcon name="zoom-in" class="detail-icon icon-18" />
            </button>
            <button class="action-btn" title="缩小" @click="zoomOut">
              <TaotuIcon name="zoom-out" class="detail-icon icon-18" />
            </button>
            <span class="zoom-text">{{ Math.round(zoom * 100) }}%</span>
            <button class="action-btn" title="重置" @click="resetZoom">
              <TaotuIcon name="reset" class="detail-icon icon-18" />
            </button>
            <button class="action-btn" title="全屏" @click="toggleFullscreen">
              <TaotuIcon name="fullscreen" class="detail-icon icon-18" />
            </button>
            <span class="action-separator"></span>
            <button class="action-btn heart" title="收藏">
              <TaotuIcon name="favorite" class="detail-icon icon-18" />
            </button>
            <button class="action-btn mint" title="下载" @click="downloadImage">
              <TaotuIcon name="download" class="detail-icon icon-18" />
            </button>
          </div>
        </main>

        <aside class="info-column">
          <section class="detail-card info-card">
            <div class="title-row">
              <h1>{{ imageTitle }}</h1>
              <button class="collect-btn" type="button">
                <TaotuIcon name="favorite" class="detail-icon icon-16" />
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
              <TaotuIcon name="chevron-down" class="detail-icon icon-14" :class="{ rotate: showAllTags }" />
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
                    <TaotuIcon name="copy-code" class="detail-icon icon-15" />
                    复制
                  </button>
                </div>
              </label>
            </div>
          </section>
        </aside>
      </div>
    </div>

    <div v-else-if="loading" class="detail-loading-placeholder" aria-label="图片详情加载中">
      <TaotuIcon name="loading" />
    </div>
    <div v-else class="state-card">图片不存在</div>
  </div>
</template>

<script setup>
const route = useRoute()
const router = useRouter()
const config = useRuntimeConfig()
const api = useApi()

const image = ref(null)
const loading = ref(true)
const viewerRef = ref(null)
const imageRef = ref(null)
const thumbRailRef = ref(null)
const zoom = ref(1)
const currentSize = ref('full')
const currentImageId = ref(null)
const railImages = ref([])
const railStartIndex = ref(0)
const railVisibleCount = ref(7)
const thumbPage = ref(1)
const thumbTotal = ref(0)
const thumbLoading = ref(false)
const thumbEndReached = ref(false)
const showAllTags = ref(false)
const viewerImageLoaded = ref(false)
const viewerReady = ref(false)
const detailShellReady = ref(false)
const detailBackgroundReady = ref(false)
const isPanning = ref(false)
const pan = reactive({ x: 0, y: 0 })
const tagPreviewCount = 5
const thumbFetchSize = 48
const mobileRailMax = 8
let railResizeObserver = null
let panDrag = null
let momentumFrame = 0
let panVelocity = { x: 0, y: 0 }
const sizeOptions = [
  { key: 'thumb', label: '缩略图', icon: 'thumbnail' },
  { key: 'medium', label: '中等', icon: 'medium' },
  { key: 'full', label: '完整', icon: 'full' }
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
const thumbHasMore = computed(() => !thumbEndReached.value && railImages.value.length < thumbTotal.value)
const visibleRailImages = computed(() => railImages.value.slice(railStartIndex.value, railStartIndex.value + railVisibleCount.value))
const canAdvanceRail = computed(() => {
  return railStartIndex.value < getMaxRailStart() || thumbHasMore.value
})
const viewerImageStyle = computed(() => ({
  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom.value})`
}))

const activeIndex = computed(() => railImages.value.findIndex(item => Number(item.id) === Number(image.value?.id)))
const prevImage = computed(() => activeIndex.value > 0 ? railImages.value[activeIndex.value - 1] : null)
const nextImage = computed(() => {
  const idx = activeIndex.value
  return idx >= 0 && idx < railImages.value.length - 1 ? railImages.value[idx + 1] : null
})
const canGoNext = computed(() => !!nextImage.value || thumbHasMore.value)

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
  const sizeKey = currentSize.value === 'thumb' ? 'thumb' : currentSize.value === 'medium' ? 'medium' : 'full'
  const codes = image.value?.embed_codes?.[sizeKey] || {}
  const source = codes.source || currentImageUrl.value || fullImageUrl.value
  return [
    { key: 'source', label: '源地址（URL）', value: source },
    { key: 'html', label: 'HTML', value: codes.html || `<img src="${source}" alt="${imageTitle.value}" />` },
    { key: 'bbcode', label: 'BBCode', value: codes.bbcode || `[img]${source}[/img]` },
    { key: 'markdown', label: 'Markdown', value: codes.markdown || `![${imageTitle.value}](${source})` }
  ]
})

const imageSrc = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${config.public.apiBase || ''}${url}`
}

const routeImageId = () => route.query.id || route.params.id
const routeAlbumScopeId = () => {
  const raw = route.query.ablum_id || route.query.album_id
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const redirectLegacyPath = async () => {
  if (!route.params.id || route.path === '/image') return false
  await router.replace({ path: '/image', query: { ...route.query, id: String(route.params.id) } })
  return true
}

const syncImageUrl = async (id) => {
  if (!id || route.path !== '/image') return
  if (String(route.query.id || '') === String(id)) return
  await router.push({ path: '/image', query: { ...route.query, id: String(id) } })
}

const showDetailShell = () => {
  if (!image.value || detailShellReady.value || !import.meta.client) return
  requestAnimationFrame(() => {
    detailShellReady.value = true
  })
}

const markDetailBackgroundReady = () => {
  detailBackgroundReady.value = true
  showDetailShell()
}

const resetThumbRail = () => {
  railImages.value = []
  railStartIndex.value = 0
  thumbPage.value = 1
  thumbTotal.value = 0
  thumbEndReached.value = false
}

const reloadThumbRail = async () => {
  resetThumbRail()
  await loadThumbs()
}

const selectImage = async (id, { updateUrl = true, align = 'visible' } = {}) => {
  if (!id || Number(id) === Number(currentImageId.value)) {
    await ensureImageInRail(id)
    if (align === 'top') alignRailToActive('top')
    else alignRailToActive('visible')
    return
  }
  currentImageId.value = Number(id)
  showAllTags.value = false
  viewerImageLoaded.value = false
  detailShellReady.value = false
  detailBackgroundReady.value = false
  resetZoom()
  if (!image.value) loading.value = true
  try {
    const data = await api.get(`/api/internal/images/${id}`)
    image.value = data
    currentImageId.value = Number(data.id || id)
    await nextTick()
    const bgImage = document.querySelector('.detail-bg img')
    if (bgImage?.complete) markDetailBackgroundReady()
    const foundInRail = await ensureImageInRail(currentImageId.value)
    if (foundInRail) syncCurrentInRail()
    else prependCurrentToRail()
    alignRailToActive(align)
    if (updateUrl) await syncImageUrl(currentImageId.value)
  } catch (err) {
    console.error('获取图片详情失败:', err)
    if (!image.value) image.value = null
  } finally {
    loading.value = false
  }
}

const loadThumbs = async ({ append = false } = {}) => {
  if (thumbLoading.value) return
  thumbLoading.value = true
  try {
    if (!append) thumbEndReached.value = false
    const beforeLength = railImages.value.length
    const params = {
      page: thumbPage.value,
      limit: thumbFetchSize,
      sort: 'created_at',
      order: 'desc'
    }
    const albumScopeId = routeAlbumScopeId()
    if (albumScopeId) params.album = albumScopeId
    const data = await api.get('/api/internal/images', params)
    const incoming = data.images || []
    const apiTotal = Number(data.total)
    const hasReliableTotal = Number.isFinite(apiTotal) && apiTotal > 0
    const nextImages = append ? mergeImages(railImages.value, incoming) : mergeImages(incoming, [])

    railImages.value = nextImages
    thumbTotal.value = hasReliableTotal ? apiTotal : nextImages.length

    const addedCount = nextImages.length - (append ? beforeLength : 0)
    const reachedByShortPage = incoming.length < thumbFetchSize
    const reachedByTotal = hasReliableTotal && nextImages.length >= apiTotal
    const reachedByNoGrowth = append && addedCount <= 0
    if (reachedByShortPage || reachedByTotal || reachedByNoGrowth) {
      thumbEndReached.value = true
      if (!hasReliableTotal || nextImages.length < apiTotal) thumbTotal.value = nextImages.length
    }

    syncCurrentInRail()
    clampRailStart()
  } catch (err) {
    console.error('加载缩略图列表失败:', err)
  } finally {
    thumbLoading.value = false
  }
}

const ensureRailIndexLoaded = async (index) => {
  while (railImages.value.length <= index && thumbHasMore.value && !thumbLoading.value) {
    const beforeLength = railImages.value.length
    thumbPage.value += 1
    await loadThumbs({ append: true })
    if (railImages.value.length <= beforeLength) break
  }
}

const ensureRailWindowLoaded = async (startIndex) => {
  await ensureRailIndexLoaded(startIndex + railVisibleCount.value - 1)
}

const ensureImageInRail = async (id) => {
  if (!id) return false
  while (railImages.value.findIndex(item => Number(item.id) === Number(id)) < 0 && thumbHasMore.value && !thumbLoading.value) {
    const beforeLength = railImages.value.length
    thumbPage.value += 1
    await loadThumbs({ append: true })
    if (railImages.value.length <= beforeLength) break
  }
  return railImages.value.some(item => Number(item.id) === Number(id))
}

const getMaxRailStart = () => Math.max(0, railImages.value.length - railVisibleCount.value)

const getAdvanceRailStart = () => {
  const idx = activeIndex.value
  if (idx < 0) return railStartIndex.value
  return railStartIndex.value < idx ? idx : idx + 1
}

const advanceThumbRail = async () => {
  if (thumbLoading.value || !canAdvanceRail.value) return
  const idx = activeIndex.value
  if (idx < 0) {
    await ensureRailWindowLoaded(railStartIndex.value)
    return
  }
  const targetStart = getAdvanceRailStart()
  await ensureRailWindowLoaded(targetStart)
  railStartIndex.value = Math.min(targetStart, getMaxRailStart())
  clampRailStart()
  if (railStartIndex.value <= idx) return
  const target = railImages.value[railStartIndex.value]
  if (target) await selectImage(target.id, { updateUrl: true, align: 'top' })
}

const mergeImages = (base, extra) => {
  const seen = new Set()
  return [...base, ...extra].filter(item => {
    if (!item?.id || seen.has(Number(item.id))) return false
    seen.add(Number(item.id))
    return true
  })
}

const syncCurrentInRail = () => {
  if (!image.value) return
  const existingIndex = railImages.value.findIndex(item => Number(item.id) === Number(image.value.id))
  if (existingIndex >= 0) {
    railImages.value = railImages.value.map((item, index) => index === existingIndex ? { ...item, ...image.value } : item)
  }
}

const prependCurrentToRail = () => {
  if (!image.value || railImages.value.some(item => Number(item.id) === Number(image.value.id))) return
  const albumScopeId = routeAlbumScopeId()
  if (albumScopeId && Number(image.value.album_id) !== albumScopeId) return
  railImages.value = [image.value, ...railImages.value]
  railStartIndex.value = 0
}

const clampRailStart = () => {
  const maxStart = Math.max(0, railImages.value.length - railVisibleCount.value)
  railStartIndex.value = Math.max(0, Math.min(railStartIndex.value, maxStart))
}

const alignRailToActive = (mode = 'visible') => {
  const idx = activeIndex.value
  if (idx < 0) return
  if (mode === 'top') {
    railStartIndex.value = idx
  } else if (idx < railStartIndex.value) {
    railStartIndex.value = idx
  } else if (idx >= railStartIndex.value + railVisibleCount.value) {
    railStartIndex.value = idx - railVisibleCount.value + 1
  }
  clampRailStart()
}

const openImage = async (id) => {
  if (Number(id) === Number(currentImageId.value)) return
  await selectImage(id, { updateUrl: true, align: 'visible' })
}

const goSibling = async (direction) => {
  const idx = activeIndex.value
  if (idx < 0) return
  const targetIndex = idx + direction
  if (direction > 0) await ensureRailIndexLoaded(targetIndex)
  const target = railImages.value[targetIndex]
  if (target) await selectImage(target.id, { updateUrl: true, align: 'visible' })
}

const zoomIn = () => {
  zoom.value = Math.min(3, Number((zoom.value + 0.1).toFixed(2)))
  nextTick(() => setPan(pan.x, pan.y))
}

const zoomOut = () => {
  zoom.value = Math.max(0.3, Number((zoom.value - 0.1).toFixed(2)))
  nextTick(() => setPan(pan.x, pan.y))
}

function resetZoom() {
  cancelMomentum()
  zoom.value = 1
  pan.x = 0
  pan.y = 0
}

const clampPan = (x, y) => {
  if (zoom.value <= 1 || !viewerRef.value || !imageRef.value) return { x: 0, y: 0 }
  const viewerRect = viewerRef.value.getBoundingClientRect()
  const baseWidth = imageRef.value.offsetWidth || imageRef.value.naturalWidth || 0
  const baseHeight = imageRef.value.offsetHeight || imageRef.value.naturalHeight || 0
  const scaledWidth = baseWidth * zoom.value
  const scaledHeight = baseHeight * zoom.value
  const maxX = Math.max(0, (scaledWidth - viewerRect.width) / 2)
  const maxY = Math.max(0, (scaledHeight - viewerRect.height) / 2)
  return {
    x: Math.max(-maxX, Math.min(maxX, x)),
    y: Math.max(-maxY, Math.min(maxY, y))
  }
}

const setPan = (x, y) => {
  const next = clampPan(x, y)
  pan.x = next.x
  pan.y = next.y
}

const cancelMomentum = () => {
  if (momentumFrame) cancelAnimationFrame(momentumFrame)
  momentumFrame = 0
}

const startMomentum = () => {
  cancelMomentum()
  let vx = panVelocity.x
  let vy = panVelocity.y
  const step = () => {
    if (Math.abs(vx) < 0.08 && Math.abs(vy) < 0.08) {
      momentumFrame = 0
      return
    }
    const beforeX = pan.x
    const beforeY = pan.y
    setPan(pan.x + vx, pan.y + vy)
    if (pan.x === beforeX) vx *= -0.18
    if (pan.y === beforeY) vy *= -0.18
    vx *= 0.92
    vy *= 0.92
    momentumFrame = requestAnimationFrame(step)
  }
  momentumFrame = requestAnimationFrame(step)
}

const movePan = (event) => {
  if (!panDrag) return
  event.preventDefault()
  const now = performance.now()
  const dx = event.clientX - panDrag.startX
  const dy = event.clientY - panDrag.startY
  setPan(panDrag.originX + dx, panDrag.originY + dy)
  const dt = Math.max(1, now - panDrag.lastTime)
  panVelocity = {
    x: ((event.clientX - panDrag.lastX) / dt) * 16,
    y: ((event.clientY - panDrag.lastY) / dt) * 16
  }
  panDrag.lastX = event.clientX
  panDrag.lastY = event.clientY
  panDrag.lastTime = now
}

const endPan = () => {
  if (!panDrag) return
  panDrag = null
  isPanning.value = false
  window.removeEventListener('pointermove', movePan)
  window.removeEventListener('pointerup', endPan)
  window.removeEventListener('pointercancel', endPan)
  if (zoom.value > 1) startMomentum()
}

const startPan = (event) => {
  if (zoom.value <= 1) return
  event.preventDefault()
  cancelMomentum()
  isPanning.value = true
  panVelocity = { x: 0, y: 0 }
  panDrag = {
    startX: event.clientX,
    startY: event.clientY,
    originX: pan.x,
    originY: pan.y,
    lastX: event.clientX,
    lastY: event.clientY,
    lastTime: performance.now()
  }
  window.addEventListener('pointermove', movePan, { passive: false })
  window.addEventListener('pointerup', endPan)
  window.addEventListener('pointercancel', endPan)
}

const onViewerImageLoad = () => {
  viewerImageLoaded.value = true
  nextTick(() => setPan(pan.x, pan.y))
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

const updateRailVisibleCount = () => {
  if (!import.meta.client) return
  if (window.innerWidth <= 900) {
    railVisibleCount.value = Math.max(1, Math.min(railImages.value.length || mobileRailMax, mobileRailMax))
    clampRailStart()
    return
  }
  const thumbSize = 88
  const thumbGap = 10
  const railHeight = thumbRailRef.value?.clientHeight || 745
  const listHeight = thumbRailRef.value?.querySelector?.('.thumb-list')?.clientHeight || 0
  const estimatedListHeight = railHeight - 24 - 34 - thumbGap
  const available = Math.max(thumbSize, listHeight || estimatedListHeight)
  railVisibleCount.value = Math.max(1, Math.floor((available + thumbGap + 2) / (thumbSize + thumbGap)))
  clampRailStart()
}

const observeThumbRail = () => {
  if (!import.meta.client || !('ResizeObserver' in window) || !thumbRailRef.value) return
  railResizeObserver?.disconnect()
  railResizeObserver = new ResizeObserver(updateRailVisibleCount)
  railResizeObserver.observe(thumbRailRef.value)
  const listEl = thumbRailRef.value.querySelector?.('.thumb-list')
  if (listEl) railResizeObserver.observe(listEl)
}

const handlePopState = async () => {
  const id = routeImageId()
  if (id && Number(id) !== Number(currentImageId.value)) await selectImage(id, { updateUrl: false, align: 'visible' })
}

watch(() => [route.query.id, route.params.id, route.path, route.query.ablum_id, route.query.album_id], async (_next, previous) => {
  if (!viewerReady.value) return
  if (await redirectLegacyPath()) return
  const previousScope = previous ? Number(previous[3] || previous[4] || 0) || null : null
  if (routeAlbumScopeId() !== previousScope) await reloadThumbRail()
  const id = routeImageId()
  if (id && Number(id) !== Number(currentImageId.value)) await selectImage(id, { updateUrl: false, align: 'visible' })
  else if (id) await ensureImageInRail(id)
})

watch(currentImageUrl, () => {
  viewerImageLoaded.value = false
  pan.x = 0
  pan.y = 0
})

watch(() => image.value?.id, () => {
  nextTick(() => {
    observeThumbRail()
    updateRailVisibleCount()
  })
})

watch(railImages, () => nextTick(updateRailVisibleCount), { deep: true })

onMounted(async () => {
  await redirectLegacyPath()
  await reloadThumbRail()
  window.addEventListener('resize', updateRailVisibleCount)
  window.addEventListener('popstate', handlePopState)
  const id = routeImageId()
  if (id) await selectImage(id, { updateUrl: false, align: 'visible' })
  else loading.value = false
  await nextTick()
  observeThumbRail()
  updateRailVisibleCount()
  viewerReady.value = true
})

onBeforeUnmount(() => {
  railResizeObserver?.disconnect()
  window.removeEventListener('resize', updateRailVisibleCount)
  window.removeEventListener('popstate', handlePopState)
  window.removeEventListener('pointermove', movePan)
  window.removeEventListener('pointerup', endPan)
  window.removeEventListener('pointercancel', endPan)
  cancelMomentum()
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
  position: fixed;
  z-index: 1;
  min-height: 100vh;
  padding: 26px clamp(18px, 1.8vw, 34px) 36px;
  background: transparent;
  transform: translate3d(0, 27px, 0) scale(0.978);
  will-change: transform;
}

.detail-shell-ready {
  animation: taotu-page-pop-transform var(--taotu-page-pop-duration) var(--taotu-page-pop-ease) both;
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

.size-switcher-row {
  display: grid;
  grid-template-columns: 114px minmax(0, 745px) minmax(320px, 372px);
  column-gap: clamp(24px, 3.8vw, 78px);
  width: min(100%, 1840px);
  margin: 0 auto 28px;
  justify-content: space-between;
}

.size-switcher {
  width: fit-content;
  display: flex;
  grid-column: 2;
  align-items: center;
  justify-content: center;
  justify-self: center;
  gap: 3px;
  margin: 0;
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
  grid-template-columns: 114px minmax(0, 745px) minmax(320px, 372px);
  column-gap: clamp(24px, 3.8vw, 78px);
  row-gap: 24px;
  width: min(100%, 1840px);
  margin: 0 auto;
  align-items: stretch;
  justify-content: space-between;
}

.thumb-rail {
  height: min(745px, calc(100vh - 188px));
  max-height: 745px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  overflow: hidden;
}

.thumb-list {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.thumb-card {
  width: 88px;
  height: 88px;
  flex: 0 0 88px;
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

.thumb-slide-move,
.thumb-slide-enter-active,
.thumb-slide-leave-active {
  transition: transform 0.24s ease, opacity 0.2s ease;
}

.thumb-slide-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

.thumb-slide-leave-to {
  opacity: 0;
  transform: translateY(-16px);
}

.thumb-slide-leave-active {
  position: absolute;
}

.load-more-thumbs {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 34px;
  margin: 0 auto;
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
  width: min(100%, 745px);
}

.image-viewer {
  width: min(100%, 745px);
  height: min(745px, calc(100vh - 188px));
  max-height: 745px;
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: 1px solid rgba(255,255,255,0.78);
  border-radius: 12px;
  background: rgba(255,255,255,0.46);
  box-shadow: 0 16px 46px rgba(81, 91, 124, 0.1);
  overflow: hidden;
  touch-action: none;
}

.image-viewer:fullscreen {
  padding: 28px;
  background: rgba(249,251,255,0.96);
}

.image-viewer img {
  max-width: 100%;
  max-height: 100%;
  display: block;

  border-radius: 8px;
  transform-origin: center center;
  opacity: 0;
  user-select: none;
  transition: transform 0.16s ease, opacity 0.16s ease;
  box-shadow: 0 18px 46px rgba(45, 52, 82, 0.18);
}

.image-viewer img.is-loaded {
  opacity: 1;
}

.image-viewer img.is-pannable {
  cursor: grab;
}

.image-viewer img.is-panning {
  cursor: grabbing;
  transition: none;
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
  height: min(745px, calc(100vh - 188px));
  max-height: 745px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
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

.detail-loading-placeholder {
  position: fixed;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.detail-loading-placeholder .taotu-svg-icon {
  width: 48px;
  height: 48px;
  color: rgba(255, 111, 157, 0.82);
  opacity: 0.86;
}

@media (max-width: 1450px) {
  .size-switcher-row,
  .detail-grid {
    grid-template-columns: 100px minmax(0, 745px);
    column-gap: clamp(22px, 5vw, 76px);
  }

  .info-column {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    height: auto;
    max-height: none;
    overflow: visible;
    padding-right: 0;
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

  .size-switcher-row {
    grid-template-columns: 1fr;
    column-gap: 0;
  }

  .size-switcher {
    grid-column: 1;
  }

  .detail-grid {
    grid-template-columns: 1fr;
    column-gap: 0;
  }

  .thumb-rail {
    width: 100%;
    height: auto;
    min-height: 0;
    max-height: none;
    flex-direction: row;
    overflow-x: auto;
  }

  .thumb-list {
    flex-direction: row;
    overflow: visible;
  }

  .load-more-thumbs {
    margin: auto 0;
    flex: 0 0 34px;
  }

  .info-column {
    grid-template-columns: 1fr;
  }

  .image-viewer {
    width: 100%;
    height: min(64vh, 745px);
    min-height: 360px;
  }
}
</style>
