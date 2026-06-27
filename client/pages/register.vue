<template>
  <div class="register-page">
    <div class="register-layout">
      <div class="register-card fluent-card">
      <div class="register-brand">
        <img v-if="brandLogo" :src="brandLogo" class="brand-logo" alt="" />
        <span v-else class="brand-logo fallback">桃</span>
        <div>
          <h1 class="title">创建账号</h1>
          <p class="subtitle">加入{{ siteName }}，发现更多美好</p>
        </div>
      </div>

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

      <aside class="register-side">
        <div class="side-card fluent-card">
          <div class="side-heading">
            <img src="/icons/status/loading-64x64.png" class="taotu-icon taotu-icon-32" alt="" />
            <div>
              <h2>注册配置</h2>
              <p>系统会先读取站点注册策略</p>
            </div>
          </div>
          <ul>
            <li><span class="dot done"></span>读取系统配置</li>
            <li><span class="dot" :class="{ done: registrationOpen }"></span>检查开放注册</li>
            <li><span class="dot" :class="{ done: !!captchaSvg }"></span>初始化图片验证码</li>
            <li><span class="dot" :class="{ done: emailVerification }"></span>邮箱验证策略</li>
          </ul>
        </div>

        <div class="side-card notice-card fluent-card" v-if="!registrationOpen && !configLoading">
          <img src="/icons/empty/registration-closed-256x256.png" class="taotu-icon taotu-icon-96" alt="" />
          <h2>注册功能暂未开放</h2>
          <p>当前注册功能处于受限状态，请等待管理员开放。</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: false })

const api = useApi()
const router = useRouter()
const config = useRuntimeConfig()

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
const siteName = ref('桃图智库')
const brandLogo = ref('')
const captchaSvg = ref('')
const countdown = ref(0)
let countdownTimer = null

onMounted(async () => {
  try {
    const siteConfig = await api.get('/api/admin/site-config/public')
    siteName.value = siteConfig.siteName || '桃图智库'
    const logo = siteConfig.logo || siteConfig.icon
    brandLogo.value = logo ? `${config.public.apiBase || ''}${logo}` : ''
    registrationOpen.value = !!siteConfig.registration?.enabled
    emailVerification.value = !!siteConfig.registration?.emailVerification
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
  background:
    linear-gradient(rgba(255,255,255,0.14), rgba(255,255,255,0.24)),
    radial-gradient(circle at 20% 16%, rgba(255, 181, 211, 0.46), transparent 30%),
    radial-gradient(circle at 76% 22%, rgba(120, 205, 248, 0.42), transparent 32%),
    linear-gradient(135deg, #fff1f8 0%, #e9f8ff 52%, #fff7fb 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
  position: relative;
  overflow: hidden;
}

.register-page::before {
  content: '';
  position: absolute;
  inset: 8%;
  border-radius: 42px;
  background:
    radial-gradient(circle at 14% 24%, rgba(255,255,255,0.76), transparent 18%),
    radial-gradient(circle at 86% 68%, rgba(255,255,255,0.54), transparent 24%);
  pointer-events: none;
}

.register-layout {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(420px, 560px) minmax(280px, 360px);
  gap: var(--space-lg);
  width: min(100%, 980px);
  align-items: center;
}

.register-card { width: 100%; padding: var(--space-2xl); background: rgba(255,255,255,0.72); border-color: rgba(255,255,255,0.88); }
.register-brand { display: flex; align-items: center; gap: 16px; margin-bottom: var(--space-xl); }
.brand-logo { width: 68px; height: 68px; object-fit: contain; border-radius: var(--taotu-radius-md); }
.brand-logo.fallback { display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--taotu-pink), var(--taotu-purple)); color: white; font-size: 32px; font-weight: 900; box-shadow: 0 16px 34px rgba(248,95,154,0.2); }
.title { color: var(--taotu-text-strong); font-size: 28px; font-weight: 900; margin-bottom: var(--space-xs); }
.subtitle { color: var(--fluent-text-secondary); margin-bottom: var(--space-xl); }
.form-group { margin-bottom: var(--space-lg); }
.form-label { display: block; color: var(--taotu-text); font-size: 13px; font-weight: 800; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 10px 14px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.fluent-input:focus { outline: none; border-color: var(--fluent-blue); }
.captcha-row, .code-row { display: flex; gap: var(--space-sm); align-items: center; }
.captcha-row { margin-bottom: var(--space-sm); }
.captcha-box { width: 160px; height: 52px; flex: 0 0 160px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); overflow: hidden; background: #fff; }
.code-row .fluent-input { flex: 1; min-width: 0; }
.code-row .fluent-btn { white-space: nowrap; min-width: 104px; }
.form-hint { font-size: 12px; color: var(--fluent-text-secondary); margin-top: var(--space-xs); }
.error-msg { color: var(--taotu-danger); font-size: 13px; margin-bottom: var(--space-md); }
.success-msg { color: var(--taotu-success); font-size: 13px; margin-bottom: var(--space-md); }
.register-btn { width: 100%; padding: 10px; font-size: 15px; }
.closed-msg { text-align: center; padding: var(--space-xl) 0; }
.closed-msg p { margin-bottom: var(--space-lg); color: var(--fluent-text-secondary); }
.footer-links { display: flex; justify-content: space-between; margin-top: var(--space-lg); padding-top: var(--space-lg); border-top: 1px solid var(--fluent-border); font-size: 13px; }
.footer-links a { color: var(--fluent-blue); text-decoration: none; }
.register-side { display: flex; flex-direction: column; gap: var(--space-md); }
.side-card { padding: var(--space-lg); background: rgba(255,255,255,0.68); }
.side-heading { display: flex; align-items: center; gap: 12px; margin-bottom: var(--space-lg); }
.side-heading h2, .notice-card h2 { color: var(--taotu-text-strong); font-size: 18px; font-weight: 900; }
.side-heading p, .notice-card p { color: var(--taotu-text-muted); font-size: 13px; }
.side-card ul { display: flex; flex-direction: column; gap: 12px; list-style: none; }
.side-card li { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--taotu-text-muted); font-size: 13px; font-weight: 800; }
.dot { width: 10px; height: 10px; flex: 0 0 10px; border-radius: 999px; background: rgba(124,133,156,0.28); order: -1; }
.dot.done { background: linear-gradient(135deg, var(--taotu-pink), var(--taotu-purple)); box-shadow: 0 0 0 4px rgba(248,95,154,0.12); }
.notice-card { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
@media (max-width: 520px) {
  .register-page { padding: var(--space-md); }
  .captcha-row, .code-row { align-items: stretch; flex-direction: column; }
  .captcha-box { width: 100%; flex-basis: 52px; display: flex; justify-content: center; }
}
@media (max-width: 900px) {
  .register-layout { grid-template-columns: 1fr; }
}
</style>
