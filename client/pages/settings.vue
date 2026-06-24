<template>
  <div class="settings-page">
    <div class="settings-card fluent-card">
      <h1>系统设置</h1>
      <p class="subtitle">配置后端连接和公开域名</p>

      <!-- 连接状态 -->
      <div class="connection-status" :class="status">
        <span class="status-dot"></span>
        <span>{{ statusText }}</span>
      </div>

      <!-- 后端地址（统一部署时通常不需要修改） -->
      <div class="form-group">
        <label class="form-label">后端 API 地址</label>
        <p class="form-hint">统一部署时留空即可（前后端同端口）。如需连接远程后端可填写完整地址。</p>
        <div class="input-group">
          <input v-model="backendUrl" class="fluent-input" placeholder="留空使用当前域名" />
          <button class="fluent-btn fluent-btn-secondary" @click="testConnection" :disabled="testing">
            {{ testing ? '检测中...' : '检测' }}
          </button>
        </div>
      </div>

      <!-- 公开域名（管理员设置） -->
      <div class="form-group" v-if="isAdmin">
        <label class="form-label">公开域名</label>
        <p class="form-hint">用于生成图片嵌入代码。如使用 CDN 或公网域名，在此填写。例如 https://img.example.com</p>
        <input v-model="publicDomain" class="fluent-input" placeholder="https://your-domain.com" />
      </div>

      <div class="actions">
        <button class="fluent-btn fluent-btn-primary" @click="save">保存</button>
        <button class="fluent-btn fluent-btn-secondary" @click="goHome">返回首页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: false })

const api = useApi()
const router = useRouter()

const backendUrl = ref('')
const publicDomain = ref('')
const status = ref('idle')
const statusText = ref('未检测')
const testing = ref(false)
const isAdmin = ref(false)

onMounted(async () => {
  backendUrl.value = localStorage.getItem('backend_url') || ''

  // 检查是否管理员
  const token = localStorage.getItem('jwt_token')
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      isAdmin.value = payload.role === 'admin'
      if (isAdmin.value) {
        const config = await api.get('/api/admin/site-config')
        publicDomain.value = config.publicDomain || ''
      }
    } catch {}
  }

  testConnection()
})

const testConnection = async () => {
  testing.value = true
  status.value = 'checking'
  statusText.value = '正在检测...'

  if (backendUrl.value) {
    api.setBackendUrl(backendUrl.value)
  }

  try {
    const result = await api.checkConnection()
    status.value = result.connected ? 'connected' : 'error'
    statusText.value = result.connected ? `已连接: ${result.url}` : `连接失败: ${result.error}`
  } catch (err) {
    status.value = 'error'
    statusText.value = '连接失败'
  } finally {
    testing.value = false
  }
}

const save = async () => {
  // 保存后端地址到 localStorage
  if (backendUrl.value) {
    api.setBackendUrl(backendUrl.value)
  } else {
    localStorage.removeItem('backend_url')
  }

  // 保存公开域名到服务端配置
  if (isAdmin.value && publicDomain.value) {
    try {
      await api.put('/api/admin/site-config', { publicDomain: publicDomain.value })
    } catch {}
  }

  alert('设置已保存')
}

const goHome = () => router.push('/')
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: var(--fluent-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
}

.settings-card {
  max-width: 500px;
  width: 100%;
  padding: var(--space-2xl);
}

h1 { font-size: 24px; font-weight: 600; }
.subtitle { color: var(--fluent-text-secondary); margin-bottom: var(--space-xl); }

.connection-status {
  display: flex; align-items: center; gap: var(--space-sm);
  padding: var(--space-md); border-radius: var(--radius-sm);
  margin-bottom: var(--space-xl); font-size: 14px;
}
.connection-status.connected { background: #e6f4ea; }
.connection-status.error { background: #fde7e9; }
.connection-status.checking { background: #fff4ce; }

.status-dot {
  width: 10px; height: 10px; border-radius: 50%; background: #999;
}
.connected .status-dot { background: #107c10; }
.error .status-dot { background: #d13438; }
.checking .status-dot { background: #fce100; animation: pulse 1s infinite; }

@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }

.form-group { margin-bottom: var(--space-lg); }
.form-label { display: block; font-size: 14px; font-weight: 500; margin-bottom: var(--space-sm); }
.form-hint { font-size: 12px; color: var(--fluent-text-secondary); margin-bottom: var(--space-sm); }

.input-group { display: flex; gap: var(--space-sm); }
.fluent-input {
  flex: 1; padding: 10px 14px;
  border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px;
}
.fluent-input:focus { outline: none; border-color: var(--fluent-blue); }

.actions { display: flex; gap: var(--space-md); margin-top: var(--space-xl); }
</style>
