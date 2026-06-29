<template>
  <div class="admin-users-page">
    <section class="users-panel">
      <header class="users-toolbar">
        <div>
          <h1>用户管理</h1>
          <p>管理系统用户账号与权限</p>
        </div>
        <div class="toolbar-actions">
          <button type="button" class="add-user-btn" @click="openAddDialog">
            <img src="/icons/actions/add-64x64.png" alt="" />
            添加用户
          </button>
          <button type="button" class="refresh-btn" @click="loadUsers" :disabled="loading" aria-label="刷新用户列表">
            <img src="/icons/actions/refresh-64x64.png" alt="" />
          </button>
        </div>
      </header>

      <div class="filter-bar">
        <label class="search-box">
          <img src="/icons/actions/search-64x64.png" alt="" />
          <input v-model="filters.search" type="search" placeholder="搜索用户名或邮箱" @keyup.enter="applyFilters" />
        </label>
        <TaotuSelect v-model="filters.role" class="filter-select" :options="roleFilterOptions" @change="applyFilters" />
        <TaotuSelect v-model="filters.status" class="filter-select" :options="statusFilterOptions" @change="applyFilters" />
      </div>

      <div class="users-table-wrap">
        <div class="users-table">
          <div class="table-header">
            <span>用户名</span>
            <span>邮箱</span>
            <span>角色</span>
            <span>存储用量</span>
            <span>最后登录</span>
            <span>操作</span>
          </div>

          <template v-if="loading">
            <div class="empty-row">正在加载用户...</div>
          </template>
          <template v-else-if="users.length === 0">
            <div class="empty-row">暂无用户</div>
          </template>
          <template v-else>
            <div v-for="user in users" :key="user.id" class="table-row">
              <div class="user-cell">
                <img v-if="avatarSrc(user)" :src="avatarSrc(user)" class="user-avatar" alt="" />
                <span v-else class="user-avatar fallback">{{ user.username?.slice(0, 1)?.toUpperCase() || 'U' }}</span>
                <div class="user-name-stack">
                  <div class="user-name-line">
                    <b>{{ user.username }}</b>
                    <i v-if="user.role === 'admin'" class="inline-role admin">管理员</i>
                    <i v-if="user.is_disabled" class="inline-role disabled">禁用</i>
                  </div>
                </div>
              </div>

              <div class="email-cell">{{ user.email || '-' }}</div>

              <div>
                <span class="role-pill" :class="user.role === 'admin' ? 'admin' : 'user'">
                  {{ roleLabel(user.role) }}
                </span>
              </div>

              <div class="storage-cell">
                <div class="storage-text">
                  <span>{{ formatSize(user.used_storage) }} / {{ formatQuota(user.storage_limit) }}</span>
                  <span>{{ storagePercent(user) }}%</span>
                </div>
                <div class="usage-track">
                  <i :class="user.role === 'admin' ? 'admin' : 'user'" :style="{ width: `${storagePercent(user)}%` }"></i>
                </div>
              </div>

              <div class="login-cell">
                <span>{{ user.last_login_at ? formatDateTime(user.last_login_at) : '从未登录' }}</span>
                <small>{{ user.last_login_ip || '-' }}</small>
              </div>

              <div class="action-cell">
                <button type="button" class="row-btn edit" @click="openEditDialog(user)">编辑</button>
                <button
                  type="button"
                  class="row-btn"
                  :class="user.is_disabled ? 'enable' : 'disable'"
                  :disabled="isSelf(user)"
                  @click="toggleUserStatus(user)"
                >
                  {{ user.is_disabled ? '启用' : '禁用' }}
                </button>
                <button
                  v-if="canDelete(user)"
                  type="button"
                  class="row-btn delete"
                  @click="openDeleteDialog(user)"
                >
                  删除
                </button>
                <span v-else class="delete-placeholder">-</span>
              </div>
            </div>
          </template>
        </div>
      </div>

      <footer class="users-pagination">
        <span>共 {{ pagination.total }} 条</span>
        <div class="pager-controls">
          <TaotuSelect v-model="pagination.pageSize" class="page-size-select" :options="pageSizeOptions" @change="changePageSize" />
          <button type="button" class="page-arrow" :disabled="pagination.page <= 1" @click="goPage(pagination.page - 1)">
            <img src="/icons/albums/pagination-prev-64x64.png" alt="" />
          </button>
          <button type="button" class="page-num active">{{ pagination.page }}</button>
          <button type="button" class="page-arrow" :disabled="pagination.page >= pagination.totalPages" @click="goPage(pagination.page + 1)">
            <img src="/icons/albums/pagination-next-64x64.png" alt="" />
          </button>
        </div>
      </footer>
    </section>

    <div v-if="formDialog" class="modal-overlay user-modal-overlay" @click.self="closeFormDialog">
      <div class="user-dialog">
        <header class="dialog-header">
          <h2>{{ editingUser ? '编辑用户' : '添加用户' }}</h2>
          <button type="button" class="dialog-close" @click="closeFormDialog">
            <img src="/icons/actions/close-64x64.png" alt="" />
          </button>
        </header>

        <div class="form-field">
          <label>用户名</label>
          <input v-model.trim="form.username" class="dialog-input" :disabled="!!editingUser" placeholder="请输入用户名" />
        </div>

        <div v-if="!editingUser" class="form-field">
          <label>密码</label>
          <div class="password-field">
            <input v-model="form.password" :type="showPassword ? 'text' : 'password'" class="dialog-input" placeholder="请输入密码" />
            <button type="button" @click="showPassword = !showPassword" aria-label="切换密码显示">
              <img :src="showPassword ? '/icons/actions/eye-off-64x64.png' : '/icons/actions/eye-64x64.png'" alt="" />
            </button>
          </div>
        </div>

        <div class="form-field">
          <label>邮箱</label>
          <input v-model.trim="form.email" class="dialog-input" placeholder="请输入邮箱地址" />
        </div>

        <div class="form-field">
          <label>角色</label>
          <TaotuSelect v-model="form.role" :options="roleOptions" />
        </div>

        <div class="quota-grid">
          <div class="form-field">
            <label>存储上限（MB）</label>
            <input v-model.number="form.storageLimitMB" type="number" min="0" class="dialog-input" />
          </div>
          <div class="form-field">
            <label>单图最大大小（MB）</label>
            <input v-model.number="form.maxFileSizeMB" type="number" min="0" class="dialog-input" />
          </div>
        </div>

        <footer class="dialog-actions">
          <button type="button" class="cancel-btn" @click="closeFormDialog">取消</button>
          <button type="button" class="save-btn" :disabled="saving" @click="saveUser">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </footer>
      </div>
    </div>

    <div v-if="deletingUser" class="modal-overlay user-modal-overlay" @click.self="closeDeleteDialog">
      <div class="delete-dialog">
        <header class="delete-header">
          <div>
            <span class="warning-mark">!</span>
            <h2>删除用户</h2>
          </div>
          <button type="button" class="dialog-close" @click="closeDeleteDialog">
            <img src="/icons/actions/close-64x64.png" alt="" />
          </button>
        </header>

        <div class="delete-hero">
          <img src="/icons/actions/trash-64x64.png" alt="" />
        </div>
        <h3>确定要删除用户「{{ deletingUser.username }}」吗？</h3>
        <p>此操作不可恢复，用户的所有数据将被永久删除。</p>

        <div class="delete-impact">
          <strong>删除影响</strong>
          <ul>
            <li>该用户将无法登录系统</li>
            <li>其所有图库、相册及相关数据将被删除</li>
            <li>已使用的存储空间将被释放（{{ formatSize(deletingUser.used_storage) }}）</li>
            <li>与该用户相关的操作日志将保留</li>
          </ul>
        </div>

        <footer class="dialog-actions">
          <button type="button" class="cancel-btn" @click="closeDeleteDialog">取消</button>
          <button type="button" class="danger-btn" :disabled="saving" @click="confirmDeleteUser">
            {{ saving ? '删除中...' : '确认删除' }}
          </button>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const { showAdminToast } = useAdminToast()
const { normalizeAssetUrl } = useUiCache()

const users = ref([])
const loading = ref(false)
const saving = ref(false)
const formDialog = ref(false)
const editingUser = ref(null)
const deletingUser = ref(null)
const showPassword = ref(false)
const currentUserId = ref(null)

const filters = reactive({
  search: '',
  role: 'all',
  status: 'all'
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1
})

const form = reactive({
  username: '',
  password: '',
  email: '',
  role: 'user',
  storageLimitMB: 5000,
  maxFileSizeMB: 20
})

const roleOptions = [
  { label: '普通用户', value: 'user' },
  { label: '管理员', value: 'admin' }
]

const roleFilterOptions = [
  { label: '全部角色', value: 'all' },
  { label: '管理员', value: 'admin' },
  { label: '普通用户', value: 'user' }
]

const statusFilterOptions = [
  { label: '全部状态', value: 'all' },
  { label: '启用', value: 'enabled' },
  { label: '禁用', value: 'disabled' }
]

const pageSizeOptions = [
  { label: '10 条/页', value: 10 },
  { label: '20 条/页', value: 20 },
  { label: '50 条/页', value: 50 }
]

let searchTimer = null

onMounted(async () => {
  readCurrentUser()
  await loadUsers()
})

watch(() => filters.search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => applyFilters(), 360)
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})

function readCurrentUser() {
  if (!import.meta.client) return
  const token = localStorage.getItem('jwt_token')
  if (!token) return
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    currentUserId.value = Number(payload.id)
  } catch {}
}

async function loadUsers() {
  loading.value = true
  try {
    const data = await api.get('/api/admin/users', {
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: filters.search || undefined,
      role: filters.role !== 'all' ? filters.role : undefined,
      status: filters.status !== 'all' ? filters.status : undefined
    })
    users.value = data.users || []
    const pager = data.pagination || {}
    pagination.total = Number(pager.total || users.value.length || 0)
    pagination.totalPages = Number(pager.totalPages || 1)
    pagination.page = Math.min(Number(pager.page || pagination.page), pagination.totalPages || 1)
    pagination.pageSize = Number(pager.pageSize || pagination.pageSize)
  } catch (err) {
    showAdminToast(err?.data?.error || err.message || '用户列表加载失败', 'error')
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  pagination.page = 1
  loadUsers()
}

function changePageSize() {
  pagination.page = 1
  loadUsers()
}

function goPage(page) {
  const nextPage = Math.min(Math.max(1, page), pagination.totalPages || 1)
  if (nextPage === pagination.page) return
  pagination.page = nextPage
  loadUsers()
}

function resetForm() {
  form.username = ''
  form.password = ''
  form.email = ''
  form.role = 'user'
  form.storageLimitMB = 5000
  form.maxFileSizeMB = 20
  showPassword.value = false
}

function openAddDialog() {
  editingUser.value = null
  resetForm()
  formDialog.value = true
}

function openEditDialog(user) {
  editingUser.value = user
  form.username = user.username || ''
  form.password = ''
  form.email = user.email || ''
  form.role = user.role || 'user'
  form.storageLimitMB = bytesToMb(user.storage_limit)
  form.maxFileSizeMB = bytesToMb(user.max_file_size)
  showPassword.value = false
  formDialog.value = true
}

function closeFormDialog() {
  formDialog.value = false
  editingUser.value = null
  resetForm()
}

function openDeleteDialog(user) {
  deletingUser.value = user
}

function closeDeleteDialog() {
  deletingUser.value = null
}

async function saveUser() {
  if (!form.username) {
    showAdminToast('请输入用户名', 'error')
    return
  }
  if (!editingUser.value && !form.password) {
    showAdminToast('请输入密码', 'error')
    return
  }

  saving.value = true
  try {
    const payload = {
      email: form.email || null,
      role: form.role,
      storage_limit: mbToBytes(form.storageLimitMB),
      max_file_size: mbToBytes(form.maxFileSizeMB)
    }
    if (editingUser.value) {
      await api.put(`/api/admin/users/${editingUser.value.id}`, payload)
      showAdminToast('用户已保存', 'success')
    } else {
      await api.post('/api/admin/users', {
        ...payload,
        username: form.username,
        password: form.password
      })
      showAdminToast('用户已添加', 'success')
    }
    closeFormDialog()
    await loadUsers()
  } catch (err) {
    showAdminToast(err?.data?.error || err.message || '保存出错', 'error')
  } finally {
    saving.value = false
  }
}

async function toggleUserStatus(user) {
  if (isSelf(user)) {
    showAdminToast('不能禁用当前登录账号', 'error')
    return
  }
  saving.value = true
  try {
    const nextDisabled = !user.is_disabled
    await api.request(`/api/admin/users/${user.id}/status`, {
      method: 'PATCH',
      body: { disabled: nextDisabled }
    })
    user.is_disabled = nextDisabled
    showAdminToast(nextDisabled ? '用户已禁用' : '用户已启用', 'success')
  } catch (err) {
    showAdminToast(err?.data?.error || err.message || '状态更新失败', 'error')
  } finally {
    saving.value = false
  }
}

async function confirmDeleteUser() {
  if (!deletingUser.value) return
  saving.value = true
  try {
    await api.del(`/api/admin/users/${deletingUser.value.id}`)
    showAdminToast('用户已删除', 'success')
    closeDeleteDialog()
    await loadUsers()
  } catch (err) {
    showAdminToast(err?.data?.error || err.message || '删除失败', 'error')
  } finally {
    saving.value = false
  }
}

function isSelf(user) {
  return Number(user.id) === Number(currentUserId.value)
}

function canDelete(user) {
  return user.role !== 'admin' && !isSelf(user)
}

function avatarSrc(user) {
  return normalizeAssetUrl(user.avatar)
}

function roleLabel(role) {
  return role === 'admin' ? '管理员' : '普通用户'
}

function mbToBytes(value) {
  const mb = Number(value || 0)
  return Number.isFinite(mb) && mb > 0 ? Math.round(mb * 1024 * 1024) : 0
}

function bytesToMb(value) {
  const bytes = Number(value || 0)
  return bytes > 0 ? Math.round(bytes / 1024 / 1024) : 0
}

function storagePercent(user) {
  const limit = Number(user.storage_limit || 0)
  const used = Number(user.used_storage || 0)
  if (!limit || limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 1000) / 10)
}

function formatQuota(bytes) {
  return Number(bytes || 0) > 0 ? formatSize(bytes) : '不限'
}

function formatSize(bytes) {
  const value = Number(bytes || 0)
  if (!value) return '0 B'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (num) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
</script>

<style scoped>
.admin-users-page {
  min-height: calc(100vh - 108px);
}

.users-panel {
  height: calc(100vh - 108px);
  min-height: 620px;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.82);
  border-radius: 16px;
  background:
    linear-gradient(110deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.62)),
    radial-gradient(circle at 9% 8%, rgba(255, 193, 221, 0.18), transparent 30%),
    radial-gradient(circle at 84% 4%, rgba(183, 228, 255, 0.22), transparent 28%);
  box-shadow: 0 20px 46px rgba(86, 76, 118, 0.1);
  backdrop-filter: blur(22px);
}

.users-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 20px 22px 10px;
}

.users-toolbar h1 {
  margin: 0 0 2px;
  color: #27304a;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0;
}

.users-toolbar p {
  color: #929bb0;
  font-size: 12px;
  font-weight: 800;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.add-user-btn,
.refresh-btn,
.row-btn,
.page-arrow,
.page-num,
.cancel-btn,
.save-btn,
.danger-btn,
.dialog-close {
  border: none;
  font: inherit;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.add-user-btn:active,
.refresh-btn:active,
.row-btn:active,
.page-arrow:active,
.page-num:active,
.cancel-btn:active,
.save-btn:active,
.danger-btn:active {
  transform: scale(0.985);
}

.add-user-btn {
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  border: 1px solid rgba(248, 95, 154, 0.58);
  border-radius: 9px;
  background: rgba(255, 247, 251, 0.86);
  color: #f65d98;
  font-size: 13px;
  font-weight: 900;
}

.add-user-btn img,
.refresh-btn img,
.page-arrow img,
.dialog-close img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.refresh-btn {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(220, 226, 240, 0.78);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 8px 18px rgba(104, 91, 130, 0.05);
}

.filter-bar {
  display: grid;
  grid-template-columns: minmax(180px, 220px) 120px 120px;
  gap: 14px;
  padding: 0 22px 14px;
}

.search-box {
  height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid rgba(220, 226, 240, 0.76);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

.search-box img {
  width: 15px;
  height: 15px;
  opacity: 0.55;
}

.search-box input {
  min-width: 0;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: #596378;
  font-size: 12px;
  font-weight: 800;
}

.search-box input::placeholder {
  color: #b1b9cb;
}

.filter-select,
.page-size-select {
  min-width: 0;
}

.filter-select :deep(.taotu-select-trigger) {
  min-height: 34px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.66);
}

.filter-select :deep(.taotu-select-value) {
  font-size: 12px;
  font-weight: 900;
}

.users-table-wrap {
  min-height: 0;
  padding: 0 22px;
  overflow: hidden;
}

.users-table {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-auto-rows: auto;
  align-content: start;
  overflow: auto;
  border-top: 1px solid rgba(224, 229, 242, 0.64);
  border-bottom: 1px solid rgba(224, 229, 242, 0.64);
}

.users-table::-webkit-scrollbar {
  width: 8px;
}

.users-table::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(248, 95, 154, 0.26);
}

.table-header,
.table-row {
  display: grid;
  grid-template-columns: minmax(190px, 1.12fr) minmax(170px, 1.02fr) minmax(92px, 0.58fr) minmax(210px, 1.15fr) minmax(150px, 0.86fr) minmax(190px, 0.95fr);
  align-items: center;
  column-gap: 16px;
}

.table-header {
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 42px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.86);
  color: #68728a;
  font-size: 12px;
  font-weight: 900;
  box-shadow: 0 1px 0 rgba(224, 229, 242, 0.66);
}

.table-row {
  min-height: 56px;
  padding: 8px 10px;
  border-top: 1px solid rgba(224, 229, 242, 0.58);
  color: #7a849a;
  font-size: 12px;
  font-weight: 800;
}

.table-row:hover {
  background: rgba(255, 246, 251, 0.52);
}

.empty-row {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca5b8;
  font-size: 13px;
  font-weight: 900;
}

.user-cell {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(108, 91, 132, 0.1);
}

.user-avatar.fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff8ab7, #a98bff);
  color: #fff;
  font-size: 13px;
  font-weight: 900;
}

.user-name-stack {
  min-width: 0;
}

.user-name-line {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name-line b {
  min-width: 0;
  overflow: hidden;
  color: #556079;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 900;
}

.inline-role,
.role-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
  white-space: nowrap;
}

.inline-role.admin,
.role-pill.admin {
  background: rgba(255, 236, 244, 0.98);
  color: #f05e93;
}

.inline-role.disabled {
  background: rgba(245, 246, 250, 0.95);
  color: #9ca4b8;
}

.role-pill.user {
  background: rgba(241, 239, 255, 0.98);
  color: #8f7cff;
}

.email-cell,
.login-cell span,
.login-cell small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.storage-cell {
  min-width: 0;
  display: grid;
  gap: 7px;
}

.storage-text {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px;
  gap: 8px;
  align-items: center;
  color: #7d879c;
}

.storage-text span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.storage-text span:last-child {
  color: #9da6b8;
  text-align: right;
}

.usage-track {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: #e9ecf4;
}

.usage-track i {
  display: block;
  height: 100%;
  min-width: 0;
  border-radius: inherit;
}

.usage-track i.admin {
  background: linear-gradient(90deg, #ff6ca0, #ff8dbc);
}

.usage-track i.user {
  background: linear-gradient(90deg, #9280ff, #a991ff);
}

.login-cell {
  min-width: 0;
  display: grid;
  gap: 1px;
  color: #8b94a8;
  line-height: 1.35;
}

.login-cell small {
  color: #9aa3b5;
  font-size: 11px;
  font-weight: 800;
}

.action-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.row-btn {
  min-width: 44px;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 900;
}

.row-btn:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.row-btn.edit {
  background: rgba(241, 239, 255, 0.9);
  color: #8574f4;
}

.row-btn.disable {
  background: rgba(255, 247, 235, 0.95);
  color: #d39336;
}

.row-btn.enable {
  background: rgba(232, 250, 241, 0.95);
  color: #37ad77;
}

.row-btn.delete {
  background: rgba(255, 239, 245, 0.95);
  color: #f25c8e;
}

.delete-placeholder {
  min-width: 44px;
  color: #b4bac8;
  text-align: center;
  font-size: 15px;
  font-weight: 900;
}

.users-pagination {
  min-height: 54px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 22px 14px;
  color: #8c95aa;
  font-size: 12px;
  font-weight: 900;
}

.pager-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.page-size-select {
  width: 100px;
}

.page-size-select :deep(.taotu-select-trigger) {
  min-height: 30px;
  border-radius: 8px;
}

.page-size-select :deep(.taotu-select-value) {
  font-size: 12px;
  font-weight: 900;
}

.page-arrow,
.page-num {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.58);
  color: #9da5b7;
  font-size: 12px;
  font-weight: 900;
}

.page-arrow:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.page-arrow img {
  opacity: 0.62;
}

.page-num.active {
  border: 1px solid rgba(248, 95, 154, 0.5);
  background: rgba(255, 246, 251, 0.92);
  color: #f45f96;
}

.user-modal-overlay {
  z-index: 1800;
  background: rgba(68, 52, 82, 0.2);
  backdrop-filter: blur(10px);
}

.user-dialog,
.delete-dialog {
  width: min(492px, calc(100vw - 28px));
  padding: 20px 22px 18px;
  border: 1px solid rgba(224, 229, 242, 0.78);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 30px 76px rgba(86, 76, 118, 0.18);
  backdrop-filter: blur(22px);
}

.delete-dialog {
  border-color: rgba(255, 119, 151, 0.34);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(255, 249, 251, 0.92));
}

.dialog-header,
.delete-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.dialog-header h2,
.delete-header h2 {
  margin: 0;
  color: #38425e;
  font-size: 18px;
  font-weight: 900;
}

.delete-header > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.warning-mark {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #ff638d;
  border-radius: 50%;
  color: #ff638d;
  font-size: 13px;
  font-weight: 900;
}

.delete-header h2 {
  color: #f0527e;
}

.dialog-close {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: transparent;
  opacity: 0.62;
}

.form-field {
  display: grid;
  gap: 7px;
  margin-bottom: 12px;
}

.form-field label {
  color: #6d7890;
  font-size: 13px;
  font-weight: 900;
}

.dialog-input {
  width: 100%;
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid rgba(220, 226, 240, 0.82);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.7);
  color: #4d5871;
  font-size: 14px;
  font-weight: 800;
  outline: none;
}

.dialog-input:focus {
  border-color: rgba(248, 95, 154, 0.4);
  box-shadow: 0 0 0 4px rgba(248, 95, 154, 0.08);
}

.dialog-input:disabled {
  background: rgba(244, 246, 250, 0.92);
  color: #a1a9ba;
}

.password-field {
  position: relative;
}

.password-field .dialog-input {
  padding-right: 42px;
}

.password-field button {
  position: absolute;
  top: 50%;
  right: 8px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  transform: translateY(-50%);
  cursor: pointer;
}

.password-field img {
  width: 17px;
  height: 17px;
  opacity: 0.6;
}

.quota-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 14px;
  margin-top: 18px;
}

.cancel-btn,
.save-btn,
.danger-btn {
  min-width: 116px;
  height: 45px;
  border-radius: 9px;
  font-size: 15px;
  font-weight: 900;
}

.cancel-btn {
  border: 1px solid rgba(220, 226, 240, 0.82);
  background: rgba(255, 255, 255, 0.82);
  color: #7d879a;
}

.save-btn {
  background: linear-gradient(135deg, #ff70a3, #f65b92);
  color: #fff;
  box-shadow: 0 12px 26px rgba(248, 95, 154, 0.24);
}

.danger-btn {
  background: linear-gradient(135deg, #ff6288, #f23866);
  color: #fff;
  box-shadow: 0 12px 26px rgba(238, 68, 105, 0.24);
}

.save-btn:disabled,
.danger-btn:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.delete-hero {
  display: flex;
  justify-content: center;
  margin: 6px 0 10px;
}

.delete-hero img {
  width: 88px;
  height: 88px;
  object-fit: contain;
  padding: 13px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 222, 230, 0.95), rgba(255, 244, 247, 0.18));
}

.delete-dialog h3 {
  margin: 0;
  color: #4c566e;
  font-size: 16px;
  font-weight: 900;
  text-align: center;
}

.delete-dialog p {
  margin: 5px 0 18px;
  color: #a2a9ba;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.delete-impact {
  padding: 13px 16px;
  border: 1px solid rgba(255, 113, 143, 0.28);
  border-radius: 9px;
  background: rgba(255, 240, 244, 0.62);
  color: #737d94;
}

.delete-impact strong {
  display: block;
  margin-bottom: 7px;
  color: #ff5f86;
  font-size: 14px;
  font-weight: 900;
}

.delete-impact ul {
  margin: 0;
  padding-left: 17px;
}

.delete-impact li {
  margin: 4px 0;
  font-size: 12px;
  font-weight: 900;
}

@media (max-width: 1280px) {
  .table-header,
  .table-row {
    grid-template-columns: minmax(170px, 1.1fr) minmax(150px, 1fr) 86px minmax(190px, 1.08fr) 138px minmax(180px, 0.95fr);
    column-gap: 12px;
  }

  .row-btn {
    min-width: 40px;
    padding: 0 8px;
  }
}

@media (max-width: 980px) {
  .users-panel {
    height: auto;
    min-height: 0;
  }

  .users-toolbar,
  .users-pagination {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-bar {
    grid-template-columns: 1fr;
  }

  .users-table {
    overflow-x: auto;
  }

  .table-header,
  .table-row {
    min-width: 1040px;
  }
}

@media (max-width: 560px) {
  .quota-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .dialog-actions {
    justify-content: stretch;
  }

  .cancel-btn,
  .save-btn,
  .danger-btn {
    flex: 1;
    min-width: 0;
  }
}
</style>
