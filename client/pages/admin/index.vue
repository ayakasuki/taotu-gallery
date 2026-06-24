<template>
  <div class="admin-home">
    <h1 class="page-title">管理后台</h1>

    <div class="stats-grid">
      <div class="stat-card fluent-card">
        <div class="stat-value">{{ stats.totalImages || 0 }}</div>
        <div class="stat-label">总图片数</div>
      </div>
      <div class="stat-card fluent-card">
        <div class="stat-value">{{ stats.totalAlbums || 0 }}</div>
        <div class="stat-label">总相册数</div>
      </div>
      <div class="stat-card fluent-card">
        <div class="stat-value">{{ stats.totalUsers || 0 }}</div>
        <div class="stat-label">用户数</div>
      </div>
      <div class="stat-card fluent-card">
        <div class="stat-value">{{ stats.today?.apiCalls || 0 }}</div>
        <div class="stat-label">今日 API 调用</div>
      </div>
    </div>

    <div class="quick-actions">
      <h2 class="section-title">快捷操作</h2>
      <div class="actions-grid">
        <NuxtLink to="/admin/tags" class="action-card fluent-card">
          <span class="action-icon">🏷️</span>
          <span class="action-label">标签设置</span>
        </NuxtLink>
        <NuxtLink to="/admin/backup" class="action-card fluent-card">
          <span class="action-icon">💾</span>
          <span class="action-label">备份恢复</span>
        </NuxtLink>
        <NuxtLink to="/admin/gallery" class="action-card fluent-card">
          <span class="action-icon">🖼️</span>
          <span class="action-label">图库设置</span>
        </NuxtLink>
        <NuxtLink to="/admin/stats" class="action-card fluent-card">
          <span class="action-icon">📊</span>
          <span class="action-label">统计监控</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const stats = ref({})

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
.page-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: var(--space-xl);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-2xl);
}

.stat-card {
  text-align: center;
  padding: var(--space-xl);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--fluent-blue);
}

.stat-label {
  font-size: 13px;
  color: var(--fluent-text-secondary);
  margin-top: var(--space-xs);
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: var(--space-lg);
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}

.action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
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

.action-icon {
  font-size: 32px;
}

.action-label {
  font-size: 14px;
  font-weight: 500;
}
</style>
