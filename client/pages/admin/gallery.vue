<template>
  <div class="admin-gallery">
    <h1 class="page-title">本地图库设置</h1>
    <div class="fluent-card">
      <h3>图片展示配置</h3>
      <div class="form-group">
        <label>默认展示模式</label>
        <select v-model="config.displayMode" class="fluent-input">
          <option value="grid">网格</option>
          <option value="waterfall">瀑布流</option>
        </select>
      </div>
      <div class="form-group">
        <label><input type="checkbox" v-model="config.showUrlAfterUpload" /> 上传成功后展示 URL</label>
      </div>
      <button class="fluent-btn fluent-btn-primary" @click="save">保存</button>
      <p v-if="msg" class="result-msg">{{ msg }}</p>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
const config = reactive({ displayMode: 'grid', showUrlAfterUpload: true })
const msg = ref('')

onMounted(async () => {
  try {
    const api = useApi()
    const data = await api.get('/api/admin/gallery/config')
    if (data.display) config.displayMode = data.display.mode === 'waterfall' ? 'waterfall' : 'grid'
    if (data.upload) config.showUrlAfterUpload = data.upload.showUrlAfterUpload !== false
  } catch {}
})

const save = async () => {
  try {
    const api = useApi()
    await api.put('/api/admin/gallery/config', {
      display: { mode: config.displayMode === 'waterfall' ? 'waterfall' : 'grid' },
      upload: { showUrlAfterUpload: config.showUrlAfterUpload }
    })
    msg.value = '已保存'
  } catch (err) { msg.value = '失败: ' + err.message }
}
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; }
.result-msg { margin-top: var(--space-md); font-size: 13px; color: var(--fluent-blue); }
</style>
