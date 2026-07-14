<template>
  <div v-if="adminAccessReady && adminAccessAllowed" class="admin-page">
    <header class="admin-topbar">
      <NuxtLink to="/admin" class="admin-brand">
        <img v-if="logoUrl" :src="logoUrl" class="taotu-icon brand-icon" alt="" />
        <span v-else-if="siteConfigReady" class="brand-fallback">桃</span>
        <span>{{ siteName }}</span>
        <small>管理后台</small>
      </NuxtLink>

      <nav class="admin-topnav">
        <NuxtLink
          v-for="item in topNavItems"
          :key="item.to"
          :to="item.to"
          class="topnav-link"
          active-class=""
          exact-active-class=""
          :class="{ active: isTopNavActive(item) }"
        >{{ item.label }}</NuxtLink>
      </nav>

      <div class="admin-user-slot">
        <NavNoticeUser
          :is-logged-in="true"
          :user="currentUserInfo"
          :avatar-url="avatarUrl"
          :fallback-ready="currentUserReady"
          username-fallback="管理员"
          @logout="handleLogout"
        />
      </div>
    </header>

    <div class="admin-body">
      <aside class="admin-sidebar">
        <nav class="sidebar-scroll">
          <section v-for="group in menuGroups" :key="group.title" class="menu-group">
            <h3>{{ group.title }}</h3>
            <NuxtLink v-for="item in group.items" :key="item.to" :to="item.to" class="sidebar-link">
              <TaotuIcon :name="item.icon" class="taotu-icon taotu-icon-20" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </section>
        </nav>
        <div class="sidebar-footer">
          <NuxtLink to="/" class="sidebar-action">
            <TaotuIcon name="return-front" class="taotu-icon taotu-icon-20" />
            返回前台
          </NuxtLink>
          <button class="sidebar-action danger" @click="handleLogout">
            <TaotuIcon name="logout" class="taotu-icon taotu-icon-20" />
            退出登录
          </button>
        </div>
      </aside>

      <main class="admin-main" :class="{ 'admin-main-pop': adminMainPop }">
        <slot />
      </main>
    </div>
  </div>
  <div v-else class="admin-access-gate">
    <div class="admin-access-card">
      <strong>{{ adminAccessReady ? '无权访问管理后台' : '正在验证管理员权限' }}</strong>
      <p>{{ adminAccessReady ? '普通用户不能访问后台页面或后台数据，正在返回你的仪表盘。' : '请稍候，系统正在确认当前会话是否拥有管理员权限。' }}</p>
    </div>
  </div>
</template>

<script setup>
const api = useApi()
const route = useRoute()
const {
  readSiteConfigCache,
  writeSiteConfigCache,
  readCurrentUserCache,
  writeCurrentUserCache,
  clearCurrentUserCache,
  clearAuthSession,
  syncAuthCookie,
  isAuthFailure,
  normalizeAssetUrl
} = useUiCache()
const username = ref('管理员')
const siteName = ref('桃图智库')
const logoUrl = ref('')
const avatarUrl = ref('')
const currentUserInfo = ref({ username: '管理员' })
const siteConfigReady = ref(false)
const currentUserReady = ref(false)
const adminMainPop = ref(false)
const adminAccessReady = ref(false)
const adminAccessAllowed = ref(false)

const topNavItems = [
  { to: '/', label: '图库' },
  { to: '/albums', label: '相册' },
  { to: '/api-docs', label: 'API' },
  { to: '/upload', label: '上传' },
  { to: '/dashboard', label: '仪表盘' },
  { to: '/admin', label: '管理' }
]

const isTopNavActive = (item) => {
  if (!item?.to) return false
  if (item.to === '/') return route.path === '/'
  return route.path === item.to || route.path.startsWith(`${item.to}/`)
}

const menuGroups = [
  {
    title: '内容管理',
    items: [
      { to: '/admin', label: '概览', icon: 'overview' },
      { to: '/admin/images', label: '图片管理', icon: 'image-management' },
      { to: '/admin/paths', label: '综合配置', icon: 'custom-paths' }
    ]
  },
  {
    title: '标签体系',
    items: [
      { to: '/admin/tags', label: '标签设置', icon: 'tag-settings' },
      { to: '/admin/conditions', label: '条件标签', icon: 'condition-tags' },
      { to: '/admin/models', label: '模型管理', icon: 'model-management' }
    ]
  },
  {
    title: '用户与权限',
    items: [
      { to: '/admin/users', label: '用户管理', icon: 'users' }
    ]
  },
  {
    title: '站点设置',
    items: [
      { to: '/admin/site-config', label: '网站配置', icon: 'site-config' },
      { to: '/admin/announcements', label: '公告中心', icon: 'announcements' }
    ]
  },
  {
    title: '运维工具',
    items: [
      { to: '/admin/stats', label: '运维监控', icon: 'stats' }
    ]
  }
]

const applySiteConfig = (siteConfig = {}) => {
  siteName.value = siteConfig.siteName || '桃图智库'
  logoUrl.value = normalizeAssetUrl(siteConfig.icon)
  siteConfigReady.value = true
}

const applyCurrentUser = (currentUser = {}) => {
  username.value = currentUser.username || currentUser.name || username.value
  avatarUrl.value = normalizeAssetUrl(currentUser.avatar)
  currentUserInfo.value = { ...currentUser, username: username.value }
  currentUserReady.value = true
}

const handleSiteConfigUpdated = (event) => {
  if (event.detail) applySiteConfig(event.detail)
}

const handleCurrentUserUpdated = (event) => {
  if (event.detail) applyCurrentUser(event.detail)
}

const resetAdminUserState = () => {
  username.value = '管理员'
  avatarUrl.value = ''
  currentUserInfo.value = { username: '管理员' }
  currentUserReady.value = true
}

const denyAdminAccess = (target = '/dashboard') => {
  adminAccessAllowed.value = false
  adminAccessReady.value = true
  navigateTo(target, { replace: true })
}

const triggerAdminMainPop = async () => {
  if (!import.meta.client) return
  adminMainPop.value = false
  await nextTick()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      adminMainPop.value = true
    })
  })
}

watch(() => route.path, triggerAdminMainPop, { flush: 'post' })

onMounted(async () => {
  const cachedSiteConfig = readSiteConfigCache()
  if (cachedSiteConfig) applySiteConfig(cachedSiteConfig)
  const cachedUser = readCurrentUserCache()
  if (cachedUser) applyCurrentUser(cachedUser)
  window.addEventListener('taotu:site-config-updated', handleSiteConfigUpdated)
  window.addEventListener('taotu:current-user-updated', handleCurrentUserUpdated)

  const token = localStorage.getItem('jwt_token')
  if (!token) {
    clearAuthSession()
    resetAdminUserState()
    adminAccessReady.value = true
    navigateTo('/login', { replace: true })
    return
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    syncAuthCookie()
    if (payload.role !== 'admin') {
      currentUserReady.value = true
      denyAdminAccess('/dashboard')
      return
    }
    if (!cachedUser || cachedUser.id !== payload.id) {
      username.value = payload.username || payload.name || '管理员'
      currentUserInfo.value = { ...payload, username: username.value }
    }
  } catch {}
  currentUserReady.value = !!cachedUser?.avatar
  try {
    const [siteConfig, me] = await Promise.all([
      api.get('/api/admin/site-config/public'),
      api.get('/api/admin/auth/me')
    ])
    if (me?.role !== 'admin') {
      applySiteConfig(siteConfig)
      writeSiteConfigCache(siteConfig)
      denyAdminAccess('/dashboard')
      return
    }
    applySiteConfig(siteConfig)
    applyCurrentUser(me)
    writeSiteConfigCache(siteConfig)
    writeCurrentUserCache(me)
    adminAccessAllowed.value = true
    adminAccessReady.value = true
    triggerAdminMainPop()
  } catch (err) {
    if (isAuthFailure(err)) {
      clearAuthSession()
      resetAdminUserState()
      adminAccessReady.value = true
      navigateTo('/login')
    }
    currentUserReady.value = true
    adminAccessReady.value = true
  }
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  window.removeEventListener('taotu:site-config-updated', handleSiteConfigUpdated)
  window.removeEventListener('taotu:current-user-updated', handleCurrentUserUpdated)
})

const handleLogout = () => {
  clearAuthSession()
  navigateTo('/login')
}
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: var(--taotu-bg-gradient);
}

.admin-access-gate {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--taotu-bg-gradient);
}

.admin-access-card {
  width: min(420px, calc(100vw - 32px));
  padding: 28px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: var(--taotu-radius-lg);
  background: rgba(255, 255, 255, 0.72);
  box-shadow: var(--taotu-shadow);
  backdrop-filter: blur(var(--taotu-blur));
  text-align: center;
}

.admin-access-card strong {
  display: block;
  color: var(--taotu-text-strong);
  font-size: 20px;
  font-weight: 900;
}

.admin-access-card p {
  margin: 10px 0 0;
  color: var(--taotu-text-muted);
  font-size: 14px;
  font-weight: 800;
  line-height: 1.7;
}

.admin-topbar {
  position: sticky;
  top: 0;
  z-index: 120;
  display: grid;
  grid-template-columns: 280px 1fr 250px;
  align-items: center;
  gap: 18px;
  min-height: 64px;
  padding: 0 28px;
  background: rgba(255, 255, 255, 0.82);
  border-bottom: 1px solid rgba(238, 210, 226, 0.62);
  backdrop-filter: blur(22px);
}

.admin-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--taotu-pink);
  font-size: 22px;
  font-weight: 900;
}

.admin-brand small {
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--taotu-pink-soft);
  color: var(--taotu-pink);
  font-size: 12px;
}

.brand-icon {
  width: 34px;
  height: 34px;

}

.brand-fallback {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  background: linear-gradient(135deg, var(--taotu-pink), var(--taotu-purple));
  color: white;
  font-size: 17px;
  font-weight: 900;
}

.admin-topnav {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.topnav-link {
  min-width: 70px;
  padding: 9px 14px;
  border-radius: var(--taotu-radius-sm);
  color: var(--taotu-text);
  text-align: center;
  font-weight: 800;
}

.topnav-link.active {
  background: var(--taotu-button-active-bg);
  color: var(--taotu-button-active-color);
}

.admin-user-slot {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.admin-body {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  min-height: calc(100vh - 64px);
}

.admin-sidebar {
  position: sticky;
  top: 64px;
  align-self: start;
  height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(238, 210, 226, 0.62);
  background: rgba(255, 255, 255, 0.56);
  backdrop-filter: blur(22px);
}

.sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 18px 14px;
}

.menu-group {
  padding-bottom: 14px;
  margin-bottom: 14px;
  border-bottom: 1px solid rgba(238, 210, 226, 0.52);
}

.menu-group:last-child {
  border-bottom: none;
}

.menu-group h3 {
  margin: 0 0 8px;
  padding: 0 8px;
  color: var(--taotu-text-muted);
  font-size: 12px;
  font-weight: 900;
}

.sidebar-link,
.sidebar-action {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: none;
  border-radius: var(--taotu-radius-sm);
  background: transparent;
  color: var(--taotu-text);
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: all var(--taotu-transition);
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.sidebar-link:hover,
.sidebar-link.router-link-active,
.sidebar-action:hover {
  background: rgba(255, 255, 255, 1);
  color: var(--taotu-pink);
}

.sidebar-link:focus,
.sidebar-link:focus-visible,
.sidebar-action:focus,
.sidebar-action:focus-visible {
  outline: none;
}

.sidebar-link:active,
.sidebar-action:active {
  transform: scale(0.985);
}

.sidebar-footer {
  display: grid;
  gap: 8px;
  padding: 14px;
}

.sidebar-action {
  justify-content: flex-start;
  border: 1px solid rgba(238, 210, 226, 0.62);
  background: rgba(255, 255, 255, 0.5);
}

.sidebar-action.danger {
  color: var(--taotu-danger);
}

.admin-main {
  min-width: 0;
  padding: 22px;
}

.admin-main > :deep(*) > :where(*) {
  transform: translate3d(0, 27px, 0) scale(0.978);
  will-change: transform;
}

.admin-main-pop > :deep(*) > :where(*) {
  animation: taotu-page-pop-transform var(--taotu-page-pop-duration) var(--taotu-page-pop-ease) both;
}

.admin-main :deep(.page-title) {
  margin: 0 0 var(--space-xl);
  color: var(--taotu-text-strong);
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 0;
}

.admin-main :deep(.admin-subhero) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
  padding: 24px 28px;
  border: 1px solid rgba(255, 255, 255, 0.84);
  border-radius: var(--taotu-radius-lg);
  background:
    linear-gradient(110deg, rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.56)),
    radial-gradient(circle at 86% 18%, rgba(120, 205, 248, 0.2), transparent 34%),
    radial-gradient(circle at 12% 10%, rgba(248, 95, 154, 0.14), transparent 28%);
  box-shadow: var(--taotu-shadow-sm);
  backdrop-filter: blur(var(--taotu-blur));
}

.admin-main :deep(.admin-subhero .page-title) {
  margin-bottom: 4px;
}

.admin-main :deep(.admin-subhero .page-title::after) {
  display: none;
}

.admin-main :deep(.hero-kicker) {
  color: var(--taotu-pink);
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.admin-main :deep(.admin-subhero p) {
  color: var(--taotu-text-muted);
  font-size: 14px;
}

.admin-main :deep(.subhero-icon) {
  width: 68px;
  height: 68px;

}

.admin-main :deep(.page-title::after) {
  content: '';
  display: block;
  width: 72px;
  height: 4px;
  margin-top: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--taotu-pink), var(--taotu-purple), var(--taotu-sky));
}

.admin-main :deep(.fluent-card) {
  background: rgba(255, 255, 255, 0.72);
  border-color: rgba(255, 255, 255, 0.84);
  border-radius: var(--taotu-radius-lg);
  box-shadow: var(--taotu-shadow-sm);
}

.admin-main :deep(.fluent-card h3),
.admin-main :deep(.section-title),
.admin-main :deep(.section-header h3) {
  color: var(--taotu-text-strong);
  font-weight: 900;
  letter-spacing: 0;
}

.admin-main :deep(.section-header) {
  padding-bottom: var(--space-md);
  border-bottom: 1px solid rgba(238, 210, 226, 0.58);
}

.admin-main :deep(.tabs),
.admin-main :deep(.source-toggle) {
  display: flex;
  gap: 4px;
  width: fit-content;
  padding: 4px;
  border: 1px solid var(--taotu-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
}

.admin-main :deep(.tab-btn),
.admin-main :deep(.source-btn) {
  border-radius: 999px;
  color: var(--taotu-text-muted);
  font-weight: 900;
}

.admin-main :deep(.tab-btn.active),
.admin-main :deep(.source-btn.active) {
  background: var(--taotu-pink-soft);
  color: var(--taotu-pink);
  box-shadow: var(--taotu-shadow-sm);
}

.admin-main :deep(.table-header),
.admin-main :deep(.private-table-header) {
  background: rgba(255, 240, 246, 0.78);
  color: var(--taotu-text-muted);
  font-weight: 900;
}

.admin-main :deep(.table-row),
.admin-main :deep(.private-table-row),
.admin-main :deep(.image-item),
.admin-main :deep(.group-item),
.admin-main :deep(.path-item),
.admin-main :deep(.user-row),
.admin-main :deep(.token-item),
.admin-main :deep(.backup-item) {
  background: rgba(255, 255, 255, 0.46);
  border-color: rgba(238, 210, 226, 0.62);
  border-radius: var(--taotu-radius-md);
}

.admin-main :deep(.tag-table),
.admin-main :deep(.user-table),
.admin-main :deep(.stat-table),
.admin-main :deep(.group-list) {
  border-color: rgba(238, 210, 226, 0.62);
  border-radius: var(--taotu-radius-md);
  background: rgba(255, 255, 255, 0.42);
}

.admin-main :deep(.form-group label) {
  color: var(--taotu-text);
  font-weight: 800;
}

.admin-main :deep(.fluent-input),
.admin-main :deep(.fluent-select),
.admin-main :deep(.user-select),
.admin-main :deep(.user-tag-select) {
  min-height: 38px;
  border-color: var(--taotu-border);
  border-radius: var(--taotu-radius-sm);
  background: rgba(255, 255, 255, 0.72);
}

.admin-main :deep(.more-filters),
.admin-main :deep(.batch-bar),
.admin-main :deep(.manual-action) {
  border: 1px solid var(--taotu-border);
  border-radius: var(--taotu-radius-md);
  background: rgba(255, 240, 246, 0.56);
}

.admin-main :deep(.modal) {
  background: rgba(255, 255, 255, 0.9);
  border-radius: var(--taotu-radius-lg);
  box-shadow: var(--taotu-shadow-lg);
}

.admin-main :deep(.modal h3) {
  color: var(--taotu-text-strong);
  font-weight: 900;
}

.admin-main :deep(.tag-mini),
.admin-main :deep(.tag-chip),
.admin-main :deep(.source-pill) {
  border-radius: 999px;
  font-weight: 800;
}

.admin-main :deep(.empty-msg),
.admin-main :deep(.desc),
.admin-main :deep(.form-hint) {
  color: var(--taotu-text-muted);
}

@media (max-width: 1100px) {
  .admin-topbar {
    grid-template-columns: 1fr;
    justify-items: center;
    padding: 14px;
  }

  .admin-body {
    grid-template-columns: 1fr;
  }

  .admin-sidebar {
    position: static;
    height: auto;
  }

  .sidebar-scroll {
    display: flex;
    overflow-x: auto;
  }

  .menu-group {
    min-width: 180px;
  }
}
</style>
