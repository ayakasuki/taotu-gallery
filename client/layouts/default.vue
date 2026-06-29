<template>
  <div class="taotu-page" :style="pageStyle">
    <div class="taotu-shell">
      <header class="site-header">
        <div class="brand-block">
          <NuxtLink to="/" class="brand-link">
            <img v-if="brandLogoUrl" :src="brandLogoUrl" class="taotu-icon brand-icon" alt="" />
            <span v-else-if="showBrandFallback" class="brand-fallback">桃</span>
            <span>{{ siteName }}</span>
          </NuxtLink>
        </div>

        <nav class="nav-links" aria-label="主导航">
          <NuxtLink v-for="item in visibleNavItems" :key="item.to" :to="item.to" class="nav-link">
            <img :src="item.icon" class="taotu-icon taotu-icon-20" alt="" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </nav>

        <div class="header-actions">
          <NavNoticeUser
            v-if="isLoggedIn"
            :is-logged-in="isLoggedIn"
            :user="currentUser"
            :avatar-url="userAvatarUrl"
            :fallback-ready="showUserFallback"
            username-fallback="用户"
            @logout="handleLogout"
          />

          <NuxtLink v-else to="/login" class="taotu-btn taotu-btn-primary login-btn">
            <img src="/icons/nav/login-64x64.png" class="taotu-icon taotu-icon-18" alt="" />
            登录
          </NuxtLink>
        </div>
      </header>

      <main class="main-content">
        <slot />
      </main>

      <footer class="site-footer">
        <span>© 2024 {{ siteName }}</span>
        <span v-if="recordNumber">·</span>
        <span v-if="recordNumber">{{ recordNumber }}</span>
        <span>·</span>
        <span>服务条款</span>
        <span>·</span>
        <span>隐私政策</span>
        <span>·</span>
        <span>帮助中心</span>
      </footer>
    </div>
  </div>
</template>

<script setup>
const api = useApi()
const router = useRouter()
const route = useRoute()
const {
  readSiteConfigCache,
  writeSiteConfigCache,
  readCurrentUserCache,
  writeCurrentUserCache,
  clearCurrentUserCache,
  normalizeAssetUrl
} = useUiCache()

const isLoggedIn = ref(false)
const isAdmin = ref(false)
const currentUser = ref(null)
const siteName = ref('桃图智库')
const recordNumber = ref('')
const iconUrl = ref('')
const bgUrl = ref('')
const bgBlur = ref(0)
const bgOverlayTop = ref('rgba(255, 255, 255, 0.08)')
const bgOverlayBottom = ref('rgba(255, 246, 250, 0.42)')
const defaultSiteBg = '/site_bg.png'
const hasCustomBackground = ref(false)
const siteConfigReady = ref(false)
const currentUserReady = ref(false)

const isDefaultBackground = (background = {}) => {
  const value = String(background?.value || '')
  return !value || background?.type === 'default' || value === defaultSiteBg
}

const navItems = computed(() => [
  { to: '/', label: '图库', icon: '/icons/nav/gallery-64x64.png', visible: true },
  { to: '/albums', label: '相册', icon: '/icons/nav/albums-64x64.png', visible: true },
  { to: '/api-docs', label: 'API', icon: '/icons/nav/api-64x64.png', visible: true },
  { to: '/upload', label: '上传', icon: '/icons/nav/upload-64x64.png', visible: isLoggedIn.value },
  { to: '/dashboard', label: '仪表盘', icon: '/icons/nav/dashboard-64x64.png', visible: isLoggedIn.value },
  { to: '/admin', label: '管理', icon: '/icons/nav/admin-64x64.png', visible: isAdmin.value }
])

const visibleNavItems = computed(() => navItems.value.filter(item => item.visible))
const brandLogoUrl = computed(() => normalizeAssetUrl(iconUrl.value))
const userAvatarUrl = computed(() => normalizeAssetUrl(currentUser.value?.avatar))
const showBrandFallback = computed(() => siteConfigReady.value && !brandLogoUrl.value)
const showUserFallback = computed(() => currentUserReady.value && !userAvatarUrl.value)

const pageStyle = computed(() => {
  const blurPx = Math.round(Math.min(100, Math.max(0, bgBlur.value)) * 0.4 * 10) / 10
  const style = {
    '--site-bg-filter': blurPx > 0 ? `blur(${blurPx}px)` : 'none'
  }
  if (hasCustomBackground.value && bgUrl.value) {
    style['--site-bg-image'] = `linear-gradient(to bottom, ${bgOverlayTop.value}, ${bgOverlayBottom.value}), url("${bgUrl.value}")`
  }
  return style
})

const applySiteConfig = (siteConfig = {}) => {
  const background = siteConfig.background || {}
  const useDefaultBackground = isDefaultBackground(background)
  siteName.value = siteConfig.siteName || '桃图智库'
  recordNumber.value = siteConfig.recordNumber || ''
  iconUrl.value = siteConfig.icon || ''
  hasCustomBackground.value = !useDefaultBackground
  bgUrl.value = useDefaultBackground ? '' : normalizeAssetUrl(background.value)
  bgBlur.value = Number(background.blur || 0)
  bgOverlayTop.value = background.overlayTop || 'rgba(255, 255, 255, 0.08)'
  bgOverlayBottom.value = background.overlayBottom || 'rgba(255, 246, 250, 0.42)'
  siteConfigReady.value = true
  if (import.meta.client && useDefaultBackground) {
    document.documentElement.style.removeProperty('--site-bg-image')
  }
  if (import.meta.client) document.title = siteName.value
  if (import.meta.client && siteConfig.icon) {
    let link = document.querySelector("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = normalizeAssetUrl(siteConfig.icon)
  }
}

const initialSiteConfig = import.meta.client ? readSiteConfigCache() : null
if (initialSiteConfig) applySiteConfig(initialSiteConfig)

const checkAuth = () => {
  if (!import.meta.client) return
  const token = localStorage.getItem('jwt_token')
  if (!token) {
    isLoggedIn.value = false
    isAdmin.value = false
    currentUser.value = null
    currentUserReady.value = true
    clearCurrentUserCache()
    return
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp * 1000 > Date.now()) {
      isLoggedIn.value = true
      isAdmin.value = payload.role === 'admin'
      const cachedUser = readCurrentUserCache()
      currentUser.value = cachedUser?.id === payload.id ? { ...payload, ...cachedUser } : payload
      currentUserReady.value = !!cachedUser?.avatar
      loadCurrentUser()
    } else {
      localStorage.removeItem('jwt_token')
      isLoggedIn.value = false
      isAdmin.value = false
      currentUser.value = null
      currentUserReady.value = true
      clearCurrentUserCache()
    }
  } catch {
    isLoggedIn.value = false
    isAdmin.value = false
    currentUser.value = null
    currentUserReady.value = true
    clearCurrentUserCache()
  }
}

const loadCurrentUser = async () => {
  try {
    currentUser.value = await api.get('/api/admin/auth/me')
    isAdmin.value = currentUser.value?.role === 'admin'
    currentUserReady.value = true
    writeCurrentUserCache(currentUser.value)
  } catch {
    currentUserReady.value = true
  }
}

const loadSiteConfig = async () => {
  try {
    const siteConfig = await api.get('/api/admin/site-config/public')
    applySiteConfig(siteConfig)
    writeSiteConfigCache(siteConfig)
  } catch {}
}

const handleSiteConfigUpdated = (event) => {
  if (event.detail) applySiteConfig(event.detail)
}

const handleCurrentUserUpdated = (event) => {
  if (!event.detail) return
  currentUser.value = { ...(currentUser.value || {}), ...event.detail }
  isAdmin.value = currentUser.value?.role === 'admin'
}

onMounted(async () => {
  const cachedSiteConfig = readSiteConfigCache()
  if (cachedSiteConfig && !siteConfigReady.value) applySiteConfig(cachedSiteConfig)
  window.addEventListener('taotu:site-config-updated', handleSiteConfigUpdated)
  window.addEventListener('taotu:current-user-updated', handleCurrentUserUpdated)
  checkAuth()
  await loadSiteConfig()
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  window.removeEventListener('taotu:site-config-updated', handleSiteConfigUpdated)
  window.removeEventListener('taotu:current-user-updated', handleCurrentUserUpdated)
})

watch(() => route.path, () => checkAuth())

const handleLogout = () => {
  localStorage.removeItem('jwt_token')
  isLoggedIn.value = false
  isAdmin.value = false
  currentUser.value = null
  clearCurrentUserCache()
  router.push('/')
}
</script>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto minmax(220px, 1fr);
  align-items: center;
  gap: 18px;
  min-height: 50px;
  padding: 0 28px;
  background: rgba(255, 255, 255, 0.82);
  border-bottom: 1px solid rgba(238, 210, 226, 0.62);
  box-shadow: 0 10px 24px rgba(85, 74, 118, 0.06);
  backdrop-filter: blur(22px);
}

.brand-link {
  margin: 10px 0 0 0;
  display: inline-flex;
  align-items: center;
  gap: 11px;
  color: var(--taotu-pink);
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 0;
}

.brand-icon {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.brand-fallback {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--taotu-pink), var(--taotu-purple));
  color: white;
  font-size: 18px;
  font-weight: 900;
  box-shadow: 0 12px 24px rgba(248,95,154,0.18);
}

.nav-links {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 35px;
  max-height: 35px;
  justify-content: center;
  padding: 10px 14px;
  border-radius: 100vh;
  color: var(--taotu-text);
  font-size: 14px;
  font-weight: 800;
  transition: all var(--taotu-transition);
}

.nav-link:hover,
.nav-link.router-link-active {
  background: linear-gradient(160deg, rgb(255, 143, 163), rgb(245, 109, 134));
  color: #ffffff;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.login-btn {
  min-width: 94px;
}

.main-content {
  min-height: calc(100vh - 112px);
  width: min(100%, 1536px);
  margin: 0 auto;
  padding: 18px;
}

.site-footer {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 8px 18px 18px;
  color: rgba(111, 119, 145, 0.76);
  font-size: 12px;
  text-align: center;
}

@media (max-width: 980px) {
  .site-header {
    grid-template-columns: 1fr;
    justify-items: stretch;
    padding: 14px;
  }

  .brand-block,
  .header-actions {
    justify-self: center;
  }

  .nav-links {
    flex-wrap: wrap;
  }
}
</style>
