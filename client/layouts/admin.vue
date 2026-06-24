<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="sidebar-header">
        <NuxtLink to="/admin" class="sidebar-logo">管理后台</NuxtLink>
      </div>
      <nav class="sidebar-nav">
        <NuxtLink to="/admin" class="sidebar-link">概览</NuxtLink>
        <NuxtLink to="/admin/images" class="sidebar-link">图片管理</NuxtLink>
        <NuxtLink to="/admin/tags" class="sidebar-link">标签设置</NuxtLink>
        <NuxtLink to="/admin/conditions" class="sidebar-link">条件标签</NuxtLink>
        <NuxtLink to="/admin/models" class="sidebar-link">模型管理</NuxtLink>
        <NuxtLink to="/admin/paths" class="sidebar-link">自定义路径</NuxtLink>
        <NuxtLink to="/admin/database" class="sidebar-link">数据库</NuxtLink>
        <NuxtLink to="/admin/gallery" class="sidebar-link">图库设置</NuxtLink>
        <NuxtLink to="/admin/api" class="sidebar-link">API 设置</NuxtLink>
        <NuxtLink to="/admin/users" class="sidebar-link">用户管理</NuxtLink>
        <NuxtLink to="/admin/site-config" class="sidebar-link">网站配置</NuxtLink>
        <NuxtLink to="/admin/stats" class="sidebar-link">统计监控</NuxtLink>
        <NuxtLink to="/admin/backup" class="sidebar-link">备份恢复</NuxtLink>
        <NuxtLink to="/admin/cloud-sync" class="sidebar-link">云同步</NuxtLink>
      </nav>
      <div class="sidebar-footer">
        <NuxtLink to="/" class="sidebar-link">返回前台</NuxtLink>
        <button class="sidebar-link logout-btn" @click="handleLogout">退出登录</button>
      </div>
    </aside>
    <main class="admin-main">
      <slot />
    </main>
  </div>
</template>

<script setup>
const { logout } = useAuth()
const handleLogout = () => logout()
</script>

<style scoped>
.admin-layout { display: flex; min-height: 100vh; }
.admin-sidebar { width: 240px; background: var(--fluent-bg-card); border-right: 1px solid var(--fluent-border); display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
.sidebar-header { padding: var(--space-md) var(--space-lg); border-bottom: 1px solid var(--fluent-border); }
.sidebar-logo { font-size: 16px; font-weight: 600; color: var(--fluent-blue); text-decoration: none; }
.sidebar-nav { flex: 1; padding: var(--space-sm); overflow-y: auto; }
.sidebar-link { display: block; padding: 8px 16px; border-radius: var(--radius-sm); font-size: 14px; color: var(--fluent-text-secondary); transition: all var(--transition-fast); text-decoration: none; width: 100%; text-align: left; border: none; background: none; cursor: pointer; }
.sidebar-link:hover { background: var(--fluent-hover); color: var(--fluent-text); }
.sidebar-link.router-link-active { background: var(--fluent-blue-light); color: var(--fluent-blue); font-weight: 500; }
.sidebar-footer { padding: var(--space-sm); border-top: 1px solid var(--fluent-border); }
.logout-btn { color: #d13438; }
.logout-btn:hover { background: #fde7e9; }
.admin-main { flex: 1; margin-left: 240px; padding: var(--space-lg); background: var(--fluent-bg); }
</style>
