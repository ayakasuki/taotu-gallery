<template>
  <div class="admin-users">
    <h1 class="page-title">用户管理</h1>

    <div class="fluent-card">
      <div class="section-header">
        <h3>用户列表</h3>
        <button class="fluent-btn fluent-btn-primary" @click="showAdd = true">添加用户</button>
      </div>

      <div class="user-table">
        <div class="table-header">
          <span>用户名</span><span>邮箱</span><span>角色</span><span>最后登录</span><span>操作</span>
        </div>
        <div v-for="u in users" :key="u.id" class="table-row">
          <span class="username">{{ u.username }}</span>
          <span>{{ u.email || '-' }}</span>
          <span><span class="role-badge" :class="u.role">{{ u.role === 'admin' ? '管理员' : '用户' }}</span></span>
          <span>{{ u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '从未登录' }}</span>
          <span class="row-actions">
            <button class="fluent-btn fluent-btn-secondary" @click="editUser(u)">编辑</button>
            <button class="fluent-btn fluent-btn-secondary" @click="deleteUser(u)" v-if="u.role !== 'admin'">删除</button>
          </span>
        </div>
        <div v-if="users.length === 0" class="empty-msg">暂无用户</div>
      </div>
    </div>

    <!-- 添加/编辑用户弹窗 -->
    <div v-if="showAdd || editingUser" class="modal-overlay" @click.self="closeModal">
      <div class="modal fluent-card">
        <h3>{{ editingUser ? '编辑用户' : '添加用户' }}</h3>
        <div class="form-group">
          <label>用户名</label>
          <input v-model="form.username" class="fluent-input" :disabled="!!editingUser" />
        </div>
        <div class="form-group" v-if="!editingUser">
          <label>密码</label>
          <input v-model="form.password" type="password" class="fluent-input" />
        </div>
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="form.email" class="fluent-input" />
        </div>
        <div class="form-group">
          <label>角色</label>
          <select v-model="form.role" class="fluent-input">
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="fluent-btn fluent-btn-primary" @click="saveUser">保存</button>
          <button class="fluent-btn fluent-btn-secondary" @click="closeModal">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const users = ref([])
const showAdd = ref(false)
const editingUser = ref(null)
const form = reactive({ username: '', password: '', email: '', role: 'user' })

onMounted(() => loadUsers())

const loadUsers = async () => {
  try {
    const data = await api.get('/api/admin/users')
    users.value = data.users || []
  } catch {}
}

const editUser = (u) => {
  editingUser.value = u
  form.username = u.username
  form.email = u.email || ''
  form.role = u.role
  form.password = ''
}

const closeModal = () => {
  showAdd.value = false
  editingUser.value = null
  form.username = ''; form.password = ''; form.email = ''; form.role = 'user'
}

const saveUser = async () => {
  try {
    if (editingUser.value) {
      await api.put(`/api/admin/users/${editingUser.value.id}`, { email: form.email, role: form.role })
    } else {
      if (!form.username || !form.password) return alert('请填写用户名和密码')
      await api.post('/api/admin/users', { username: form.username, password: form.password, email: form.email, role: form.role })
    }
    await loadUsers()
    closeModal()
  } catch (err) {
    alert('操作失败: ' + (err.data?.error || err.message))
  }
}

const deleteUser = async (u) => {
  if (!confirm(`确定删除用户 "${u.username}"？`)) return
  try {
    await api.del(`/api/admin/users/${u.id}`)
    await loadUsers()
  } catch (err) { alert('删除失败: ' + err.message) }
}
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); }
.user-table { border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); overflow: hidden; }
.table-header, .table-row { display: grid; grid-template-columns: 120px 150px 80px 120px 140px; padding: 10px 16px; align-items: center; }
.table-header { background: var(--fluent-hover); font-size: 13px; font-weight: 600; }
.table-row { border-top: 1px solid var(--fluent-border); font-size: 13px; }
.username { font-weight: 500; }
.role-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.role-badge.admin { background: var(--fluent-blue-light); color: var(--fluent-blue); }
.role-badge.user { background: var(--fluent-hover); color: var(--fluent-text-secondary); }
.row-actions { display: flex; gap: 6px; }
.empty-msg { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 450px; padding: var(--space-xl); }
.modal h3 { margin-bottom: var(--space-lg); }
.modal-actions { display: flex; gap: var(--space-md); justify-content: flex-end; margin-top: var(--space-lg); }
</style>
