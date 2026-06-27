<template>
  <div class="taotu-page" :style="pageStyle">
    <div class="taotu-shell">
      <header class="site-header">
        <div class="brand-block">
          <NuxtLink to="/" class="brand-link">
            <img v-if="brandLogoUrl" :src="brandLogoUrl" class="taotu-icon brand-icon" alt="" />
            <span v-else class="brand-fallback">桃</span>
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
          <button class="icon-btn" title="通知">
            <img src="/icons/nav/notification-64x64.png" class="taotu-icon taotu-icon-20" alt="" />
          </button>

          <template v-if="isLoggedIn">
            <div class="user-pill">
              <img v-if="userAvatarUrl" :src="userAvatarUrl" class="taotu-icon user-avatar" alt="" />
              <span v-else class="user-avatar fallback">{{ userInitial }}</span>
              <span>{{ currentUser?.username || '用户' }}</span>
              <img src="/icons/nav/chevron-down-64x64.png" class="taotu-icon taotu-icon-16" alt="" />
            </div>
            <button class="logout-soft" @click="handleLogout">退出</button>
          </template>

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

const isLoggedIn = ref(false)
const isAdmin = ref(false)
const currentUser = ref(null)
const siteName = ref('桃图智库')
const recordNumber = ref('')
const iconUrl = ref('')
const logoUrl = ref('')
const bgUrl = ref('')
const bgBlur = ref(0)

const navItems = computed(() => [
  { to: '/', label: '图库', icon: '/icons/nav/gallery-64x64.png', visible: true },
  { to: '/albums', label: '相册', icon: '/icons/nav/albums-64x64.png', visible: true },
  { to: '/api-docs', label: 'API', icon: '/icons/nav/api-64x64.png', visible: true },
  { to: '/upload', label: '上传', icon: '/icons/nav/upload-64x64.png', visible: isLoggedIn.value },
  { to: '/dashboard', label: '仪表盘', icon: '/icons/nav/dashboard-64x64.png', visible: isLoggedIn.value },
  { to: '/admin', label: '管理', icon: '/icons/nav/admin-64x64.png', visible: isAdmin.value }
])

const visibleNavItems = computed(() => navItems.value.filter(item => item.visible))
const brandLogoUrl = computed(() => logoUrl.value || iconUrl.value || '')
const userAvatarUrl = computed(() => {
  const avatar = currentUser.value?.avatar
  if (!avatar) return ''
  if (/^https?:\/\//i.test(avatar)) return avatar
  return `${apiBase.value}${avatar}`
})
const userInitial = computed(() => (currentUser.value?.username || 'U').slice(0, 1).toUpperCase())
const apiBase = computed(() => useRuntimeConfig().public.apiBase || '')

const pageStyle = computed(() => {
  if (!bgUrl.value) return {}
  return {
    '--site-bg-image': `linear-gradient(rgba(255,255,255,.0), rgba(255,255,255,0.4)), url("${bgUrl.value}")`,
    '--site-bg-filter': bgBlur.value ? `blur(${bgBlur.value * 0.25}px)` : 'none'
  }
})

const checkAuth = () => {
  if (!import.meta.client) return
  const token = localStorage.getItem('jwt_token')
  if (!token) {
    isLoggedIn.value = false
    isAdmin.value = false
    currentUser.value = null
    return
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp * 1000 > Date.now()) {
      isLoggedIn.value = true
      isAdmin.value = payload.role === 'admin'
      currentUser.value = payload
      loadCurrentUser()
    } else {
      localStorage.removeItem('jwt_token')
      isLoggedIn.value = false
      isAdmin.value = false
      currentUser.value = null
    }
  } catch {
    isLoggedIn.value = false
    isAdmin.value = false
    currentUser.value = null
  }
}

const loadCurrentUser = async () => {
  try {
    currentUser.value = await api.get('/api/admin/auth/me')
    isAdmin.value = currentUser.value?.role === 'admin'
  } catch {}
}

const loadSiteConfig = async () => {
  try {
    const siteConfig = await api.get('/api/admin/site-config/public')
    siteName.value = siteConfig.siteName || '桃图智库'
    recordNumber.value = siteConfig.recordNumber || ''
    iconUrl.value = siteConfig.icon || ''
    logoUrl.value = siteConfig.logo || ''
    bgUrl.value = siteConfig.background?.value || ''
    bgBlur.value = Number(siteConfig.background?.blur || 0)
    document.title = siteName.value
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
}

onMounted(async () => {
  checkAuth()
  await loadSiteConfig()
})

watch(() => route.path, () => checkAuth())

const handleLogout = () => {
  localStorage.removeItem('jwt_token')
  isLoggedIn.value = false
  isAdmin.value = false
  currentUser.value = null
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
  min-height: 64px;
  padding: 0 28px;
  background: rgba(255, 255, 255, 0.82);
  border-bottom: 1px solid rgba(238, 210, 226, 0.62);
  box-shadow: 0 10px 24px rgba(85, 74, 118, 0.06);
  backdrop-filter: blur(22px);
}

.brand-link {
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
  min-width: 74px;
  justify-content: center;
  padding: 10px 14px;
  border-radius: var(--taotu-radius-sm);
  color: var(--taotu-text);
  font-size: 14px;
  font-weight: 800;
  transition: all var(--taotu-transition);
}

.nav-link:hover,
.nav-link.router-link-active {
  background: rgba(255, 240, 246, 0.95);
  color: var(--taotu-pink);
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.icon-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.62);
  cursor: pointer;
}

.user-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px 5px 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.64);
  border: 1px solid rgba(255, 255, 255, 0.8);
  color: var(--taotu-text);
  font-size: 13px;
  font-weight: 800;
}

.user-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
}

.user-avatar.fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--taotu-pink), var(--taotu-purple));
  color: white;
  font-size: 14px;
  font-weight: 900;
}

.logout-soft {
  border: none;
  background: transparent;
  color: var(--taotu-text-muted);
  font-size: 13px;
  cursor: pointer;
}

.logout-soft:hover {
  color: var(--taotu-danger);
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
