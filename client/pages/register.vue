<template>
  <div class="register-page">
    <div class="register-card fluent-card">
      <h1 class="title">注册账号</h1>
      <p class="subtitle">创建账号后可上传和管理图片</p>

      <div v-if="configLoading" class="closed-msg">
        <p>正在读取注册设置...</p>
      </div>

      <div v-else-if="!registrationOpen" class="closed-msg">
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

        <div class="form-group">
          <label class="form-label">人机验证码</label>
          <div class="captcha-row">
            <div class="captcha-box" v-html="captchaSvg"></div>
            <button class="fluent-btn" type="button" @click="loadCaptcha" :disabled="captchaLoading">
              {{ captchaLoading ? '刷新中' : '刷新' }}
            </button>
          </div>
          <input v-model="form.captchaCode" class="fluent-input" placeholder="请输入图中验证码" />
        </div>

        <div v-if="emailVerification" class="form-group">
          <label class="form-label">邮箱验证码</label>
          <div class="code-row">
            <input v-model="form.emailCode" class="fluent-input" placeholder="5 位邮箱验证码" @keyup.enter="handleRegister" />
            <button class="fluent-btn" type="button" @click="sendEmailCode" :disabled="sendingCode || countdown > 0">
              {{ countdown > 0 ? countdown + 's' : (sendingCode ? '发送中' : '发送验证码') }}
            </button>
          </div>
          <p class="form-hint">发送邮箱验证码会消耗当前人机验证码，发送后请填写新的图片验证码再注册。</p>
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>
        <p v-if="success" class="success-msg">{{ success }}</p>

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

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  emailCode: '',
  captchaId: '',
  captchaCode: ''
})
const error = ref('')
const success = ref('')
const loading = ref(false)
const sendingCode = ref(false)
const captchaLoading = ref(false)
const configLoading = ref(true)
const registrationOpen = ref(false)
const emailVerification = ref(false)
const captchaSvg = ref('')
const countdown = ref(0)
let countdownTimer = null

onMounted(async () => {
  try {
    const config = await api.get('/api/admin/site-config/public')
    registrationOpen.value = !!config.registration?.enabled
    emailVerification.value = !!config.registration?.emailVerification
    if (registrationOpen.value) await loadCaptcha()
  } catch (err) {
    error.value = err.data?.error || '读取注册设置失败'
    registrationOpen.value = false
  } finally {
    configLoading.value = false
  }
})

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})

const getErrorMessage = (err, fallback) => err?.data?.error || err?.message || fallback

const loadCaptcha = async () => {
  captchaLoading.value = true
  try {
    const data = await api.get('/api/admin/auth/captcha')
    form.captchaId = data.captchaId
    form.captchaCode = ''
    captchaSvg.value = data.svg
  } catch (err) {
    error.value = getErrorMessage(err, '验证码加载失败')
    captchaSvg.value = ''
  } finally {
    captchaLoading.value = false
  }
}

const startCountdown = (seconds = 120) => {
  countdown.value = seconds
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      clearInterval(countdownTimer)
      countdownTimer = null
      countdown.value = 0
    }
  }, 1000)
}

const sendEmailCode = async () => {
  error.value = ''
  success.value = ''
  if (!form.email) { error.value = '请先填写邮箱'; return }
  if (!form.captchaCode) { error.value = '请先填写人机验证码'; return }

  sendingCode.value = true
  try {
    const data = await api.post('/api/admin/auth/register-code', {
      email: form.email,
      captchaId: form.captchaId,
      captchaCode: form.captchaCode
    })
    success.value = data.message || '验证码已发送'
    startCountdown(data.ttl || 120)
    await loadCaptcha()
  } catch (err) {
    error.value = getErrorMessage(err, '验证码发送失败')
    await loadCaptcha()
  } finally {
    sendingCode.value = false
  }
}

const handleRegister = async () => {
  error.value = ''
  success.value = ''
  if (!form.username || !form.password) { error.value = '请填写用户名和密码'; return }
  if (form.password !== form.confirmPassword) { error.value = '两次密码不一致'; return }
  if (form.password.length < 6) { error.value = '密码至少6位'; return }
  if (!form.captchaCode) { error.value = '请填写人机验证码'; return }
  if (emailVerification.value) {
    if (!form.email) { error.value = '请填写邮箱'; return }
    if (!form.emailCode) { error.value = '请填写邮箱验证码'; return }
  }

  loading.value = true
  try {
    const data = await api.post('/api/admin/auth/register', {
      username: form.username,
      password: form.password,
      email: form.email,
      emailCode: form.emailCode,
      captchaId: form.captchaId,
      captchaCode: form.captchaCode
    })
    if (data.token) {
      localStorage.setItem('jwt_token', data.token)
      router.push('/')
    }
  } catch (err) {
    error.value = getErrorMessage(err, '注册失败')
    await loadCaptcha()
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
.register-card { max-width: 460px; width: 100%; padding: var(--space-2xl); }
.title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xs); }
.subtitle { color: var(--fluent-text-secondary); margin-bottom: var(--space-xl); }
.form-group { margin-bottom: var(--space-lg); }
.form-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 10px 14px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.fluent-input:focus { outline: none; border-color: var(--fluent-blue); }
.captcha-row, .code-row { display: flex; gap: var(--space-sm); align-items: center; }
.captcha-row { margin-bottom: var(--space-sm); }
.captcha-box { width: 160px; height: 52px; flex: 0 0 160px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); overflow: hidden; background: #fff; }
.code-row .fluent-input { flex: 1; min-width: 0; }
.code-row .fluent-btn { white-space: nowrap; min-width: 104px; }
.form-hint { font-size: 12px; color: var(--fluent-text-secondary); margin-top: var(--space-xs); }
.error-msg { color: #d13438; font-size: 13px; margin-bottom: var(--space-md); }
.success-msg { color: #107c10; font-size: 13px; margin-bottom: var(--space-md); }
.register-btn { width: 100%; padding: 10px; font-size: 15px; }
.closed-msg { text-align: center; padding: var(--space-xl) 0; }
.closed-msg p { margin-bottom: var(--space-lg); color: var(--fluent-text-secondary); }
.footer-links { display: flex; justify-content: space-between; margin-top: var(--space-lg); padding-top: var(--space-lg); border-top: 1px solid var(--fluent-border); font-size: 13px; }
.footer-links a { color: var(--fluent-blue); text-decoration: none; }
@media (max-width: 520px) {
  .register-page { padding: var(--space-md); }
  .captcha-row, .code-row { align-items: stretch; flex-direction: column; }
  .captcha-box { width: 100%; flex-basis: 52px; display: flex; justify-content: center; }
}
</style>
