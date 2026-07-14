<template>
  <div class="taotu-page" :style="pageStyle">
    <div class="taotu-shell">
      <header class="site-header" :class="{ 'site-header-transparent': useTransparentNav, 'site-header-glass': !useTransparentNav }">
        <div class="nav-frame" :style="navFrameStyle">
          <div class="brand-block">
            <NuxtLink to="/" class="brand-link">
              <img v-if="brandLogoUrl" :src="brandLogoUrl" class="taotu-icon brand-icon" alt="" />
              <span v-else-if="showBrandFallback" class="brand-fallback">桃</span>
              <span>{{ siteName }}</span>
            </NuxtLink>
          </div>

          <nav class="nav-links" aria-label="主导航">
            <NuxtLink
              v-for="item in visibleNavItems"
              :key="item.to"
              :to="item.to"
              class="nav-link"
              active-class=""
              exact-active-class=""
              :class="{ active: isNavItemActive(item) }"
              @click="syncNavPath(item.to)"
            >
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
        </div>
      </header>

      <main class="main-content">
        <slot />
      </main>

      <footer class="site-footer">
        <span>© 2026 <a href="https://github.com/ayakasuki/taotu-gallery" target="_blank" rel="noopener noreferrer">{{ siteName }}</a></span>
        <span v-if="recordNumber">·</span>
        <span v-if="recordNumber">{{ recordNumber }}</span>
        <span>·</span>
        <NuxtLink to="/terms">服务条款</NuxtLink>
        <span>·</span>
        <NuxtLink to="/privacy">隐私政策</NuxtLink>
        <span>·</span>
        <NuxtLink to="/help">帮助中心</NuxtLink>
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
  clearAuthSession,
  syncAuthCookie,
  isAuthFailure,
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
const isGalleryAtTop = ref(true)
const currentPath = ref(route.path)
const navFrameWidth = ref(null)
let navResizeObserver = null
let removeRouteAfterEach = null
let authCheckPromise = null
let lastAuthCheckAt = 0

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
const isGalleryRoute = computed(() => currentPath.value === '/')
const useTransparentNav = computed(() => isGalleryRoute.value && isGalleryAtTop.value)
const navFrameStyle = computed(() => (
  navFrameWidth.value ? { '--nav-frame-width': `${navFrameWidth.value}px` } : {}
))

const isNavItemActive = (item) => {
  if (!item?.to) return false
  if (item.to === '/') return currentPath.value === '/'
  return currentPath.value === item.to || currentPath.value.startsWith(`${item.to}/`)
}

const syncNavPath = (path) => {
  if (!path) return
  currentPath.value = path
  if (path !== '/') isGalleryAtTop.value = false
  else updateNavScrollState()
}

const getNavFrameTarget = () => {
  if (!import.meta.client) return null
  if (currentPath.value === '/') return document.querySelector('.gallery-page')
  if (currentPath.value.startsWith('/albums')) return document.querySelector('.albums-page') || document.querySelector('.album-detail')
  if (currentPath.value === '/api-docs') return document.querySelector('.api-docs-page')
  if (currentPath.value === '/upload') return document.querySelector('.upload-page')
  if (currentPath.value === '/dashboard') return document.querySelector('.dashboard-page.page-container')
  return document.querySelector('.main-content')
}

const updateNavFrameWidth = () => {
  if (!import.meta.client) return
  const target = getNavFrameTarget()
  const rect = target?.getBoundingClientRect()
  navFrameWidth.value = rect?.width > 0 ? Math.round(rect.width) : null
}

const observeNavFrameTarget = () => {
  if (!import.meta.client) return
  if (navResizeObserver) {
    navResizeObserver.disconnect()
    navResizeObserver = null
  }
  const target = getNavFrameTarget()
  if (target && 'ResizeObserver' in window) {
    navResizeObserver = new ResizeObserver(updateNavFrameWidth)
    navResizeObserver.observe(target)
  }
  updateNavFrameWidth()
}

const updateNavScrollState = () => {
  if (!import.meta.client) return
  if (currentPath.value !== '/') {
    isGalleryAtTop.value = false
    return
  }
  const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  isGalleryAtTop.value = scrollTop <= 2
}

const refreshNavStateAfterRoute = () => {
  if (!import.meta.client) return
  updateNavScrollState()
  requestAnimationFrame(() => {
    updateNavScrollState()
    observeNavFrameTarget()
  })
  window.setTimeout(updateNavScrollState, 80)
}

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

const resetAuthState = () => {
  if (import.meta.client) clearAuthSession()
  isLoggedIn.value = false
  isAdmin.value = false
  currentUser.value = null
  currentUserReady.value = true
}

const handleAuthInvalid = () => {
  isLoggedIn.value = false
  isAdmin.value = false
  currentUser.value = null
  currentUserReady.value = true
}

const checkAuth = () => {
  if (!import.meta.client) return
  const token = localStorage.getItem('jwt_token')
  if (!token) {
    resetAuthState()
    return
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp * 1000 > Date.now()) {
      syncAuthCookie()
      isLoggedIn.value = true
      isAdmin.value = payload.role === 'admin'
      const cachedUser = readCurrentUserCache()
      currentUser.value = cachedUser?.id === payload.id ? { ...payload, ...cachedUser } : payload
      currentUserReady.value = !!cachedUser?.avatar
      loadCurrentUser()
    } else {
      resetAuthState()
    }
  } catch {
    resetAuthState()
  }
}

const loadCurrentUser = async () => {
  const now = Date.now()
  if (authCheckPromise) return authCheckPromise
  if (now - lastAuthCheckAt < 30000 && currentUser.value?.id) {
    currentUserReady.value = true
    return
  }
  authCheckPromise = (async () => {
    try {
      currentUser.value = await api.get('/api/admin/auth/me')
      isLoggedIn.value = true
      isAdmin.value = currentUser.value?.role === 'admin'
      currentUserReady.value = true
      lastAuthCheckAt = Date.now()
      writeCurrentUserCache(currentUser.value)
    } catch (err) {
      if (isAuthFailure(err)) resetAuthState()
      else currentUserReady.value = true
    } finally {
      authCheckPromise = null
    }
  })()
  return authCheckPromise
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
  removeRouteAfterEach = router.afterEach((to) => {
    syncNavPath(to.path)
    nextTick(refreshNavStateAfterRoute)
  })
  const cachedSiteConfig = readSiteConfigCache()
  if (cachedSiteConfig && !siteConfigReady.value) applySiteConfig(cachedSiteConfig)
  window.addEventListener('taotu:site-config-updated', handleSiteConfigUpdated)
  window.addEventListener('taotu:current-user-updated', handleCurrentUserUpdated)
  window.addEventListener('taotu:auth-invalid', handleAuthInvalid)
  window.addEventListener('scroll', updateNavScrollState, { passive: true })
  window.addEventListener('resize', updateNavFrameWidth, { passive: true })
  updateNavScrollState()
  nextTick(observeNavFrameTarget)
  checkAuth()
  await loadSiteConfig()
})

onBeforeUnmount(() => {
  if (!import.meta.client) return
  window.removeEventListener('taotu:site-config-updated', handleSiteConfigUpdated)
  window.removeEventListener('taotu:current-user-updated', handleCurrentUserUpdated)
  window.removeEventListener('taotu:auth-invalid', handleAuthInvalid)
  window.removeEventListener('scroll', updateNavScrollState)
  window.removeEventListener('resize', updateNavFrameWidth)
  if (removeRouteAfterEach) {
    removeRouteAfterEach()
    removeRouteAfterEach = null
  }
  if (navResizeObserver) {
    navResizeObserver.disconnect()
    navResizeObserver = null
  }
})

watch(() => route.path, (nextPath) => {
  currentPath.value = nextPath
  if (nextPath !== '/') isGalleryAtTop.value = false
  const token = import.meta.client ? localStorage.getItem('jwt_token') : ''
  if (token && !isLoggedIn.value) checkAuth()
  nextTick(() => {
    refreshNavStateAfterRoute()
    observeNavFrameTarget()
  })
})

const handleLogout = () => {
  resetAuthState()
  router.push('/')
}
</script>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  min-height: 50px;
  padding: 0;
  background: rgba(255, 255, 255, 0);
  border-bottom: 1px solid transparent;
  box-shadow: none;
  backdrop-filter: blur(0) saturate(100%);
  -webkit-backdrop-filter: blur(0) saturate(100%);
  transition:
    background-color 0.28s ease,
    border-color 0.28s ease,
    box-shadow 0.28s ease,
    backdrop-filter 0.28s ease,
    -webkit-backdrop-filter 0.28s ease;
}

.site-header.site-header-glass {
  background: rgba(255, 255, 255, 0.15);
  border-bottom-color: rgba(255, 255, 255, 0.46);
  box-shadow: 0 10px 24px rgba(85, 74, 118, 0.06);
  backdrop-filter: blur(12px) saturate(280%);
  -webkit-backdrop-filter: blur(12px) saturate(280%);
}

.nav-frame {
  width: min(calc(100% - 36px), var(--nav-frame-width, 1500px));
  min-height: 50px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto minmax(220px, 1fr);
  align-items: center;
  gap: 18px;
}

.site-header.site-header-transparent {
  background: rgba(255, 255, 255, 0) !important;
  border-bottom-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: blur(0) saturate(100%) !important;
  -webkit-backdrop-filter: blur(0) saturate(100%) !important;
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
  padding: 0px 35px;
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
  min-width: 35px;
  max-height: 35px;
  justify-content: center;
  padding: 10px 16px;
  border-radius: 100vh;
  color: var(--taotu-text);
  font-size: 14px;
  font-weight: 800;
  transition: all var(--taotu-transition);
}

.nav-link:hover,
.nav-link.active {
  background: var(--taotu-button-active-bg);
  color: var(--taotu-button-active-color);
}

.site-header.site-header-transparent .nav-link {
  background: transparent;
  color: #ffffff;
  text-shadow: 0 2px 14px rgba(35, 32, 52, 0.28);
}

.site-header.site-header-transparent .nav-link.active {
  background: transparent;
  color: #ffffff;
}

.site-header.site-header-transparent .nav-link:hover {
  background: rgba(255, 255, 255, 0.14);
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

.site-footer a {
  color: inherit;
  text-decoration: none;
  transition: color 0.16s ease;
}

.site-footer a:hover {
  color: #f45f93;
}

@media (max-width: 980px) {
  .nav-frame {
    grid-template-columns: 1fr;
    justify-items: stretch;
    width: min(calc(100% - 28px), var(--nav-frame-width, 100%));
    padding: 14px 0;
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
