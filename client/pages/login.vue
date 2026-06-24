<template>
  <div class="login-page">
    <div class="login-card fluent-card">
      <h1 class="login-title">登录</h1>
      <p class="login-subtitle">登录后可上传图片和管理图库</p>

      <div class="form-group">
        <label class="form-label">用户名</label>
        <input v-model="form.username" class="fluent-input" placeholder="请输入用户名" @keyup.enter="handleLogin" />
      </div>

      <div class="form-group">
        <label class="form-label">密码</label>
        <input v-model="form.password" type="password" class="fluent-input" placeholder="请输入密码" @keyup.enter="handleLogin" />
      </div>

      <p v-if="error" class="error-msg">{{ error }}</p>

      <button class="fluent-btn fluent-btn-primary login-btn" @click="handleLogin" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>

      <div class="login-footer">
        <NuxtLink to="/" class="back-link">返回首页</NuxtLink>
        <NuxtLink to="/register" class="register-link">注册账号</NuxtLink>
        <NuxtLink to="/settings" class="settings-link">后端设置</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: false })

const api = useApi()
const router = useRouter()

const form = reactive({ username: '', password: '' })
const error = ref('')
const loading = ref(false)

const handleLogin = async () => {
  if (!form.username || !form.password) {
    error.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const data = await api.post('/api/admin/auth/login', {
      username: form.username,
      password: form.password
    })

    if (data.token) {
      localStorage.setItem('jwt_token', data.token)
      // 根据角色跳转
      if (data.user.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/')
      }
    }
  } catch (err) {
    error.value = err.data?.error || '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: var(--fluent-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
}

.login-card {
  max-width: 400px;
  width: 100%;
  padding: var(--space-2xl);
}

.login-title {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: var(--space-xs);
}

.login-subtitle {
  font-size: 14px;
  color: var(--fluent-text-secondary);
  margin-bottom: var(--space-xl);
}

.form-group {
  margin-bottom: var(--space-lg);
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: var(--space-sm);
}

.fluent-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--fluent-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  transition: border-color var(--transition-fast);
  box-sizing: border-box;
}

.fluent-input:focus {
  outline: none;
  border-color: var(--fluent-blue);
}

.error-msg {
  color: #d13438;
  font-size: 13px;
  margin-bottom: var(--space-md);
}

.login-btn {
  width: 100%;
  padding: 10px;
  font-size: 15px;
}

.login-footer {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-lg);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--fluent-border);
}

.back-link, .settings-link, .register-link {
  font-size: 13px;
  color: var(--fluent-text-secondary);
  text-decoration: none;
}

.back-link:hover, .settings-link:hover, .register-link:hover {
  color: var(--fluent-blue);
}
</style>
