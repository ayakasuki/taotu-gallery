<template>
  <div class="admin-paths">
    <h1 class="page-title">自定义路径管理</h1>

    <!-- 本地图库 -->
    <div class="fluent-card">
      <h3>本地图库路径</h3>
      <div class="path-item">
        <span class="path-value">data/gallery/</span>
        <span class="path-status">默认图库，不可删除</span>
      </div>
    </div>

    <!-- 自定义路径 -->
    <div class="fluent-card" style="margin-top: var(--space-lg);">
      <div class="section-header">
        <h3>自定义外部路径</h3>
        <button class="fluent-btn fluent-btn-primary" @click="showAdd = true">添加路径</button>
      </div>

      <div v-if="customPaths.length > 0" class="path-list">
        <div v-for="(cp, idx) in customPaths" :key="idx" class="path-item">
          <div class="path-info">
            <span class="path-value">{{ cp.path }}</span>
            <span class="path-meta">{{ cp.recursive ? '递归子目录' : '仅当前目录' }}</span>
          </div>
          <div class="path-actions">
            <button class="fluent-btn fluent-btn-secondary" @click="removePath(idx)">删除</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-msg">暂无自定义路径</div>

      <div class="actions-bar">
        <button class="fluent-btn fluent-btn-primary" @click="savePaths">保存配置</button>
        <button class="fluent-btn fluent-btn-secondary" @click="scanAll" :disabled="scanning">
          {{ scanning ? '扫描中...' : '立即扫描所有路径' }}
        </button>
      </div>
      <p v-if="msg" class="result-msg">{{ msg }}</p>
    </div>

    <!-- 添加路径弹窗 -->
    <div v-if="showAdd" class="modal-overlay" @click.self="showAdd = false">
      <div class="modal fluent-card">
        <h3>添加自定义路径</h3>
        <div class="form-group">
          <label>路径（绝对路径或相对于项目目录）</label>
          <input v-model="newPath.path" class="fluent-input" placeholder="/path/to/images" />
        </div>
        <div class="form-group">
          <label><input type="checkbox" v-model="newPath.recursive" /> 递归扫描子目录</label>
        </div>
        <div class="modal-actions">
          <button class="fluent-btn fluent-btn-primary" @click="addPath">添加</button>
          <button class="fluent-btn fluent-btn-secondary" @click="showAdd = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const customPaths = ref([])
const showAdd = ref(false)
const scanning = ref(false)
const msg = ref('')
const newPath = reactive({ path: '', recursive: true })

onMounted(async () => {
  try {
    const data = await api.get('/api/admin/site-config')
    // paths 存储在 site-config 或独立 paths.json 中
    const pathsData = await api.get('/api/admin/gallery/config')
    customPaths.value = pathsData.customPaths || []
  } catch {
    // 从 paths.json 读取
    customPaths.value = []
  }
})

const addPath = () => {
  if (!newPath.path) return alert('请输入路径')
  customPaths.value.push({ path: newPath.path, recursive: newPath.recursive })
  newPath.path = ''
  newPath.recursive = true
  showAdd.value = false
}

const removePath = (idx) => {
  customPaths.value.splice(idx, 1)
}

const savePaths = async () => {
  try {
    await api.put('/api/admin/gallery/config', { customPaths: customPaths.value })
    msg.value = '路径配置已保存'
  } catch (err) {
    msg.value = '保存失败: ' + err.message
  }
}

const scanAll = async () => {
  scanning.value = true
  msg.value = ''
  try {
    const data = await api.post('/api/admin/gallery/scan')
    msg.value = `扫描完成: 新增 ${data.added || 0}, 跳过 ${data.skipped || 0}`
  } catch (err) {
    msg.value = '扫描失败: ' + err.message
  } finally {
    scanning.value = false
  }
}
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); }
.path-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.path-item { display: flex; justify-content: space-between; align-items: center; padding: var(--space-md); border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); }
.path-info { display: flex; flex-direction: column; gap: 4px; }
.path-value { font-family: monospace; font-size: 14px; }
.path-meta { font-size: 12px; color: var(--fluent-text-secondary); }
.path-status { font-size: 12px; color: var(--fluent-text-secondary); }
.path-actions { display: flex; gap: var(--space-sm); }
.empty-msg { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
.actions-bar { display: flex; gap: var(--space-md); margin-top: var(--space-lg); padding-top: var(--space-lg); border-top: 1px solid var(--fluent-border); }
.result-msg { margin-top: var(--space-md); font-size: 13px; color: var(--fluent-blue); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 500px; padding: var(--space-xl); }
.modal h3 { margin-bottom: var(--space-lg); }
.modal-actions { display: flex; gap: var(--space-md); justify-content: flex-end; margin-top: var(--space-lg); }
</style>
