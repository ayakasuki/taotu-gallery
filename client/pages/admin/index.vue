<template>
  <div class="admin-overview">
    <header class="overview-header">
      <div class="overview-title-block">
        <h1>概览</h1>
        <p>欢迎回来，{{ currentUsername }}！ 这是您网站的整体运行情况。</p>
      </div>

      <div class="overview-tools">
        <div class="date-pill">
          <span>{{ formattedNow }}</span>
          <span class="sun-icon">☀</span>
        </div>
      </div>
    </header>

    <section class="stats-row" aria-label="核心统计">
      <article v-for="stat in statCards" :key="stat.label" class="metric-card" :class="stat.tone">
        <div class="metric-icon">
          <img :src="stat.icon" alt="" />
        </div>
        <div class="metric-copy">
          <span>{{ stat.label }}</span>
          <strong>{{ stat.value }}</strong>
        </div>
        <div class="metric-change">
          <span>较昨日</span>
          <b>{{ stat.change }}</b>
        </div>
        <svg class="trend-line" viewBox="0 0 120 48" aria-hidden="true">
          <polyline :points="stat.trend" />
        </svg>
      </article>
    </section>

    <section class="quick-panel">
      <h2>快捷操作</h2>
      <div class="quick-grid">
        <NuxtLink v-for="action in quickActions" :key="action.to" :to="action.to" class="quick-card" :class="action.tone">
          <div class="quick-icon">
            <img :src="action.icon" alt="" />
          </div>
          <div>
            <strong>{{ action.title }}</strong>
            <span>{{ action.description }}</span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section class="bottom-grid">
      <article class="dashboard-card system-card">
        <h2>系统状态</h2>
        <div class="status-list">
          <div v-for="item in systemRows" :key="item.label" class="status-row">
            <span class="row-label">{{ item.label }}</span>
            <div class="row-main">
              <template v-if="item.progress !== undefined">
                <div class="progress-copy">
                  <span>{{ item.value }}</span>
                  <em>{{ item.percent }}</em>
                </div>
                <div class="progress-track">
                  <i :style="{ width: item.progress + '%' }"></i>
                </div>
              </template>
              <template v-else>
                <span>{{ item.value }}</span>
              </template>
            </div>
            <span v-if="item.badge" class="ok-badge" :class="item.badgeTone ? `tone-${item.badgeTone}` : ''">{{ item.badge }}</span>
            <img v-else class="status-icon" src="/icons/admin/status-ok-placeholder.svg" alt="" />
          </div>
        </div>
      </article>

      <article class="dashboard-card activity-card">
        <div class="card-heading">
          <h2>近期活动</h2>
          <NuxtLink to="/admin/stats" class="view-all">查看全部</NuxtLink>
        </div>
        <div class="activity-list">
          <div v-for="activity in activities" :key="activity.id" class="activity-row">
            <div class="activity-avatar" :class="activity.type">
              <img :src="activity.icon" alt="" />
            </div>
            <p>
              <b v-if="activity.actor">{{ activity.actor }}</b>
              <span>{{ activity.message }}</span>
            </p>
            <time>{{ activity.time }}</time>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const now = ref(new Date())
const api = useApi()
const config = useRuntimeConfig()
const { readCurrentUserCache } = useUiCache()
const overview = ref(null)
const cachedUsername = ref('管理员')
let clockTimer = null

const weekdayMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const pad = (value) => String(value).padStart(2, '0')

const formattedNow = computed(() => {
  const date = now.value
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekdayMap[date.getDay()]} — ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
})

const normalizeAssetUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${config.public.apiBase || ''}${url}`
}

const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value || 0))

const formatChange = (value) => {
  const count = Number(value || 0)
  if (count > 0) return `+${formatNumber(count)}`
  if (count < 0) return `-${formatNumber(Math.abs(count))}`
  return '+0'
}

const buildTrend = (values = []) => {
  const list = Array.isArray(values) && values.length > 0 ? values.map(value => Number(value || 0)) : [0, 0, 0, 0, 0, 0, 0]
  const max = Math.max(...list, 1)
  const lastIndex = Math.max(1, list.length - 1)
  return list.map((value, index) => {
    const x = Math.round((index / lastIndex) * 114) + 3
    const y = Math.round(40 - (value / max) * 34) + 4
    return `${x},${y}`
  }).join(' ')
}

const statDefinitions = [
  {
    key: 'totalImages',
    label: '总图片',
    tone: 'tone-pink',
    icon: '/icons/admin/image-management-64x64.png'
  },
  {
    key: 'totalAlbums',
    label: '总相册',
    tone: 'tone-purple',
    icon: '/icons/admin/album-management-64x64.png'
  },
  {
    key: 'totalUsers',
    label: '总用户',
    tone: 'tone-blue',
    icon: '/icons/admin/users-64x64.png'
  },
  {
    key: 'todayApiCalls',
    label: '今日 API 调用',
    tone: 'tone-green',
    icon: '/icons/admin/api-settings-64x64.png'
  }
]

const statCards = computed(() => statDefinitions.map((item) => {
  const stat = overview.value?.stats?.[item.key] || {}
  const trend = overview.value?.trends?.[item.key] || []
  return {
    ...item,
    value: formatNumber(stat.value),
    change: formatChange(stat.change),
    trend: buildTrend(trend)
  }
}))

const currentUsername = computed(() => overview.value?.currentUser?.username || cachedUsername.value)

const quickActions = [
  {
    title: '标签设置',
    description: '管理标签与分类体系',
    to: '/admin/tags',
    tone: 'tone-pink',
    icon: '/icons/admin/tag-settings-64x64.png'
  },
  {
    title: '备份与云同步',
    description: '备份恢复和 WebDAV 同步',
    to: '/admin/stats',
    tone: 'tone-purple',
    icon: '/icons/admin/ops-64x64.png'
  },
  {
    title: '综合配置',
    description: '路径、图库和 Token 配置',
    to: '/admin/paths',
    tone: 'tone-blue',
    icon: '/icons/admin/custom-paths-64x64.png'
  },
  {
    title: '运维监控',
    description: '系统运行监控与分析',
    to: '/admin/stats',
    tone: 'tone-green',
    icon: '/icons/admin/stats-64x64.png'
  }
]

const systemRows = computed(() => overview.value?.system?.rows || [])

const activities = computed(() => {
  const list = overview.value?.activities || []
  return list.map((item, index) => ({
    id: item.id || `${item.actor || item.kind}-${item.message || ''}-${item.createdAt || item.time || index}`,
    type: item.kind === 'system' ? 'system' : index % 3 === 1 ? 'user alt' : index % 3 === 2 ? 'user warm' : 'user',
    icon: item.kind === 'system'
      ? (item.icon || '/icons/admin/ops-64x64.png')
      : (normalizeAssetUrl(item.avatar) || '/icons/nav/user-avatar-128x128.png'),
    actor: item.actor || '',
    message: item.message || '',
    time: item.time || ''
  }))
})

onMounted(async () => {
  const cachedUser = readCurrentUserCache()
  if (cachedUser?.username) {
    cachedUsername.value = cachedUser.username
  } else {
    try {
      const token = localStorage.getItem('jwt_token')
      const payload = token ? JSON.parse(atob(token.split('.')[1])) : null
      cachedUsername.value = payload?.username || payload?.name || cachedUsername.value
    } catch {}
  }

  clockTimer = window.setInterval(() => {
    now.value = new Date()
  }, 1000)
  try {
    overview.value = await api.get('/api/admin/stats/overview')
  } catch (err) {
    console.error('获取管理概览失败:', err)
  }
})

onBeforeUnmount(() => {
  if (clockTimer) window.clearInterval(clockTimer)
})
</script>

<style scoped>
.admin-overview {
  position: relative;
  min-height: calc(100vh - 108px);
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 2px 0 6px;
  color: #26334d;
}

.admin-overview::before {
  content: '';
  position: fixed;
  inset: 64px 0 0 220px;
  z-index: -1;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(248, 251, 255, 0.92) 0%, rgba(255, 247, 251, 0.7) 46%, rgba(245, 250, 255, 0.9) 100%),
    linear-gradient(135deg, rgba(255, 218, 232, 0.42), rgba(220, 240, 255, 0.4) 48%, rgba(236, 255, 247, 0.28));
}

.overview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  min-height: 58px;
}

.overview-title-block h1 {
  margin: 0 0 8px;
  color: #1f2b44;
  font-size: 24px;
  line-height: 1.12;
  font-weight: 900;
  letter-spacing: 0;
}

.overview-title-block p {
  margin: 0;
  color: #748198;
  font-size: 14px;
  line-height: 1.5;
  font-weight: 700;
}

.overview-tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 280px;
  padding-top: 6px;
}

.date-pill {
  min-height: 42px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border: 1px solid rgba(225, 229, 239, 0.9);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.72);
  color: #66738d;
  font-size: 13px;
  font-weight: 800;
  box-shadow: 0 9px 24px rgba(76, 90, 122, 0.08);
  backdrop-filter: blur(18px) saturate(1.08);
}

.sun-icon {
  color: #ffad42;
  font-size: 18px;
  line-height: 1;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 22px;
}

.metric-card,
.quick-panel,
.dashboard-card {
  border: 1px solid rgba(255, 255, 255, 0.82);
  background: rgba(255, 255, 255, 0.62);
  box-shadow: 0 18px 44px rgba(79, 92, 124, 0.1);
  backdrop-filter: blur(22px) saturate(1.1);
}

.metric-card {
  position: relative;
  min-height: 136px;
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr);
  grid-template-rows: auto 1fr;
  column-gap: 18px;
  row-gap: 14px;
  padding: 20px 22px 18px;
  border-radius: 15px;
  overflow: hidden;
}

.metric-icon,
.quick-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid currentColor;
  border-radius: 14px;
  background: color-mix(in srgb, currentColor 9%, white);
}

.metric-icon {
  width: 58px;
  height: 58px;
}

.metric-icon img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.metric-copy {
  min-width: 0;
  padding-top: 3px;
}

.metric-copy span {
  display: block;
  margin-bottom: 7px;
  color: #68758f;
  font-size: 14px;
  font-weight: 800;
}

.metric-copy strong {
  color: #202a42;
  font-size: 27px;
  line-height: 1.05;
  font-weight: 900;
  letter-spacing: 0;
}

.metric-change {
  grid-column: 1 / 2;
  display: inline-flex;
  align-self: end;
  align-items: center;
  gap: 8px;
  color: #7c889e;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}

.metric-change b {
  color: var(--metric-tone, currentColor);
  font-weight: 900;
}

.trend-line {
  grid-column: 2 / 3;
  align-self: end;
  justify-self: end;
  width: 126px;
  height: 48px;
  color: currentColor;
}

.trend-line polyline {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.quick-panel {
  min-height: 156px;
  padding: 20px 24px 24px;
  border-radius: 16px;
}

.quick-panel h2,
.dashboard-card h2 {
  margin: 0;
  color: #26334d;
  font-size: 18px;
  line-height: 1.2;
  font-weight: 900;
  letter-spacing: 0;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 28px;
  margin-top: 16px;
}

.quick-card {
  min-height: 86px;
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  padding: 16px 20px;
  border: 1px solid color-mix(in srgb, currentColor 24%, white);
  border-radius: 14px;
  background: color-mix(in srgb, currentColor 5%, white);
  color: currentColor;
  text-decoration: none;
  box-shadow: 0 10px 24px rgba(78, 88, 120, 0.04);
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.quick-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(78, 88, 120, 0.08);
  background: color-mix(in srgb, currentColor 8%, white);
}

.quick-card:focus,
.quick-card:focus-visible {
  outline: none;
}

.quick-card:active {
  transform: scale(0.985);
}

.quick-icon {
  width: 52px;
  height: 52px;
  border-radius: 13px;
}

.quick-icon img {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.quick-card strong {
  display: block;
  margin-bottom: 7px;
  color: currentColor;
  font-size: 17px;
  line-height: 1.15;
  font-weight: 900;
}

.quick-card span {
  display: block;
  color: #69768e;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 700;
}

.bottom-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 22px;
}

.dashboard-card {
  min-height: 364px;
  padding: 20px 24px 18px;
  border-radius: 16px;
}

.status-list,
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 18px;
}

.status-row,
.activity-row {
  min-height: 35px;
  display: grid;
  align-items: center;
  border: 1px solid rgba(224, 229, 238, 0.72);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.52);
  box-shadow: 0 7px 18px rgba(76, 88, 116, 0.035);
}

.status-row {
  grid-template-columns: 180px minmax(0, 1fr) max-content;
  gap: 12px;
  padding: 0 12px;
}

.row-label {
  color: #758198;
  font-size: 13px;
  font-weight: 800;
}

.row-main {
  min-width: 0;
  color: #53627c;
  font-size: 13px;
  font-weight: 800;
}

.progress-copy {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 50px;
  gap: 10px;
  margin-bottom: 5px;
}

.progress-copy em {
  color: #8a95a8;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
  text-align: right;
}

.progress-track {
  height: 4px;
  border-radius: 999px;
  background: rgba(224, 230, 240, 0.82);
  overflow: hidden;
}

.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #4aa3f2;
}

.status-icon {
  justify-self: end;
  width: 18px;
  height: 18px;
  display: block;
  object-fit: contain;
}

.ok-badge {
  justify-self: end;
  min-width: 62px;
  padding: 3px 8px;
  border: 1px solid rgba(57, 202, 150, 0.24);
  border-radius: 6px;
  background: rgba(218, 255, 241, 0.82);
  color: #27b989;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
}

.ok-badge.tone-success {
  border-color: rgba(57, 202, 150, 0.24);
  background: rgba(218, 255, 241, 0.82);
  color: #27b989;
}

.ok-badge.tone-warning {
  border-color: rgba(255, 173, 66, 0.28);
  background: rgba(255, 244, 222, 0.86);
  color: #d88a1e;
}

.ok-badge.tone-muted {
  border-color: rgba(148, 160, 180, 0.24);
  background: rgba(242, 246, 251, 0.86);
  color: #7d8798;
}

.card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.view-all {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border: 1px solid rgba(248, 95, 154, 0.18);
  border-radius: 9px;
  background: rgba(255, 240, 246, 0.82);
  color: #f05f99;
  font-size: 12px;
  font-weight: 900;
  text-decoration: none;
  outline: none;
  transition: transform 0.18s ease, background 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}

.view-all:focus,
.view-all:focus-visible {
  outline: none;
}

.view-all:active {
  transform: scale(0.985);
}

.activity-row {
  grid-template-columns: 28px minmax(0, 1fr) 72px;
  gap: 12px;
  min-height: 39px;
  padding: 0 12px;
}

.activity-avatar {
  width: 23px;
  height: 23px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(255, 232, 240, 0.92);
}

.activity-avatar.system {
  border: 1px solid rgba(161, 112, 240, 0.26);
  background: rgba(244, 235, 255, 0.9);
}

.activity-avatar.alt {
  background: rgba(255, 224, 235, 0.94);
}

.activity-avatar.warm {
  background: rgba(255, 240, 220, 0.94);
}

.activity-avatar img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.activity-avatar.system img {
  width: 15px;
  height: 15px;
  object-fit: contain;
}

.activity-row p {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: #5b6881;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-row b {
  margin-right: 4px;
  color: #f05f99;
  font-weight: 900;
}

.activity-row time {
  color: #748198;
  font-size: 12px;
  font-weight: 800;
  text-align: right;
  white-space: nowrap;
}

.tone-pink {
  color: #f36d9d;
  --metric-tone: #f36d9d;
}

.tone-purple {
  color: #a47be8;
  --metric-tone: #a47be8;
}

.tone-blue {
  color: #55a8ee;
  --metric-tone: #55a8ee;
}

.tone-green {
  color: #42bf8e;
  --metric-tone: #42bf8e;
}

@media (max-width: 1380px) {
  .stats-row,
  .quick-grid {
    gap: 16px;
  }

  .quick-card {
    padding: 14px;
    gap: 14px;
  }

  .status-row {
    grid-template-columns: 128px minmax(0, 1fr) max-content;
  }
}

@media (max-width: 1180px) {
  .stats-row,
  .quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .bottom-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .overview-header {
    flex-direction: column;
  }

  .overview-tools {
    min-width: 0;
    width: 100%;
    justify-content: flex-start;
  }

  .stats-row,
  .quick-grid {
    grid-template-columns: 1fr;
  }

  .metric-card {
    min-height: 132px;
  }

  .status-row,
  .activity-row {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 10px 12px;
  }

  .status-icon,
  .ok-badge,
  .activity-row time {
    justify-self: start;
    text-align: left;
  }
}
</style>
