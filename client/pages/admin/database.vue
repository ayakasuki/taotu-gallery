<template>
  <div class="admin-database">
    <h1 class="page-title">数据库设置</h1>
    <div class="stats-grid">
      <div class="fluent-card stat-card">
        <div class="stat-dot" :class="{ connected: dbStatus.connected }"></div>
        <div>
          <div class="stat-label">连接状态</div>
          <div class="stat-value">{{ dbStatus.connected ? '正常' : '断开' }}</div>
        </div>
      </div>
      <div class="fluent-card stat-card">
        <div class="stat-label">数据库</div>
        <div class="stat-value">{{ dbConfig.database || '-' }}</div>
      </div>
      <div class="fluent-card stat-card">
        <div class="stat-label">用户</div>
        <div class="stat-value">{{ dbConfig.user || '-' }}</div>
      </div>
      <div class="fluent-card stat-card">
        <div class="stat-label">主机</div>
        <div class="stat-value">{{ dbConfig.host || '-' }}:{{ dbConfig.port || 3306 }}</div>
      </div>
    </div>
    <div class="fluent-card" style="margin-top: var(--space-lg);">
      <h3>近期日志</h3>
      <div class="empty-msg">暂无日志</div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const dbStatus = ref({ connected: false })
const dbConfig = ref({})

onMounted(async () => {
  try {
    const api = useApi()
    const [status, config] = await Promise.all([
      api.get('/api/admin/database/status'),
      api.get('/api/admin/database/config')
    ])
    dbStatus.value = status
    dbConfig.value = config
  } catch {}
})
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-md); }
.stat-card { display: flex; align-items: center; gap: var(--space-md); padding: var(--space-lg); }
.stat-dot { width: 12px; height: 12px; border-radius: 50%; background: #d13438; }
.stat-dot.connected { background: #107c10; }
.stat-label { font-size: 12px; color: var(--fluent-text-secondary); }
.stat-value { font-size: 16px; font-weight: 600; margin-top: 2px; }
.empty-msg { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
</style>
