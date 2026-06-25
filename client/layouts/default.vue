<template>
  <div class="default-layout">
    <div v-if="showConnectionBanner" class="connection-banner" @click="goToSettings">
      <span>⚠️ 无法连接到后端服务，点击此处配置</span>
    </div>

    <header class="site-header">
      <div class="header-inner">
        <NuxtLink to="/" class="logo">{{ siteName }}</NuxtLink>
        <nav class="nav-links">
          <NuxtLink to="/" class="nav-link">图库</NuxtLink>
          <NuxtLink to="/albums" class="nav-link">相册</NuxtLink>
          <NuxtLink to="/api-docs" class="nav-link">API</NuxtLink>

          <template v-if="isLoggedIn">
            <NuxtLink to="/upload" class="nav-link">上传</NuxtLink>
            <NuxtLink to="/dashboard" class="nav-link">仪表盘</NuxtLink>
            <NuxtLink v-if="isAdmin" to="/admin" class="nav-link admin-link">管理</NuxtLink>
            <div class="user-menu">
              <span class="username">{{ currentUser?.username }}</span>
              <button class="nav-link logout-btn" @click="handleLogout">退出</button>
            </div>
          </template>

          <template v-else>
            <NuxtLink to="/login" class="nav-link login-link">登录</NuxtLink>
            <NuxtLink to="/settings" class="nav-link settings-link" title="设置">⚙</NuxtLink>
          </template>
        </nav>
      </div>
    </header>
    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<script setup>
const api = useApi()
const router = useRouter()

const showConnectionBanner = ref(false)
const isLoggedIn = ref(false)
const isAdmin = ref(false)
const currentUser = ref(null)
const siteName = ref('桃图智库')

const checkAuth = () => {
  if (!import.meta.client) return
  const token = localStorage.getItem('jwt_token')
  if (!token) {
    isLoggedIn.value = false; isAdmin.value = false; currentUser.value = null; return
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp * 1000 > Date.now()) {
      isLoggedIn.value = true; isAdmin.value = payload.role === 'admin'; currentUser.value = payload
    } else {
      localStorage.removeItem('jwt_token'); isLoggedIn.value = false
    }
  } catch { isLoggedIn.value = false }
}

onMounted(async () => {
  checkAuth()
  // 获取站点配置（公开接口，无需登录）
  try {
    const siteConfig = await api.get('/api/admin/site-config/public')
    if (siteConfig.siteName) {
      siteName.value = siteConfig.siteName
      document.title = siteConfig.siteName
    }
    // 应用背景图
    if (siteConfig.background?.value) {
      const blur = siteConfig.background.blur || 0
      // 创建背景层
      let bgLayer = document.getElementById('site-bg-layer')
      if (!bgLayer) {
        bgLayer = document.createElement('div')
        bgLayer.id = 'site-bg-layer'
        bgLayer.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;'
        document.body.prepend(bgLayer)
      }
      bgLayer.style.backgroundImage = `url(${siteConfig.background.value})`
      bgLayer.style.backgroundSize = 'cover'
      bgLayer.style.backgroundPosition = 'center'
      bgLayer.style.filter = blur > 0 ? `blur(${blur * 0.4}px)` : 'none'
    }
    // 应用网站图标
    if (siteConfig.icon) {
      let link = document.querySelector("link[rel~='icon']")
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = siteConfig.icon
    }
  } catch {}
  try { showConnectionBanner.value = !(await api.checkConnection()).connected } catch { showConnectionBanner.value = true }
})

const route = useRoute()
watch(() => route.path, () => checkAuth())

const handleLogout = () => {
  localStorage.removeItem('jwt_token')
  isLoggedIn.value = false; isAdmin.value = false; currentUser.value = null
  router.push('/')
}
const goToSettings = () => router.push('/settings')
</script>

<style scoped>
.connection-banner { background: #fff4ce; border-bottom: 1px solid #fce100; padding: 8px var(--space-lg); text-align: center; font-size: 13px; cursor: pointer; }
.connection-banner:hover { background: #ffe800; }
.site-header { background: var(--fluent-bg-card); border-bottom: 1px solid var(--fluent-border); box-shadow: var(--shadow-1); position: sticky; top: 0; z-index: 100; }
.header-inner { max-width: 1400px; margin: 0 auto; padding: 0 var(--space-lg); height: 56px; display: flex; align-items: center; justify-content: space-between; }
.logo { font-size: 18px; font-weight: 600; color: var(--fluent-text); }
.nav-links { display: flex; gap: var(--space-md); align-items: center; }
.nav-link { padding: 6px 12px; border-radius: var(--radius-sm); font-size: 14px; color: var(--fluent-text-secondary); transition: all var(--transition-fast); text-decoration: none; }
.nav-link:hover { background: var(--fluent-hover); color: var(--fluent-text); }
.nav-link.router-link-active { background: var(--fluent-blue-light); color: var(--fluent-blue); }
.admin-link { border: 1px solid var(--fluent-border); }
.login-link { background: var(--fluent-blue); color: white; border-radius: var(--radius-sm); }
.login-link:hover { background: var(--fluent-blue-hover); }
.settings-link { font-size: 18px; padding: 6px 8px; }
.user-menu { display: flex; align-items: center; gap: var(--space-sm); margin-left: var(--space-sm); }
.username { font-size: 13px; color: var(--fluent-text-secondary); }
.logout-btn { background: none; border: none; cursor: pointer; font-size: 13px; }
.logout-btn:hover { color: #d13438; background: #fde7e9; }
.main-content { min-height: calc(100vh - 56px); }
</style>
