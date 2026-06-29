<template>
  <div class="admin-gallery">
    <div class="admin-subhero">
      <div>
        <span class="hero-kicker">Gallery</span>
        <h1 class="page-title">本地图库设置</h1>
        <p>配置首页图库默认展示、分页和公开图库浏览体验。</p>
      </div>
      <img src="/icons/admin/gallery-settings-64x64.png" class="subhero-icon" alt="" />
    </div>
    <div class="fluent-card">
      <h3>图片展示配置</h3>
      <div class="form-group">
        <label>默认展示模式</label>
        <TaotuSelect v-model="config.displayMode" :options="displayModeOptions" />
      </div>
      <div class="form-group">
        <label><input type="checkbox" v-model="config.showUrlAfterUpload" /> 上传成功后展示 URL</label>
      </div>
      <button class="fluent-btn fluent-btn-primary" @click="save">保存</button>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
const { showAdminToast } = useAdminToast()
const config = reactive({ displayMode: 'grid', showUrlAfterUpload: true })
const displayModeOptions = [
  { label: '网格', value: 'grid' },
  { label: '瀑布流', value: 'waterfall' }
]

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
    showAdminToast('配置已保存', 'success')
  } catch (err) { showAdminToast('保存出错: ' + (err?.data?.error || err.message), 'error') }
}
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; }
.result-msg { margin-top: var(--space-md); font-size: 13px; color: var(--fluent-blue); }
</style>
