<template>
  <div class="nav-notice-user">
    <div
      class="nav-popover notification-popover"
      @mouseenter="openNoticeMenu"
      @mouseleave="scheduleNoticeClose"
    >
      <button type="button" class="notification-button" title="通知" @click="toggleNoticeMenu">
        <img src="/icons/nav/notification-64x64.png" class="nav-icon icon-20" alt="" />
        <span v-if="unreadCount > 0" class="notice-badge">{{ badgeText }}</span>
      </button>

      <div v-if="noticeMenuOpen" class="nav-mini-menu notice-menu">
        <div class="notice-list pretty-scroll" :class="{ scrollable: notifications.length > 3 }">
          <button v-if="!notifications.length" type="button" class="mini-menu-button empty">
            <img src="/icons/nav/no-message-64x64.svg" alt="" />
            <span>暂无消息</span>
          </button>

          <button
            v-for="notice in notifications"
            :key="notice.id"
            type="button"
            class="mini-menu-button notice-item"
            :class="{ unread: !notice.is_read, pinned: notice.is_pinned }"
            @click="openNoticeDetail(notice)"
          >
            <i v-if="!notice.is_read" class="unread-dot"></i>
            <img src="/icons/nav/announcement-64x64.svg" alt="" />
            <span class="notice-thumb">
              <img :src="noticeThumb(notice)" alt="" />
            </span>
            <span class="notice-title">{{ notice.title }}</span>
          </button>
        </div>
      </div>
    </div>

    <div
      class="nav-popover user-popover"
      @mouseenter="openUserMenu"
      @mouseleave="scheduleUserClose"
    >
      <button type="button" class="user-pill" @click="userMenuOpen = !userMenuOpen">
        <img v-if="avatarUrl" :src="avatarUrl" class="user-avatar" alt="" />
        <span v-else-if="fallbackReady" class="user-avatar fallback">{{ userInitial }}</span>
        <span class="user-name">{{ displayName }}</span>
        <img src="/icons/nav/chevron-down-64x64.png" class="nav-icon icon-16" alt="" />
      </button>

      <div v-if="userMenuOpen" class="nav-mini-menu user-menu">
        <button type="button" class="mini-menu-button logout-button" @click="emit('logout')">
          <img src="/icons/nav/logout-64x64.png" alt="" />
          <span>退出</span>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="activeNotice" class="notice-detail-overlay" @click.self="closeNoticeDetail">
        <article class="notice-detail-card">
          <button type="button" class="notice-close" @click="closeNoticeDetail">×</button>
          <h2>{{ activeNotice.title }}</h2>
          <div class="notice-subline">
            <img :src="notifierIcon(activeNotice)" alt="" />
            <span>{{ notifierName(activeNotice) }}</span>
          </div>
          <pre class="notice-body">{{ activeNotice.content || '' }}</pre>
        </article>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
const props = defineProps({
  isLoggedIn: { type: Boolean, default: false },
  user: { type: Object, default: null },
  avatarUrl: { type: String, default: '' },
  fallbackReady: { type: Boolean, default: false },
  usernameFallback: { type: String, default: '用户' }
})

const emit = defineEmits(['logout'])
const api = useApi()
const { normalizeAssetUrl } = useUiCache()

const noticeMenuOpen = ref(false)
const userMenuOpen = ref(false)
const notifications = ref([])
const activeNotice = ref(null)
const loaded = ref(false)
const loading = ref(false)
let noticeCloseTimer = null
let userCloseTimer = null

const displayName = computed(() => props.user?.username || props.user?.name || props.usernameFallback || '用户')
const userInitial = computed(() => displayName.value.slice(0, 1).toUpperCase())
const unreadCount = computed(() => notifications.value.filter(item => !item.is_read).length)
const badgeText = computed(() => unreadCount.value > 99 ? '99' : String(unreadCount.value))
async function loadNotifications(force = false) {
  if (!props.isLoggedIn || loading.value || (loaded.value && !force)) return
  loading.value = true
  try {
    const data = await api.get('/api/announcements/notifications')
    notifications.value = data.notifications || []
    loaded.value = true
  } catch {
    notifications.value = []
  } finally {
    loading.value = false
  }
}

function openNoticeMenu() {
  if (noticeCloseTimer) clearTimeout(noticeCloseTimer)
  noticeMenuOpen.value = true
  loadNotifications()
}

function toggleNoticeMenu() {
  if (noticeCloseTimer) clearTimeout(noticeCloseTimer)
  noticeMenuOpen.value = !noticeMenuOpen.value
  if (noticeMenuOpen.value) loadNotifications()
}

function scheduleNoticeClose() {
  if (noticeCloseTimer) clearTimeout(noticeCloseTimer)
  noticeCloseTimer = setTimeout(() => {
    noticeMenuOpen.value = false
    noticeCloseTimer = null
  }, 180)
}

function openUserMenu() {
  if (userCloseTimer) clearTimeout(userCloseTimer)
  userMenuOpen.value = true
}

function scheduleUserClose() {
  if (userCloseTimer) clearTimeout(userCloseTimer)
  userCloseTimer = setTimeout(() => {
    userMenuOpen.value = false
    userCloseTimer = null
  }, 180)
}

async function openNoticeDetail(notice) {
  if (!notice || notice.empty) return
  activeNotice.value = notice
  noticeMenuOpen.value = false
  if (!notice.is_read) {
    notice.is_read = true
    try {
      await api.post(`/api/announcements/${notice.id}/read`, {})
      notice.read_at = new Date().toISOString()
    } catch {}
  }
}

function closeNoticeDetail() {
  activeNotice.value = null
}

function noticeThumb(notice) {
  const avatar = notice?.notifier?.avatar || notice?.author?.avatar || ''
  return normalizeAssetUrl(notice?.cover_url || avatar) || '/icons/nav/system-message-64x64.svg'
}

function notifierIcon(notice) {
  const avatar = notice?.notifier?.avatar || notice?.author?.avatar || ''
  return normalizeAssetUrl(avatar) || '/icons/nav/system-message-64x64.svg'
}

function notifierName(notice) {
  if (!notice?.notifier) return '系统消息'
  if (notice.notifier.type === 'system') return '系统消息'
  return notice.notifier.name || '用户'
}

watch(() => props.isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    loadNotifications(true)
  } else {
    notifications.value = []
    activeNotice.value = null
    loaded.value = false
  }
})

onMounted(() => {
  if (props.isLoggedIn) loadNotifications()
})

onBeforeUnmount(() => {
  if (noticeCloseTimer) clearTimeout(noticeCloseTimer)
  if (userCloseTimer) clearTimeout(userCloseTimer)
})
</script>

<style scoped>
.nav-notice-user {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.nav-popover {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding-bottom: 16px;
  margin-bottom: -16px;
}

.notification-button {
  position: relative;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: 0 10px 22px rgba(85, 74, 118, 0.06);
  cursor: pointer;
  outline: none;
  transition: transform 0.16s ease, background 0.16s ease;
}

.notification-button:hover {
  background: rgba(255, 240, 246, 0.92);
  transform: translateY(-1px);
}

.notice-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 15px;
  height: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #ff3b5f;
  color: #fff;
  font-size: 9px;
  font-weight: 900;
  line-height: 1;
}

.user-pill {
  min-height: 38px;
  max-height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 3px 10px 3px 5px;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.66);
  color: var(--taotu-text);
  box-shadow: 0 10px 22px rgba(85, 74, 118, 0.06);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  outline: none;
  transition: transform 0.16s ease, background 0.16s ease;
}

.user-pill:hover {
  background: rgba(255, 240, 246, 0.92);
  transform: translateY(-1px);
}

.user-name {
  max-width: 92px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-avatar {
  width: 30px;
  height: 30px;
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

.nav-icon {
  object-fit: contain;
}

.icon-20 {
  width: 20px;
  height: 20px;
}

.icon-16 {
  width: 16px;
  height: 16px;
}

.nav-mini-menu {
  position: absolute;
  top: calc(100% - 2px);
  right: 0;
  z-index: 260;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.86);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 18px 42px rgba(96, 72, 116, 0.16);
  backdrop-filter: blur(24px);
}

.nav-mini-menu::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: -18px;
  height: 18px;
}

.notice-list {
  max-height: 130px;
  display: grid;
  gap: 6px;
  overflow-y: hidden;
  padding-right: 0;
}

.notice-list.scrollable {
  overflow-y: auto;
  padding-right: 5px;
}

.mini-menu-button {
  position: relative;
  width: 120px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(238, 210, 226, 0.66);
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--taotu-text);
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
  outline: none;
  transition: transform 0.14s ease, background 0.14s ease, border-color 0.14s ease;
}

.mini-menu-button:hover {
  transform: scale(0.985);
  background: rgba(255, 240, 246, 0.9);
  border-color: rgba(248, 95, 154, 0.22);
}

.mini-menu-button img {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  object-fit: contain;
}

.notice-item {
  padding: 0 8px 0 12px;
  gap: 5px;
  justify-content: flex-start;
}

.notice-item.unread {
  background: rgba(255, 240, 246, 0.94);
}

.unread-dot {
  position: absolute;
  left: 5px;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff3b5f;
  transform: translateY(-50%);
}

.notice-thumb {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(245, 248, 255, 0.92);
}

.notice-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.notice-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.logout-button {
  justify-content: flex-start;
  padding: 0 13px;
  color: var(--taotu-danger);
}

.pretty-scroll::-webkit-scrollbar {
  width: 7px;
}

.pretty-scroll::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(248, 95, 154, 0.58);
}

.pretty-scroll::-webkit-scrollbar-track {
  border-radius: 999px;
  background: rgba(255, 240, 246, 0.72);
}

.notice-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(64, 50, 76, 0.22);
  backdrop-filter: blur(10px);
}

.notice-detail-card {
  position: relative;
  width: min(560px, calc(100vw - 36px));
  max-height: min(720px, calc(100vh - 48px));
  overflow-y: auto;
  padding: 30px 34px 32px;
  border: 1px solid rgba(255, 255, 255, 0.88);
  border-radius: 20px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(255, 250, 253, 0.86)),
    radial-gradient(circle at 92% 14%, rgba(156, 106, 222, 0.12), transparent 30%);
  box-shadow: 0 28px 70px rgba(74, 53, 96, 0.22);
  color: var(--taotu-text);
  text-align: center;
}

.notice-close {
  position: absolute;
  top: 16px;
  right: 18px;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 240, 246, 0.92);
  color: var(--taotu-pink);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.notice-detail-card h2 {
  margin: 4px 32px 10px;
  color: var(--taotu-text-strong);
  font-size: 24px;
  font-weight: 950;
  letter-spacing: 0;
}

.notice-subline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 28px;
  margin-bottom: 10px;
  color: var(--taotu-text-muted);
  font-size: 13px;
  font-weight: 850;
}

.notice-subline img {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.notice-body {
  width: min(100%, 460px);
  margin: 0 auto;
  color: #536076;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.9;
  text-align: left;
  white-space: pre-wrap;
  white-space: break-spaces;
  overflow-wrap: anywhere;
  tab-size: 4;
}
</style>
