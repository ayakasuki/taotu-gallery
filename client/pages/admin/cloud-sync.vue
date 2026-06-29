<template>
  <div class="admin-cloud-sync">
    <h1 class="page-title">云同步</h1>
    <div class="fluent-card">
      <h3>WebDAV 配置</h3>
      <div class="form-group"><label>服务器地址</label><input v-model="config.url" class="fluent-input" placeholder="https://dav.example.com" /></div>
      <div class="form-group"><label>用户名</label><input v-model="config.username" class="fluent-input" /></div>
      <div class="form-group"><label>密码</label><input v-model="config.password" type="password" class="fluent-input" /></div>
      <div class="form-group"><label>远程路径</label><input v-model="config.remotePath" class="fluent-input" placeholder="/gallery-sync/" /></div>
      <div class="actions">
        <button class="fluent-btn fluent-btn-primary" @click="saveConfig">保存配置</button>
        <button class="fluent-btn fluent-btn-secondary" @click="testConnection" :disabled="testing">
          {{ testing ? '测试中...' : '测试连接' }}
        </button>
        <button class="fluent-btn fluent-btn-primary" @click="runSync" :disabled="syncing">
          {{ syncing ? '同步中...' : '立即同步' }}
        </button>
      </div>
    </div>
    <div class="fluent-card" style="margin-top: var(--space-lg);">
      <h3>可同步内容</h3>
      <ul class="sync-list">
        <li>标签文件 (tags.json)</li>
        <li>路径配置 (paths.json)</li>
        <li>条件配置 (conditions.json)</li>
        <li>网站配置 (site.json)</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
const { showAdminToast } = useAdminToast()
const config = reactive({ url: '', username: '', password: '', remotePath: '/gallery-sync/' })
const testing = ref(false); const syncing = ref(false)

onMounted(async () => {
  try {
    const api = useApi()
    const data = await api.get('/api/admin/cloud-sync/config')
    if (data.url) config.url = data.url
    if (data.username) config.username = data.username
    if (data.remotePath) config.remotePath = data.remotePath
  } catch {}
})

const saveConfig = async () => {
  try {
    const api = useApi()
    await api.put('/api/admin/cloud-sync/config', { ...config, configured: true })
    showAdminToast('配置已保存', 'success')
  } catch (err) { showAdminToast('保存出错: ' + (err?.data?.error || err.message), 'error') }
}

const testConnection = async () => {
  testing.value = true
  try {
    const api = useApi()
    const data = await api.post('/api/admin/cloud-sync/test')
    showAdminToast(data.message || (data.success ? '连接成功' : '连接失败'), data.success ? 'success' : 'error')
  } catch (err) { showAdminToast('测试失败: ' + (err?.data?.error || err.message), 'error') }
  finally { testing.value = false }
}

const runSync = async () => {
  syncing.value = true
  try {
    const api = useApi()
    const data = await api.post('/api/admin/cloud-sync/run')
    showAdminToast(`同步完成: 上传 ${data.uploaded}, 下载 ${data.downloaded}`, 'success')
  } catch (err) { showAdminToast('同步失败: ' + (err?.data?.error || err.message), 'error') }
  finally { syncing.value = false }
}
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; }
.actions { display: flex; gap: var(--space-md); margin-top: var(--space-lg); }
.result-msg { margin-top: var(--space-md); font-size: 13px; color: var(--fluent-blue); }
.result-msg.error { color: #d13438; }
.sync-list { padding-left: var(--space-lg); }
.sync-list li { font-size: 14px; padding: 4px 0; }
</style>
