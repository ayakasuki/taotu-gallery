<template>
  <div class="admin-backup">
    <h1 class="page-title">备份恢复</h1>
    <div class="backup-grid">
      <div class="fluent-card">
        <h3>创建备份</h3>
        <div class="form-group"><label><input type="checkbox" v-model="options.includeDatabase" /> 数据库</label></div>
        <div class="form-group"><label><input type="checkbox" v-model="options.includeGallery" /> 本地图库</label></div>
        <div class="form-group"><label><input type="checkbox" v-model="options.includeTags" /> 标签文件</label></div>
        <div class="form-group"><label><input type="checkbox" v-model="options.includeConditions" /> 条件配置</label></div>
        <div class="form-group"><label><input type="checkbox" v-model="options.includeSiteConfig" /> 网站配置</label></div>
        <button class="fluent-btn fluent-btn-primary" @click="createBackup" :disabled="backupLoading">
          {{ backupLoading ? '备份中...' : '创建备份' }}
        </button>
        <p v-if="backupResult" class="result-msg">{{ backupResult }}</p>
      </div>
      <div class="fluent-card">
        <h3>备份列表</h3>
        <div class="backup-list">
          <div v-for="b in backups" :key="b.filename" class="backup-item">
            <div>
              <div class="backup-name">{{ b.filename }}</div>
              <div class="backup-meta">{{ formatSize(b.size) }} · {{ new Date(b.created_at).toLocaleString() }}</div>
            </div>
            <div class="backup-actions">
              <button class="fluent-btn fluent-btn-secondary" @click="restoreBackup(b.filename)">恢复</button>
              <button class="fluent-btn fluent-btn-secondary" @click="deleteBackup(b.filename)">删除</button>
            </div>
          </div>
          <div v-if="backups.length === 0" class="empty-msg">暂无备份</div>
        </div>
      </div>
    </div>
    <div class="fluent-card" style="margin-top: var(--space-lg);">
      <h3>路径验证</h3>
      <p class="desc">检查数据库中所有图片路径是否可读</p>
      <button class="fluent-btn fluent-btn-secondary" @click="verifyPaths">验证路径</button>
      <div v-if="verifyResult" class="result-msg">
        总计 {{ verifyResult.total }} 张图片，可读 {{ verifyResult.readable }}，不可读 {{ verifyResult.unreadable }}
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
const options = reactive({ includeDatabase: true, includeGallery: true, includeTags: true, includeConditions: true, includeSiteConfig: true })
const backups = ref([])
const backupLoading = ref(false)
const backupResult = ref('')
const verifyResult = ref(null)

onMounted(() => loadBackups())

const loadBackups = async () => {
  try {
    const api = useApi()
    const data = await api.get('/api/admin/backup/list')
    backups.value = data.backups || []
  } catch {}
}

const createBackup = async () => {
  backupLoading.value = true; backupResult.value = ''
  try {
    const api = useApi()
    const data = await api.post('/api/admin/backup', options)
    backupResult.value = `备份完成: ${data.filename} (${formatSize(data.size)})`
    await loadBackups()
  } catch (err) { backupResult.value = '失败: ' + err.message }
  finally { backupLoading.value = false }
}

const restoreBackup = async (filename) => {
  if (!confirm(`确定恢复备份 "${filename}"？此操作会覆盖当前数据。`)) return
  try {
    const api = useApi()
    await api.post('/api/admin/restore', { filename })
    alert('恢复完成')
  } catch (err) { alert('恢复失败: ' + err.message) }
}

const deleteBackup = async (filename) => {
  if (!confirm(`确定删除备份 "${filename}"？`)) return
  try {
    const api = useApi()
    await api.del(`/api/admin/backup/${filename}`)
    await loadBackups()
  } catch (err) { alert('删除失败: ' + err.message) }
}

const verifyPaths = async () => {
  try {
    const api = useApi()
    verifyResult.value = await api.post('/api/admin/restore/verify')
  } catch (err) { alert('验证失败: ' + err.message) }
}

const formatSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.backup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg); }
.form-group { margin-bottom: var(--space-md); }
.form-group label { display: flex; align-items: center; gap: var(--space-sm); font-size: 14px; cursor: pointer; }
.backup-list { max-height: 400px; overflow-y: auto; }
.backup-item { display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) 0; border-bottom: 1px solid var(--fluent-border); }
.backup-name { font-size: 13px; font-weight: 500; }
.backup-meta { font-size: 12px; color: var(--fluent-text-secondary); }
.backup-actions { display: flex; gap: var(--space-sm); }
.result-msg { margin-top: var(--space-md); padding: var(--space-sm); background: var(--fluent-blue-light); border-radius: var(--radius-sm); font-size: 13px; }
.desc { font-size: 13px; color: var(--fluent-text-secondary); margin-bottom: var(--space-md); }
.empty-msg { text-align: center; padding: var(--space-lg); color: var(--fluent-text-secondary); }
</style>
