<template>
  <div class="admin-stats">
    <h1 class="page-title">统计监控</h1>
    <div class="stats-overview">
      <div class="fluent-card stat-card" v-for="stat in overviewStats" :key="stat.label">
        <div class="stat-value">{{ stat.value }}</div>
        <div class="stat-label">{{ stat.label }}</div>
      </div>
    </div>
    <div class="stats-detail">
      <div class="fluent-card">
        <h3>API 调用量（近 30 天）</h3>
        <div class="stat-table">
          <div v-for="item in apiStats" :key="item.period" class="stat-row">
            <span>{{ item.period }}</span>
            <span>{{ item.count }} 次</span>
          </div>
          <div v-if="apiStats.length === 0" class="empty-msg">暂无数据</div>
        </div>
      </div>
      <div class="fluent-card">
        <h3>热门图片</h3>
        <div class="stat-table">
          <div v-for="img in topImages" :key="img.id" class="stat-row">
            <span>{{ img.filename }}</span>
            <span>{{ img.view_count }} 浏览</span>
          </div>
          <div v-if="topImages.length === 0" class="empty-msg">暂无数据</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
const overviewStats = ref([])
const apiStats = ref([])
const topImages = ref([])

onMounted(async () => {
  try {
    const api = useApi()
    const [stats, apiData, images] = await Promise.all([
      api.get('/api/admin/stats'),
      api.get('/api/admin/stats/api-calls?period=day'),
      api.get('/api/admin/stats/top-images?limit=10')
    ])
    overviewStats.value = [
      { label: '总图片', value: stats.totalImages || 0 },
      { label: '总相册', value: stats.totalAlbums || 0 },
      { label: '总用户', value: stats.totalUsers || 0 },
      { label: '今日 API 调用', value: stats.today?.apiCalls || 0 },
      { label: '今日上传', value: stats.today?.uploads || 0 }
    ]
    apiStats.value = apiData.stats || []
    topImages.value = images.images || []
  } catch {}
})
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.stats-overview { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-md); margin-bottom: var(--space-xl); }
.stat-card { text-align: center; padding: var(--space-xl); }
.stat-value { font-size: 28px; font-weight: 700; color: var(--fluent-blue); }
.stat-label { font-size: 13px; color: var(--fluent-text-secondary); margin-top: 4px; }
.stats-detail { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg); }
.stats-detail h3 { font-size: 15px; font-weight: 600; margin-bottom: var(--space-md); }
.stat-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--fluent-border); font-size: 13px; }
.empty-msg { text-align: center; padding: var(--space-lg); color: var(--fluent-text-secondary); }
</style>
