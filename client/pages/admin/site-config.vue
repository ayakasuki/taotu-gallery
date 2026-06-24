<template>
  <div class="admin-site-config">
    <h1 class="page-title">网站配置</h1>
    <div class="config-grid">
      <div class="fluent-card">
        <h3>前端显示域名</h3>
        <p class="form-hint">设置后嵌入代码和 API 对外 URL 都使用此域名。用于套 CDN 或绑定公网域名的场景。</p>
        <div class="form-group"><label>公开域名</label><input v-model="form.publicDomain" class="fluent-input" placeholder="https://img.example.com" /></div>
        <button class="fluent-btn fluent-btn-primary" @click="saveSiteConfig">保存</button>
      </div>
      <div class="fluent-card">
        <h3>管理员账号</h3>
        <div class="form-group"><label>用户名</label><input v-model="form.username" class="fluent-input" disabled /></div>
        <div class="form-group"><label>新密码</label><input v-model="form.newPassword" type="password" class="fluent-input" placeholder="留空不修改" /></div>
        <button class="fluent-btn fluent-btn-primary" @click="changePassword">修改密码</button>
      </div>
      <div class="fluent-card">
        <h3>网站信息</h3>
        <div class="form-group"><label>网站名称</label><input v-model="form.siteName" class="fluent-input" /></div>
        <div class="form-group"><label><input type="checkbox" v-model="form.registrationEnabled" /> 开放注册</label></div>
        <div class="form-group"><label><input type="checkbox" v-model="form.emailVerification" /> 注册需邮箱验证</label></div>
        <button class="fluent-btn fluent-btn-primary" @click="saveSiteConfig">保存</button>
      </div>
      <div class="fluent-card">
        <h3>HTTPS/SSL</h3>
        <div class="form-group"><label><input type="checkbox" v-model="form.httpsEnabled" /> 启用 HTTPS</label></div>
        <div class="form-group"><label>证书路径</label><input v-model="form.certPath" class="fluent-input" /></div>
        <div class="form-group"><label>密钥路径</label><input v-model="form.keyPath" class="fluent-input" /></div>
        <button class="fluent-btn fluent-btn-primary" @click="saveSiteConfig">保存</button>
      </div>
    </div>
    <p v-if="msg" class="result-msg">{{ msg }}</p>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
const form = reactive({
  username: 'admin', newPassword: '', siteName: '',
  registrationEnabled: false, emailVerification: false,
  httpsEnabled: false, certPath: '', keyPath: '',
  publicDomain: ''
})
const msg = ref('')

onMounted(async () => {
  try {
    const api = useApi()
    const data = await api.get('/api/admin/site-config')
    form.siteName = data.siteName || ''
    form.registrationEnabled = data.registration?.enabled || false
    form.emailVerification = data.registration?.emailVerification || false
    form.publicDomain = data.publicDomain || ''
    form.httpsEnabled = data.https?.enabled || false
    form.certPath = data.https?.certPath || ''
    form.keyPath = data.https?.keyPath || ''
  } catch {}
})

const changePassword = async () => {
  if (!form.newPassword) return alert('请输入新密码')
  try {
    const api = useApi()
    await api.post('/api/admin/auth/change-password', { oldPassword: prompt('请输入旧密码'), newPassword: form.newPassword })
    msg.value = '密码修改成功'
    form.newPassword = ''
  } catch (err) { msg.value = '失败: ' + err.message }
}

const saveSiteConfig = async () => {
  try {
    const api = useApi()
    await api.put('/api/admin/site-config', {
      siteName: form.siteName,
      publicDomain: form.publicDomain,
      registration: { enabled: form.registrationEnabled, emailVerification: form.emailVerification },
      https: {
        enabled: form.httpsEnabled,
        certPath: form.certPath,
        keyPath: form.keyPath
      }
    })
    msg.value = '配置已保存'
  } catch (err) { msg.value = '失败: ' + err.message }
}
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--space-lg); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; }
.result-msg { margin-top: var(--space-md); font-size: 13px; color: var(--fluent-blue); }
.form-hint { font-size: 12px; color: var(--fluent-text-secondary); margin-bottom: var(--space-md); }
</style>
