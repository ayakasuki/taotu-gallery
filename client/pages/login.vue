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
        <button class="footer-action" type="button" @click="openForgotModal">忘记密码</button>
      </div>
    </div>

    <div v-if="showForgot" class="modal-overlay" @click.self="closeForgotModal">
      <div class="forgot-modal fluent-card">
        <div class="modal-header">
          <h2>忘记密码</h2>
          <button class="close-btn" type="button" @click="closeForgotModal">×</button>
        </div>

        <div class="form-group">
          <label class="form-label">用户名</label>
          <input v-model="forgot.username" class="fluent-input" placeholder="请输入账号用户名" :disabled="forgotSent" />
        </div>

        <div class="form-group">
          <label class="form-label">人机验证码</label>
          <div class="captcha-row">
            <div class="captcha-box" v-html="forgot.captchaSvg"></div>
            <button class="fluent-btn" type="button" @click="loadForgotCaptcha" :disabled="forgotCaptchaLoading">
              {{ forgotCaptchaLoading ? '刷新中' : '刷新' }}
            </button>
          </div>
          <input v-model="forgot.captchaCode" class="fluent-input" placeholder="请输入图中验证码" />
        </div>

        <button v-if="!forgotSent" class="fluent-btn fluent-btn-primary action-wide" type="button" @click="sendForgotCode" :disabled="forgotSending || !canSendForgotCode">
          {{ forgotSending ? '发送中...' : '发送验证邮件' }}
        </button>

        <template v-else>
          <p class="form-hint">验证码已发送到 {{ forgot.maskedEmail || '绑定邮箱' }}，{{ forgotCountdown }} 秒内有效。</p>
          <div class="form-group">
            <label class="form-label">邮箱验证码</label>
            <input v-model="forgot.emailCode" class="fluent-input" placeholder="5 位邮箱验证码" />
          </div>
          <div class="form-group">
            <label class="form-label">新密码</label>
            <input v-model="forgot.newPassword" type="password" class="fluent-input" placeholder="请输入新密码" />
          </div>
          <div class="form-group">
            <label class="form-label">重复新密码</label>
            <input v-model="forgot.confirmPassword" type="password" class="fluent-input" placeholder="再次输入新密码" @keyup.enter="resetForgotPassword" />
          </div>
          <div class="modal-actions split-actions">
            <button class="fluent-btn" type="button" @click="resendForgotCode" :disabled="forgotSending || forgotCountdown > 0">
              {{ forgotCountdown > 0 ? forgotCountdown + 's 后重发' : '重新发送' }}
            </button>
            <button class="fluent-btn fluent-btn-primary" type="button" @click="resetForgotPassword" :disabled="forgotResetting || !canResetForgotPassword">
              {{ forgotResetting ? '重置中...' : '重置密码' }}
            </button>
          </div>
        </template>

        <p v-if="forgotError" class="error-msg modal-msg">{{ forgotError }}</p>
        <p v-if="forgotSuccess" class="success-msg modal-msg">{{ forgotSuccess }}</p>
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
const showForgot = ref(false)
const forgotSent = ref(false)
const forgotSending = ref(false)
const forgotResetting = ref(false)
const forgotCaptchaLoading = ref(false)
const forgotCountdown = ref(0)
const forgotError = ref('')
const forgotSuccess = ref('')
let forgotTimer = null

const forgot = reactive({
  username: '',
  emailCode: '',
  newPassword: '',
  confirmPassword: '',
  captchaId: '',
  captchaCode: '',
  captchaSvg: '',
  maskedEmail: ''
})

const canSendForgotCode = computed(() => !!forgot.username && !!forgot.captchaCode)
const canResetForgotPassword = computed(() => {
  return !!forgot.username && !!forgot.emailCode && !!forgot.captchaCode && !!forgot.newPassword && !!forgot.confirmPassword && forgot.newPassword === forgot.confirmPassword
})

onBeforeUnmount(() => {
  if (forgotTimer) clearInterval(forgotTimer)
})

const getErrorMessage = (err, fallback) => err?.data?.error || err?.message || fallback

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
      if (data.user.role === 'admin') router.push('/admin')
      else router.push('/')
    }
  } catch (err) {
    error.value = err.data?.error || '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}

const openForgotModal = async () => {
  showForgot.value = true
  forgot.username = form.username || ''
  forgotError.value = ''
  forgotSuccess.value = ''
  await loadForgotCaptcha()
}

const closeForgotModal = () => {
  showForgot.value = false
  forgotSent.value = false
  forgotError.value = ''
  forgotSuccess.value = ''
  forgot.emailCode = ''
  forgot.newPassword = ''
  forgot.confirmPassword = ''
  forgot.captchaCode = ''
  forgot.maskedEmail = ''
  if (forgotTimer) clearInterval(forgotTimer)
  forgotCountdown.value = 0
}

const loadForgotCaptcha = async () => {
  forgotCaptchaLoading.value = true
  try {
    const data = await api.get('/api/admin/auth/captcha')
    forgot.captchaId = data.captchaId
    forgot.captchaCode = ''
    forgot.captchaSvg = data.svg
  } catch (err) {
    forgotError.value = getErrorMessage(err, '验证码加载失败')
    forgot.captchaSvg = ''
  } finally {
    forgotCaptchaLoading.value = false
  }
}

const startForgotCountdown = (seconds = 120) => {
  forgotCountdown.value = seconds
  if (forgotTimer) clearInterval(forgotTimer)
  forgotTimer = setInterval(() => {
    forgotCountdown.value -= 1
    if (forgotCountdown.value <= 0) {
      clearInterval(forgotTimer)
      forgotTimer = null
      forgotCountdown.value = 0
    }
  }, 1000)
}

const sendForgotCode = async () => {
  forgotError.value = ''
  forgotSuccess.value = ''
  if (!canSendForgotCode.value) return
  forgotSending.value = true
  try {
    const data = await api.post('/api/admin/auth/forgot-password-code', {
      username: forgot.username,
      captchaId: forgot.captchaId,
      captchaCode: forgot.captchaCode
    })
    forgotSent.value = true
    forgot.maskedEmail = data.maskedEmail || ''
    forgotSuccess.value = data.message || '验证码已发送'
    startForgotCountdown(data.ttl || 120)
    await loadForgotCaptcha()
  } catch (err) {
    forgotError.value = getErrorMessage(err, '验证码发送失败')
    await loadForgotCaptcha()
  } finally {
    forgotSending.value = false
  }
}

const resendForgotCode = async () => {
  if (forgotCountdown.value > 0) return
  forgotSent.value = false
  forgot.emailCode = ''
  await sendForgotCode()
}

const resetForgotPassword = async () => {
  forgotError.value = ''
  forgotSuccess.value = ''
  if (!forgot.newPassword || forgot.newPassword.length < 6) { forgotError.value = '密码至少6位'; return }
  if (forgot.newPassword !== forgot.confirmPassword) { forgotError.value = '两次密码不一致'; return }
  if (!canResetForgotPassword.value) return

  forgotResetting.value = true
  try {
    const data = await api.post('/api/admin/auth/reset-password', {
      username: forgot.username,
      emailCode: forgot.emailCode,
      captchaId: forgot.captchaId,
      captchaCode: forgot.captchaCode,
      newPassword: forgot.newPassword
    })
    forgotSuccess.value = data.message || '密码已重置'
    form.username = forgot.username
    form.password = ''
    setTimeout(() => closeForgotModal(), 900)
  } catch (err) {
    forgotError.value = getErrorMessage(err, '密码重置失败')
    await loadForgotCaptcha()
  } finally {
    forgotResetting.value = false
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

.form-group { margin-bottom: var(--space-lg); }
.form-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 10px 14px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; transition: border-color var(--transition-fast); box-sizing: border-box; }
.fluent-input:focus { outline: none; border-color: var(--fluent-blue); }
.error-msg { color: #d13438; font-size: 13px; margin-bottom: var(--space-md); }
.success-msg { color: #107c10; font-size: 13px; margin-bottom: var(--space-md); }
.login-btn { width: 100%; padding: 10px; font-size: 15px; }
.login-footer { display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-lg); padding-top: var(--space-lg); border-top: 1px solid var(--fluent-border); }
.back-link, .register-link, .footer-action { font-size: 13px; color: var(--fluent-text-secondary); text-decoration: none; }
.footer-action { border: none; background: transparent; cursor: pointer; padding: 0; }
.back-link:hover, .register-link:hover, .footer-action:hover { color: var(--fluent-blue); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.32); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: var(--space-lg); }
.forgot-modal { width: min(440px, 100%); padding: var(--space-xl); }
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-lg); }
.modal-header h2 { font-size: 20px; font-weight: 600; margin: 0; }
.close-btn { border: none; background: transparent; font-size: 24px; line-height: 1; cursor: pointer; color: var(--fluent-text-secondary); }
.captcha-row { display: flex; gap: var(--space-sm); align-items: center; margin-bottom: var(--space-sm); }
.captcha-box { width: 160px; height: 52px; flex: 0 0 160px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); overflow: hidden; background: #fff; }
.action-wide { width: 100%; }
.form-hint { font-size: 12px; color: var(--fluent-text-secondary); margin: 0 0 var(--space-lg); }
.modal-actions { display: flex; gap: var(--space-md); justify-content: flex-end; margin-top: var(--space-md); }
.split-actions { justify-content: space-between; }
.modal-msg { margin-top: var(--space-md); margin-bottom: 0; }
@media (max-width: 520px) {
  .login-page { padding: var(--space-md); }
  .captcha-row, .split-actions { flex-direction: column; align-items: stretch; }
  .captcha-box { width: 100%; flex-basis: 52px; display: flex; justify-content: center; }
}
</style>
