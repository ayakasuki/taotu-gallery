<template>
  <div class="album-detail">
    <section v-if="album" class="album-hero-band">
      <div class="album-hero-layout">
        <NuxtLink to="/albums" class="back-link">
          <img src="/icons/image/back-64x64.png" alt="" />
          <span>返回相册列表</span>
        </NuxtLink>

        <article class="album-header taotu-panel">
          <div class="album-cover-mini">
            <img v-if="getAlbumCoverUrl(album)" :src="getAlbumCoverUrl(album)" :alt="album.name" />
            <div v-else class="cover-fallback"></div>
          </div>

          <div class="album-header-main">
            <div class="title-row">
              <h1>{{ album.name }}</h1>
              <span class="visibility-badge" :class="{ public: album.is_public }">
                <img src="/icons/albums/visibility-info-80x80.png" alt="" />
                {{ album.is_public ? '公开' : '私有' }}
              </span>
            </div>

            <p class="album-desc">{{ album.description || '这个相册还没有写下描述。' }}</p>

            <div class="album-stats">
              <span>
                <img src="/icons/albums/image-count-80x80.png" alt="" />
                {{ album.image_count || sortedImages.length || 0 }} 张图片
              </span>
              <span>
                <img src="/icons/albums/updated-time-80x80.png" alt="" />
                {{ formatDate(album.updated_at || album.created_at) }} 更新
              </span>
              <span>
                <img src="/icons/albums/views-80x80.png" alt="" />
                {{ formatViews(albumViews) }} 浏览
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section v-if="album" class="album-wall">
      <header class="wall-toolbar">
        <div class="wall-title">
          <h2>全部图片</h2>
          <b>{{ sortedImages.length }}</b>
        </div>

        <div class="wall-actions">
          <TaotuSelect v-model="sortMode" class="sort-select" :options="sortOptions" />
          <div class="view-switch">
            <button
              type="button"
              class="view-btn"
              :class="{ active: viewMode === 'grid' }"
              title="网格"
              @click="viewMode = 'grid'"
            >
              <img src="/icons/albums/grid-view-64x64.png" alt="" />
            </button>
            <button
              type="button"
              class="view-btn"
              :class="{ active: viewMode === 'list' }"
              title="列表"
              @click="viewMode = 'list'"
            >
              <img src="/icons/albums/list-view-64x64.png" alt="" />
            </button>
          </div>
        </div>
      </header>

      <div v-if="loading" class="loading-wall">
        <img src="/icons/status/loading-64x64.png" alt="" />
        <span>加载中...</span>
      </div>

      <div v-else-if="sortedImages.length > 0" ref="wallRef" class="waterfall-layout" :class="`mode-${viewMode}`">
        <template v-if="viewMode === 'list'">
          <div v-for="row in listRows" :key="row.key" class="list-row">
            <button
              v-for="item in row.items"
              :key="item.image.id"
              type="button"
              class="image-tile"
              :style="{ width: `${item.width}px` }"
              @click="openAlbumImage(item.image.id)"
            >
              <img :src="imageUrl(item.image)" :alt="item.image.alt || item.image.filename || '图片'" loading="lazy" />
              <span class="view-chip">
                <img src="/icons/albums/views-80x80.png" alt="" />
                {{ formatViews(item.image.view_count || 0) }}
              </span>
            </button>
          </div>
        </template>

        <template v-else>
          <button
            v-for="img in pagedImages"
            :key="img.id"
            type="button"
            class="image-tile"
            @click="openAlbumImage(img.id)"
          >
            <img :src="imageUrl(img)" :alt="img.alt || img.filename || '图片'" loading="lazy" />
            <span class="view-chip">
              <img src="/icons/albums/views-80x80.png" alt="" />
              {{ formatViews(img.view_count || 0) }}
            </span>
          </button>
        </template>
      </div>

      <div v-else class="album-empty">
        <div class="empty-mascot"></div>
        <div>
          <h3>空空如也</h3>
          <p>该相册还没有图片</p>
          <NuxtLink to="/upload">上传图片</NuxtLink>
        </div>
      </div>
    </section>

    <footer v-if="album && sortedImages.length > 0" class="detail-pagination">
      <span>共 {{ sortedImages.length }} 张图片</span>
      <div class="page-controls">
        <button type="button" class="page-arrow" :disabled="page <= 1" @click="loadPage(page - 1)">
          <img src="/icons/albums/pagination-prev-64x64.png" alt="" />
        </button>
        <button
          v-for="item in paginationItems"
          :key="item.key"
          type="button"
          class="page-number"
          :class="{ active: item.value === page, ellipsis: item.ellipsis }"
          :disabled="item.ellipsis"
          @click="!item.ellipsis && loadPage(item.value)"
        >
          {{ item.label }}
        </button>
        <button type="button" class="page-arrow" :disabled="page >= totalPages" @click="loadPage(page + 1)">
          <img src="/icons/albums/pagination-next-64x64.png" alt="" />
        </button>
      </div>
      <span class="pagination-spacer"></span>
    </footer>

    <div v-if="!album && !loading" class="empty-state taotu-card">
      <img src="/icons/empty/no-albums-256x256.png" alt="" />
      <p>相册不存在</p>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const config = useRuntimeConfig()

const album = ref(null)
const images = ref([])
const loading = ref(true)
const sortMode = ref('created_at')
const viewMode = ref('list')
const page = ref(1)
const wallRef = ref(null)
const wallWidth = ref(1420)
let resizeObserver = null

const sortOptions = [
  { label: '最新', value: 'created_at' },
  { label: '最热门', value: 'view_count' },
  { label: '文件名', value: 'filename' }
]

const sortedImages = computed(() => {
  const list = [...images.value]
  if (sortMode.value === 'view_count') {
    return list.sort((a, b) => Number(b.view_count || 0) - Number(a.view_count || 0))
  }
  if (sortMode.value === 'filename') {
    return list.sort((a, b) => String(a.filename || '').localeCompare(String(b.filename || '')))
  }
  return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
})

const albumViews = computed(() => images.value.reduce((sum, img) => sum + Number(img.view_count || 0), 0))
const imagesPerRow = computed(() => {
  const width = Math.max(320, Math.floor(wallWidth.value || 1420))
  const gap = 12
  const min = 250
  const max = 350
  for (let count = 6; count >= 1; count -= 1) {
    const minTotal = count * min + (count - 1) * gap
    const maxTotal = count * max + (count - 1) * gap
    if (width >= minTotal && width <= maxTotal) return count
  }
  return width >= 1500 ? 6 : width >= 1200 ? 5 : width >= 880 ? 3 : width >= 520 ? 2 : 1
})
const gridColumns = computed(() => {
  const width = Math.max(174, Math.floor(wallWidth.value || 1420))
  const gap = 12
  const min = 174
  return Math.max(1, Math.floor((width + gap) / (min + gap)))
})
const pageSize = computed(() => (viewMode.value === 'list' ? imagesPerRow.value : gridColumns.value) * 4)
const totalPages = computed(() => Math.max(1, Math.ceil(sortedImages.value.length / pageSize.value)))
const pagedImages = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return sortedImages.value.slice(start, start + pageSize.value)
})
const paginationItems = computed(() => {
  const last = totalPages.value
  const current = page.value
  const pages = new Set([1, current - 1, current, current + 1, last].filter(num => num >= 1 && num <= last))
  const sorted = [...pages].sort((a, b) => a - b)
  const result = []
  sorted.forEach((num, index) => {
    if (index > 0 && num - sorted[index - 1] > 1) {
      result.push({ key: `ellipsis-${num}`, label: '...', ellipsis: true })
    }
    result.push({ key: `page-${num}`, label: String(num), value: num })
  })
  return result
})

const listRows = computed(() => {
  const count = imagesPerRow.value
  const rows = []
  for (let rowIndex = 0; rowIndex < 4; rowIndex += 1) {
    const rowImages = pagedImages.value.slice(rowIndex * count, rowIndex * count + count)
    if (rowImages.length === 0) continue
    const widths = buildRowWidths(rowImages.length, rowIndex)
    rows.push({
      key: `row-${rowIndex}`,
      items: rowImages.map((image, index) => ({ image, width: widths[index] }))
    })
  }
  return rows
})

const normalizeAssetUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${config.public.apiBase || ''}${url}`
}

const getAlbumCoverUrl = (target) => {
  const url = target.cover_image?.medium_url || target.cover_image?.thumb_url || target.cover_image?.url
  return normalizeAssetUrl(url)
}

const imageUrl = (img) => normalizeAssetUrl(img.medium_url || img.thumb_url || img.url)

const openAlbumImage = (id) => {
  navigateTo({ path: '/image', query: { id, ablum_id: route.params.id } })
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ').replace(/\.\d{3}Z$/, '').slice(0, 16)
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const formatViews = (value) => {
  const count = Number(value || 0)
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(count)
}

const buildRowWidths = (count, rowIndex) => {
  if (viewMode.value !== 'list') return []
  const gap = 12
  const min = 250
  const max = 350
  const available = Math.max(260, Math.floor(wallWidth.value || 1420) - (count - 1) * gap)
  if (count === 1) return [Math.min(max, Math.max(min, available))]

  const patterns = [
    [0.92, 1.16, 1.02, 1.22, 0.98, 1.1],
    [1.18, 0.96, 1.12, 0.9, 1.24, 1.02],
    [0.98, 1.2, 0.94, 1.14, 1.04, 1.22],
    [1.1, 0.9, 1.24, 1.0, 1.16, 0.96]
  ]
  const weights = Array.from({ length: count }, (_, index) => patterns[rowIndex % patterns.length][index % 6])
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
  const widths = weights.map(weight => Math.round((available * weight) / weightTotal))

  for (let i = 0; i < widths.length; i += 1) {
    widths[i] = Math.max(min, Math.min(max, widths[i]))
  }

  let delta = available - widths.reduce((sum, width) => sum + width, 0)
  let guard = 0
  while (delta !== 0 && guard < 200) {
    for (let i = 0; i < widths.length && delta !== 0; i += 1) {
      if (delta > 0 && widths[i] < max) {
        widths[i] += 1
        delta -= 1
      } else if (delta < 0 && widths[i] > min) {
        widths[i] -= 1
        delta += 1
      }
    }
    guard += 1
  }
  return widths
}

const loadPage = (targetPage) => {
  if (targetPage < 1 || targetPage > totalPages.value || targetPage === page.value) return
  page.value = targetPage
}

watch([totalPages, pageSize], () => {
  if (page.value > totalPages.value) page.value = totalPages.value
  if (page.value < 1) page.value = 1
})

const updateWallWidth = () => {
  if (!import.meta.client || !wallRef.value) return
  wallWidth.value = Math.max(280, Math.floor(wallRef.value.clientWidth))
}

onMounted(async () => {
  try {
    const api = useApi()
    const data = await api.get(`/api/internal/albums/${route.params.id}`)
    album.value = data
    images.value = data.images || []
  } catch (err) {
    console.error('获取相册详情失败:', err)
  } finally {
    loading.value = false
    await nextTick()
    updateWallWidth()
    if (import.meta.client && wallRef.value && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(updateWallWidth)
      resizeObserver.observe(wallRef.value)
    }
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch([sortMode, viewMode], () => {
  page.value = 1
  nextTick(updateWallWidth)
})

watch(pageSize, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
})
</script>

<style scoped>
.album-detail {
  width: 100%;
  min-height: calc(100vh - 148px);
  display: flex;
  flex-direction: column;
}

.album-hero-band {
  width: 100%;
  min-height: 216px;
  padding: 22px 16px 24px;
  background: transparent;
}

.album-hero-layout {
  display: grid;
  grid-template-columns: minmax(130px, 230px) minmax(0, 760px) minmax(0, 230px);
  align-items: start;
  gap: 18px;
  width: min(100%, 1420px);
  margin: 0 auto;
}

.back-link {
  width: fit-content;
  height: 40px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border: 1px solid rgba(226, 218, 234, 0.82);
  border-radius: 10px;
  background: rgba(255,255,255,0.72);
  color: #4b566e;
  font-size: 14px;
  font-weight: 900;
  box-shadow: 0 10px 28px rgba(80, 70, 110, 0.08);
  backdrop-filter: blur(18px);
}

.back-link img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.album-header {
  grid-column: 2;
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  gap: 24px;
  align-items: center;
  min-height: 162px;
  padding: 18px 22px;
  border-radius: 14px;
  background: rgba(255,255,255,0.78);
  box-shadow: 0 18px 54px rgba(82, 72, 110, 0.13);
  backdrop-filter: blur(24px);
}

.album-cover-mini {
  width: 132px;
  height: 132px;
  overflow: hidden;
  border-radius: 10px;
  background: rgba(245, 248, 255, 0.8);
}

.album-cover-mini img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.cover-fallback {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(255, 240, 246, 0.8), rgba(238, 250, 255, 0.86));
}

.album-header-main {
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 18px;
}

.title-row h1 {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #2f3850;
  font-size: 30px;
  font-weight: 900;
  line-height: 1.2;
}

.visibility-badge {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: max-content;
  max-width: 100%;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(239, 226, 255, 0.86);
  color: #9f64ec;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
}

.visibility-badge.public {
  background: rgba(217, 251, 239, 0.92);
  color: #25ba91;
}

.visibility-badge img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.album-desc {
  margin-top: 12px;
  color: #788198;
  font-size: 14px;
  font-weight: 800;
}

.album-stats {
  width: fit-content;
  max-width: 100%;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 30px;
  margin-top: 24px;
  padding: 10px 18px;
  border-radius: 10px;
  background: rgba(255,255,255,0.68);
  color: #788198;
  font-size: 14px;
  font-weight: 900;
  backdrop-filter: blur(16px);
}

.album-stats span {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: max-content;
  max-width: 100%;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.album-stats img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.album-wall {
  width: min(100%, 1468px);
  margin: 0 auto;
  padding: 20px 24px 26px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 14px;
  background: rgba(255,255,255,0.58);
  box-shadow: 0 14px 38px rgba(80, 70, 110, 0.08);
  backdrop-filter: blur(18px);
}

.wall-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: min(100%, 1420px);
  margin: 0 auto 16px;
}

.wall-title {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.wall-title h2 {
  color: #2f3850;
  font-size: 16px;
  font-weight: 900;
}

.wall-title b {
  flex: 0 0 auto;
  width: max-content;
  min-width: 32px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0 10px;
  box-sizing: border-box;
  background: rgba(239, 242, 249, 0.88);
  color: #8b93a7;
  font-size: 13px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.wall-actions {
  display: inline-flex;
  align-items: center;
  gap: 14px;
}

.sort-select {
  width: 118px;
}

.view-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.view-btn {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(226, 218, 234, 0.82);
  border-radius: 9px;
  background: rgba(255,255,255,0.82);
  cursor: pointer;
}

.view-btn.active {
  background: rgba(241, 243, 249, 0.72);
  backdrop-filter: blur(16px);
}

.view-btn img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.waterfall-layout {
  width: min(100%, 1420px);
  margin: 0 auto;
}

.waterfall-layout.mode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(174px, 1fr));
  gap: 12px;
}

.waterfall-layout.mode-list {
  --tile-row-height: 132px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.list-row {
  display: flex;
  align-items: stretch;
  gap: 12px;
  height: var(--tile-row-height);
  min-width: 0;
}

.image-tile {
  position: relative;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  background: rgba(245, 248, 255, 0.85);
  cursor: pointer;
  box-shadow: 0 10px 26px rgba(70, 70, 100, 0.08);
}

.mode-grid .image-tile {
  aspect-ratio: 1 / 1;
}

.mode-list .image-tile {
  flex: 0 0 auto;
  height: 100%;
}

.image-tile img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.view-chip {
  position: absolute;
  left: 9px;
  bottom: 8px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: max-content;
  min-width: 30px;
  max-width: calc(100% - 18px);
  height: 22px;
  padding: 0 8px;
  box-sizing: border-box;
  border-radius: 999px;
  background: rgba(31, 36, 50, 0.48);
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  backdrop-filter: blur(10px);
}

.view-chip img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.detail-pagination {
  width: min(100%, 1468px);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 18px;
  margin: auto auto 0;
  padding: 16px 16px 2px;
  color: #8a92a7;
  font-size: 14px;
  font-weight: 800;
}

.page-controls {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.page-arrow,
.page-number {
  min-width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #697187;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
}

.page-arrow {
  width: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.page-arrow img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.page-number.active {
  background: #ffe6f0;
  color: #f15c96;
}

.page-number.ellipsis,
.page-arrow:disabled {
  cursor: default;
  opacity: 0.42;
}

.loading-wall,
.album-empty,
.empty-state {
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #8b93a7;
  font-weight: 900;
}

.loading-wall img,
.empty-state img {
  width: 72px;
  height: 72px;
  object-fit: contain;
}

.album-empty {
  width: min(100%, 1420px);
  margin: 0 auto;
  min-height: 156px;
  justify-content: flex-end;
  padding-right: 126px;
  border: 1px solid rgba(226, 218, 234, 0.72);
  border-radius: 12px;
  background: rgba(255,255,255,0.62);
}

.album-empty h3 {
  color: #2f3850;
  font-size: 18px;
}

.album-empty p {
  margin: 5px 0 12px;
  color: #8b93a7;
  font-size: 13px;
}

.album-empty a {
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 0 16px;
  border: 1px solid rgba(248, 95, 154, 0.32);
  border-radius: 8px;
  color: #f15c96;
  font-size: 14px;
  font-weight: 900;
}

.empty-mascot {
  width: 104px;
  height: 104px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 52% 38%, rgba(255,255,255,0.9) 0 15%, transparent 16%),
    radial-gradient(circle at 48% 42%, rgba(196, 205, 224, 0.34) 0 48%, transparent 49%);
}

@media (max-width: 1180px) {
  .album-header {
    grid-template-columns: 132px minmax(0, 1fr);
    gap: 18px;
  }

  .album-cover-mini {
    width: 132px;
    height: 132px;
  }

  .album-stats {
    gap: 10px 14px;
    padding: 9px 12px;
    font-size: 13px;
  }

  .album-stats img {
    width: 18px;
    height: 18px;
  }
}

@media (max-width: 980px) {
  .album-hero-layout {
    grid-template-columns: 1fr;
  }

  .album-header {
    grid-column: 1;
  }

  .album-stats {
    flex-wrap: wrap;
    gap: 12px 20px;
  }
}

@media (max-width: 720px) {
  .album-hero-band,
  .album-wall {
    padding-left: 16px;
    padding-right: 16px;
  }

  .album-header {
    grid-template-columns: 1fr;
    justify-items: start;
  }

  .album-cover-mini {
    width: 128px;
    height: 128px;
  }

  .wall-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .waterfall-layout.mode-list {
    --tile-row-height: 96px;
  }

  .detail-pagination {
    grid-template-columns: 1fr;
    justify-items: center;
  }
}
</style>
