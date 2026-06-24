<template>
  <div class="register-page">
    <div class="register-card fluent-card">
      <h1 class="title">注册账号</h1>
      <p class="subtitle">创建账号后可上传和管理图片</p>

      <div v-if="!registrationOpen" class="closed-msg">
        <p>注册功能暂未开放</p>
        <NuxtLink to="/login" class="fluent-btn fluent-btn-primary">前往登录</NuxtLink>
      </div>

      <template v-else>
        <div class="form-group">
          <label class="form-label">用户名</label>
          <input v-model="form.username" class="fluent-input" placeholder="请输入用户名" />
        </div>

        <div class="form-group">
          <label class="form-label">邮箱</label>
          <input v-model="form.email" type="email" class="fluent-input" placeholder="请输入邮箱" />
        </div>

        <div class="form-group">
          <label class="form-label">密码</label>
          <input v-model="form.password" type="password" class="fluent-input" placeholder="请输入密码" />
        </div>

        <div class="form-group">
          <label class="form-label">确认密码</label>
          <input v-model="form.confirmPassword" type="password" class="fluent-input" placeholder="再次输入密码" @keyup.enter="handleRegister" />
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>

        <button class="fluent-btn fluent-btn-primary register-btn" @click="handleRegister" :disabled="loading">
          {{ loading ? '注册中...' : '注册' }}
        </button>

        <div class="footer-links">
          <NuxtLink to="/login">已有账号？登录</NuxtLink>
          <NuxtLink to="/">返回首页</NuxtLink>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: false })

const api = useApi()
const router = useRouter()

const form = reactive({ username: '', email: '', password: '', confirmPassword: '' })
const error = ref('')
const loading = ref(false)
const registrationOpen = ref(false)

onMounted(async () => {
  try {
    const config = await api.get('/api/admin/site-config')
    registrationOpen.value = config.registration?.enabled || false
  } catch {
    registrationOpen.value = false
  }
})

const handleRegister = async () => {
  error.value = ''
  if (!form.username || !form.password) { error.value = '请填写用户名和密码'; return }
  if (form.password !== form.confirmPassword) { error.value = '两次密码不一致'; return }
  if (form.password.length < 6) { error.value = '密码至少6位'; return }

  loading.value = true
  try {
    const data = await api.post('/api/admin/auth/register', {
      username: form.username,
      password: form.password,
      email: form.email
    })
    if (data.token) {
      localStorage.setItem('jwt_token', data.token)
      router.push('/')
    }
  } catch (err) {
    error.value = err.data?.error || '注册失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  background: var(--fluent-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
}
.register-card { max-width: 420px; width: 100%; padding: var(--space-2xl); }
.title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xs); }
.subtitle { color: var(--fluent-text-secondary); margin-bottom: var(--space-xl); }
.form-group { margin-bottom: var(--space-lg); }
.form-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 10px 14px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.fluent-input:focus { outline: none; border-color: var(--fluent-blue); }
.error-msg { color: #d13438; font-size: 13px; margin-bottom: var(--space-md); }
.register-btn { width: 100%; padding: 10px; font-size: 15px; }
.closed-msg { text-align: center; padding: var(--space-xl) 0; }
.closed-msg p { margin-bottom: var(--space-lg); color: var(--fluent-text-secondary); }
.footer-links { display: flex; justify-content: space-between; margin-top: var(--space-lg); padding-top: var(--space-lg); border-top: 1px solid var(--fluent-border); font-size: 13px; }
.footer-links a { color: var(--fluent-blue); text-decoration: none; }
</style>
