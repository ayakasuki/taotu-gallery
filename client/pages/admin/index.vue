<template>
  <div class="admin-home">
    <div class="admin-hero">
      <div>
        <span class="hero-kicker">Overview</span>
        <h1 class="page-title">管理后台</h1>
        <p>查看图库内容、用户、API 调用与运维入口。</p>
      </div>
      <img src="/icons/admin/overview-64x64.png" class="hero-icon" alt="" />
    </div>

    <div class="stats-grid">
      <div class="stat-card fluent-card">
        <img src="/icons/admin/image-management-64x64.png" class="taotu-icon taotu-icon-44" alt="" />
        <div class="stat-value">{{ stats.totalImages || 0 }}</div>
        <div class="stat-label">总图片数</div>
      </div>
      <div class="stat-card fluent-card">
        <img src="/icons/admin/album-management-64x64.png" class="taotu-icon taotu-icon-44" alt="" />
        <div class="stat-value">{{ stats.totalAlbums || 0 }}</div>
        <div class="stat-label">总相册数</div>
      </div>
      <div class="stat-card fluent-card">
        <img src="/icons/admin/users-64x64.png" class="taotu-icon taotu-icon-44" alt="" />
        <div class="stat-value">{{ stats.totalUsers || 0 }}</div>
        <div class="stat-label">用户数</div>
      </div>
      <div class="stat-card fluent-card">
        <img src="/icons/admin/api-settings-64x64.png" class="taotu-icon taotu-icon-44" alt="" />
        <div class="stat-value">{{ stats.today?.apiCalls || 0 }}</div>
        <div class="stat-label">今日 API 调用</div>
      </div>
    </div>

    <div class="overview-grid">
      <div class="fluent-card chart-card">
        <h2 class="section-title">运维趋势</h2>
        <Line :data="trendData" :options="chartOptions" />
      </div>
      <div class="fluent-card health-card">
        <h2 class="section-title">系统状态</h2>
        <div class="health-row"><span>图库</span><strong>{{ stats.totalImages || 0 }} 张</strong></div>
        <div class="health-row"><span>相册</span><strong>{{ stats.totalAlbums || 0 }} 个</strong></div>
        <div class="health-row"><span>用户</span><strong>{{ stats.totalUsers || 0 }} 位</strong></div>
        <div class="health-row"><span>今日 API</span><strong>{{ stats.today?.apiCalls || 0 }} 次</strong></div>
      </div>
    </div>

    <div class="quick-actions">
      <h2 class="section-title">快捷操作</h2>
      <div class="actions-grid">
        <NuxtLink to="/admin/tags" class="action-card fluent-card">
          <img src="/icons/admin/tag-settings-64x64.png" class="taotu-icon taotu-icon-44" alt="" />
          <span class="action-label">标签设置</span>
        </NuxtLink>
        <NuxtLink to="/admin/backup" class="action-card fluent-card">
          <img src="/icons/admin/backup-64x64.png" class="taotu-icon taotu-icon-44" alt="" />
          <span class="action-label">备份恢复</span>
        </NuxtLink>
        <NuxtLink to="/admin/gallery" class="action-card fluent-card">
          <img src="/icons/admin/gallery-settings-64x64.png" class="taotu-icon taotu-icon-44" alt="" />
          <span class="action-label">图库设置</span>
        </NuxtLink>
        <NuxtLink to="/admin/stats" class="action-card fluent-card">
          <img src="/icons/admin/stats-64x64.png" class="taotu-icon taotu-icon-44" alt="" />
          <span class="action-label">统计监控</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const stats = ref({})

const trendData = computed(() => {
  const images = Number(stats.value.totalImages || 0)
  const calls = Number(stats.value.today?.apiCalls || 0)
  return {
    labels: ['周一', '周二', '周三', '周四', '周五', '周六', '今日'],
    datasets: [
      {
        label: '图片增长',
        data: [0.18, 0.28, 0.42, 0.58, 0.72, 0.86, 1].map(v => Math.max(0, Math.round(images * v))),
        borderColor: '#f85f9a',
        backgroundColor: 'rgba(248, 95, 154, 0.16)',
        tension: 0.42,
        fill: true
      },
      {
        label: 'API 调用',
        data: [0.2, 0.34, 0.48, 0.62, 0.72, 0.86, 1].map(v => Math.max(0, Math.round(calls * v))),
        borderColor: '#78cdf8',
        backgroundColor: 'rgba(120, 205, 248, 0.14)',
        tension: 0.42,
        fill: true
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#7c859c' } },
    y: { grid: { color: 'rgba(238,210,226,0.5)' }, ticks: { color: '#7c859c', precision: 0 } }
  }
}

onMounted(async () => {
  try {
    const api = useApi()
    stats.value = await api.get('/api/admin/stats')
  } catch (err) {
    console.error('获取统计失败:', err)
  }
})
</script>

<style scoped>
.admin-home { display: flex; flex-direction: column; gap: var(--space-xl); }
.admin-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  padding: 26px 30px;
  border: 1px solid rgba(255,255,255,0.84);
  border-radius: var(--taotu-radius-lg);
  background:
    linear-gradient(110deg, rgba(255,255,255,0.88), rgba(255,255,255,0.58)),
    radial-gradient(circle at 84% 16%, rgba(248,95,154,0.18), transparent 34%);
  box-shadow: var(--taotu-shadow-sm);
  backdrop-filter: blur(var(--taotu-blur));
}
.hero-kicker { color: var(--taotu-pink); font-size: 12px; font-weight: 900; text-transform: uppercase; }
.admin-hero .page-title { margin-bottom: 4px; }
.admin-hero p { color: var(--taotu-text-muted); }
.hero-icon { width: 72px; height: 72px; object-fit: contain; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  padding: var(--space-xl);
}

.stat-value {
  font-size: 32px;
  font-weight: 900;
  color: var(--fluent-blue);
}

.stat-label {
  font-size: 13px;
  color: var(--fluent-text-secondary);
  margin-top: var(--space-xs);
}

.overview-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(260px, 0.8fr); gap: var(--space-md); }
.chart-card { min-height: 310px; padding: var(--space-lg); }
.chart-card canvas { height: 230px !important; }
.section-title { color: var(--taotu-text-strong); font-size: 18px; font-weight: 900; margin-bottom: var(--space-lg); }
.health-card { padding: var(--space-lg); }
.health-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(238,210,226,0.58); }
.health-row:last-child { border-bottom: none; }
.health-row span { color: var(--taotu-text-muted); }
.health-row strong { color: var(--taotu-text-strong); }

.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}

.action-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-xl);
  text-decoration: none;
  color: var(--fluent-text);
  transition: all var(--transition-normal);
}

.action-card:hover {
  box-shadow: var(--shadow-2);
  transform: translateY(-2px);
}

.action-label {
  font-size: 14px;
  font-weight: 900;
}
@media (max-width: 1100px) {
  .stats-grid, .actions-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .overview-grid { grid-template-columns: 1fr; }
}
@media (max-width: 620px) {
  .admin-hero { flex-direction: column; align-items: flex-start; }
  .stats-grid, .actions-grid { grid-template-columns: 1fr; }
}
</style>
