<template>
  <div class="admin-site-config">
    <h1 class="page-title">网站配置</h1>
    <div class="config-grid">

      <!-- 网站外观 -->
      <div class="fluent-card">
        <h3>网站外观</h3>
        <div class="form-group">
          <label>网站名称</label>
          <input v-model="form.siteName" class="fluent-input" />
        </div>
        <div class="form-group">
          <label>网站图标 (Favicon)</label>
          <div class="icon-preview">
            <img v-if="iconPreview" :src="iconPreview" class="icon-thumb" />
            <span v-else class="icon-placeholder">无</span>
          </div>
          <input type="file" accept="image/*,.ico" @change="handleIconUpload" class="file-input" />
        </div>
        <div class="form-group">
          <label>网站背景图</label>
          <div class="bg-preview" v-if="form.bgUrl">
            <img :src="form.bgUrl" class="bg-thumb" />
          </div>
          <input v-model="form.bgUrl" class="fluent-input" placeholder="背景图 URL（留空使用默认背景）" />
          <p class="form-hint">输入图片 URL 或上传后自动生成</p>
          <input type="file" accept="image/*" @change="handleBgUpload" class="file-input" />
        </div>
        <div class="form-group">
          <label>背景模糊度: {{ form.bgBlur }}%</label>
          <input type="range" v-model.number="form.bgBlur" min="0" max="100" class="blur-slider" />
          <p class="form-hint">0% = 清晰，100% = 完全模糊</p>
        </div>
        <button class="fluent-btn fluent-btn-primary" @click="saveSiteConfig">保存外观</button>
      </div>

      <!-- 前端显示域名 -->
      <div class="fluent-card">
        <h3>前端显示域名</h3>
        <p class="form-hint">设置后嵌入代码和 API 对外 URL 都使用此域名。</p>
        <div class="form-group"><label>公开域名</label><input v-model="form.publicDomain" class="fluent-input" placeholder="https://img.example.com" /></div>
        <button class="fluent-btn fluent-btn-primary" @click="saveSiteConfig">保存</button>
      </div>

      <!-- 管理员账号 -->
      <div class="fluent-card">
        <h3>管理员账号</h3>
        <div class="form-group"><label>用户名</label><input v-model="form.username" class="fluent-input" disabled /></div>
        <div class="form-group"><label>新密码</label><input v-model="form.newPassword" type="password" class="fluent-input" placeholder="留空不修改" /></div>
        <button class="fluent-btn fluent-btn-primary" @click="changePassword">修改密码</button>
      </div>

      <!-- 图片处理 -->
      <div class="fluent-card">
        <h3>图片处理</h3>
        <div class="form-group">
          <label>中等图最大宽度 (px)</label>
          <input v-model.number="form.mediumWidth" type="number" class="fluent-input" />
        </div>
        <div class="form-group">
          <label>中等图最大高度 (px)</label>
          <input v-model.number="form.mediumHeight" type="number" class="fluent-input" />
        </div>
        <p class="form-hint">修改后新上传的图片将使用新尺寸生成中等图</p>
        <button class="fluent-btn fluent-btn-primary" @click="saveSiteConfig">保存</button>
      </div>

      <!-- 用户配额 -->
      <div class="fluent-card">
        <h3>用户配额（全局默认）</h3>
        <div class="form-group">
          <label>默认用户存储上限 (MB，0=不限制)</label>
          <input v-model.number="form.defaultStorageLimit" type="number" class="fluent-input" />
        </div>
        <div class="form-group">
          <label>单张图片最大大小 (MB，0=不限制)</label>
          <input v-model.number="form.defaultMaxFileSize" type="number" class="fluent-input" />
        </div>
        <p class="form-hint">管理员不受此限制。可在用户管理中为每个用户单独设置。</p>
        <button class="fluent-btn fluent-btn-primary" @click="saveSiteConfig">保存</button>
      </div>

      <!-- 注册设置 -->
      <div class="fluent-card">
        <h3>注册设置</h3>
        <div class="form-group"><label><input type="checkbox" v-model="form.registrationEnabled" /> 开放注册</label></div>
        <div class="form-group"><label><input type="checkbox" v-model="form.emailVerification" /> 注册需邮箱验证</label></div>
        <button class="fluent-btn fluent-btn-primary" @click="saveSiteConfig">保存</button>
      </div>

      <!-- HTTPS -->
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
const api = useApi()
const config = useRuntimeConfig()

const form = reactive({
  username: 'admin', newPassword: '', siteName: '',
  registrationEnabled: false, emailVerification: false,
  httpsEnabled: false, certPath: '', keyPath: '',
  publicDomain: '',
  bgUrl: '',
  bgBlur: 0,
  mediumWidth: 1500, mediumHeight: 1500,
  defaultStorageLimit: 0, defaultMaxFileSize: 50
})
const msg = ref('')
const iconPreview = ref('')

onMounted(async () => {
  try {
    const data = await api.get('/api/admin/site-config')
    form.siteName = data.siteName || ''
    form.registrationEnabled = data.registration?.enabled || false
    form.emailVerification = data.registration?.emailVerification || false
    form.publicDomain = data.publicDomain || ''
    form.httpsEnabled = data.https?.enabled || false
    form.certPath = data.https?.certPath || ''
    form.keyPath = data.https?.keyPath || ''
    form.bgUrl = data.background?.value || ''
    form.bgBlur = data.background?.blur || 0
    form.mediumWidth = data.mediumSize?.width || 1500
    form.mediumHeight = data.mediumSize?.height || 1500
    form.defaultStorageLimit = data.defaultQuota?.storageLimit ? Math.round(data.defaultQuota.storageLimit / 1024 / 1024) : 0
    form.defaultMaxFileSize = data.defaultQuota?.maxFileSize || 50
    if (data.icon) iconPreview.value = `${config.public.apiBase || ''}${data.icon}`
  } catch {}
})

const saveSiteConfig = async () => {
  try {
    await api.put('/api/admin/site-config', {
      siteName: form.siteName,
      publicDomain: form.publicDomain,
      registration: { enabled: form.registrationEnabled, emailVerification: form.emailVerification },
      https: { enabled: form.httpsEnabled, certPath: form.certPath, keyPath: form.keyPath },
      background: { type: form.bgUrl ? 'url' : 'none', value: form.bgUrl, blur: form.bgBlur },
      mediumSize: { width: form.mediumWidth, height: form.mediumHeight },
      defaultQuota: { storageLimit: form.defaultStorageLimit * 1024 * 1024, maxFileSize: form.defaultMaxFileSize }
    })
    msg.value = '配置已保存'
  } catch (err) { msg.value = '失败: ' + err.message }
}

const changePassword = async () => {
  if (!form.newPassword) return alert('请输入新密码')
  try {
    await api.post('/api/admin/auth/change-password', { oldPassword: prompt('请输入旧密码'), newPassword: form.newPassword })
    msg.value = '密码修改成功'
    form.newPassword = ''
  } catch (err) { msg.value = '失败: ' + err.message }
}

const handleIconUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  const fd = new FormData()
  fd.append('file', file)
  try {
    const res = await api.request('/api/admin/site-config/upload-icon', { method: 'POST', body: fd })
    iconPreview.value = `${config.public.apiBase || ''}${res.url}?t=${Date.now()}`
    msg.value = '图标已上传'
  } catch (err) { alert('上传失败: ' + err.message) }
}

const handleBgUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  const fd = new FormData()
  fd.append('file', file)
  try {
    const res = await api.request('/api/admin/site-config/upload-bg', { method: 'POST', body: fd })
    form.bgUrl = `${config.public.apiBase || ''}${res.url}`
    msg.value = '背景图已上传'
  } catch (err) { alert('上传失败: ' + err.message) }
}
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.config-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-lg); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.form-hint { font-size: 12px; color: var(--fluent-text-secondary); margin-top: var(--space-xs); }
.result-msg { margin-top: var(--space-md); font-size: 13px; color: var(--fluent-blue); }
.file-input { margin-top: var(--space-sm); font-size: 13px; }
.icon-preview { margin-bottom: var(--space-sm); }
.icon-thumb { width: 32px; height: 32px; border-radius: 4px; }
.icon-placeholder { font-size: 13px; color: var(--fluent-text-secondary); }
.bg-preview { margin-bottom: var(--space-sm); }
.bg-thumb { max-width: 200px; max-height: 100px; border-radius: var(--radius-sm); object-fit: cover; }
.blur-slider { width: 100%; margin-top: var(--space-sm); accent-color: var(--fluent-blue); }
</style>
