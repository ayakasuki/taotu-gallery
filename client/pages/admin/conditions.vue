<template>
  <div class="admin-conditions">
    <div class="admin-subhero">
      <div>
        <span class="hero-kicker">Auto Rules</span>
        <h1 class="page-title">条件标签</h1>
        <p>根据路径、分辨率、方向和比例自动给图片写入条件标签。</p>
      </div>
      <img src="/icons/admin/condition-tags-64x64.png" class="subhero-icon" alt="" />
    </div>
    <p class="page-desc">条件标签会自动将符合条件的图片归类到对应标签。例如设置"表情包"路径正则条件，所有路径含"表情包"的图片自动纳入该标签。</p>

    <div class="fluent-card">
      <div class="section-header">
        <h3>条件列表</h3>
        <div class="header-actions">
          <button class="fluent-btn fluent-btn-secondary" @click="runConditionTag" :disabled="running">
            {{ running ? '执行中...' : '立即扫描所有图片' }}
          </button>
          <button class="fluent-btn fluent-btn-primary" @click="openAdd">添加条件标签</button>
        </div>
      </div>

      <div v-if="conditions.length > 0" class="condition-list">
        <div v-for="cond in conditions" :key="cond.id" class="condition-item">
          <div class="cond-info">
            <span class="cond-name">{{ cond.name }}</span>
            <span class="cond-type">{{ typeLabels[cond.type] || cond.type }}</span>
            <span class="cond-config">{{ formatConfig(cond) }}</span>
            <span class="cond-status" :class="{ enabled: cond.is_enabled !== false }">
              {{ cond.is_enabled !== false ? '启用' : '禁用' }}
            </span>
          </div>
          <div class="cond-actions">
            <label class="public-toggle" title="公共条件标签（所有用户可见）">
              <input type="checkbox" :checked="cond.is_public" @change="togglePublic(cond)" />
              <span>公共</span>
            </label>
            <button class="fluent-btn fluent-btn-secondary" @click="openEdit(cond)">编辑</button>
            <button class="fluent-btn fluent-btn-secondary" @click="toggleCondition(cond)">
              {{ cond.is_enabled !== false ? '禁用' : '启用' }}
            </button>
            <button class="fluent-btn fluent-btn-secondary" @click="deleteCondition(cond)">删除</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-msg">暂无条件标签。添加条件后，执行"立即标签"会自动将符合条件的图片归类。</div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal fluent-card">
        <h3>{{ editing ? '编辑条件标签' : '添加条件标签' }}</h3>

        <div class="form-group">
          <label>标签名称</label>
          <input v-model="form.name" class="fluent-input" placeholder="例如：表情包、竖图、高清" />
        </div>

        <div class="form-group">
          <label>条件类型</label>
          <TaotuSelect v-model="form.type" :options="conditionTypeOptions" :disabled="!!editing" />
        </div>

        <!-- 路径正则 -->
        <div class="form-group" v-if="form.type === 'path_regex'">
          <label>路径包含的文字</label>
          <input v-model="form.config.pattern" class="fluent-input" placeholder="例如：表情包、壁纸、风景" />
          <p class="form-hint">路径中包含此文字的图片都会被纳入该标签</p>
        </div>

        <!-- 路径排除 -->
        <div class="form-group" v-if="form.type === 'path_exclude'">
          <label>路径排除的文字</label>
          <input v-model="form.config.pattern" class="fluent-input" placeholder="例如：临时、test" />
          <p class="form-hint">路径中包含此文字的图片会被排除</p>
        </div>

        <!-- 分辨率 -->
        <div class="form-group" v-if="form.type === 'resolution'">
          <label>最低分辨率（p）</label>
          <div class="input-with-unit">
            <input v-model.number="form.config.minPixels" type="number" class="fluent-input" placeholder="1080" />
            <span class="unit">p</span>
          </div>
          <p class="form-hint">横边或竖边任意大于等于此值的图片会被纳入。例如填 1080 表示 1080p+</p>
        </div>

        <!-- 横竖图 -->
        <div class="form-group" v-if="form.type === 'orientation'">
          <label>选择方向</label>
          <TaotuSelect v-model="form.config.orientation" :options="orientationOptions" />
        </div>

        <!-- 横竖比 -->
        <div class="form-group" v-if="form.type === 'aspect_ratio'">
          <label>横竖比</label>
          <input value="1:1（正方形）" class="fluent-input" disabled />
          <p class="form-hint">当前锁定为 1:1，用于筛选正方形图片</p>
        </div>

        <div class="modal-actions">
          <button class="fluent-btn fluent-btn-primary" @click="saveCondition">保存</button>
          <button class="fluent-btn fluent-btn-secondary" @click="closeModal">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const conditions = ref([])
const showModal = ref(false)
const editing = ref(null)
const running = ref(false)

const typeLabels = {
  path_regex: '路径正则',
  path_exclude: '路径排除',
  resolution: '分辨率',
  orientation: '横竖图',
  aspect_ratio: '横竖比',
  plugin: '插件'
}

const defaultConfig = () => ({ pattern: '', minPixels: 1080, orientation: 'landscape' })
const form = reactive({ name: '', type: 'path_regex', config: defaultConfig() })
const conditionTypeOptions = [
  { label: '路径正则（路径包含指定文字）', value: 'path_regex' },
  { label: '路径排除（路径不含指定文字）', value: 'path_exclude' },
  { label: '分辨率（横或竖边 ≥ 指定像素）', value: 'resolution' },
  { label: '横竖图', value: 'orientation' },
  { label: '横竖比（正方形筛选）', value: 'aspect_ratio' },
  { label: '插件条件（暂未启用）', value: 'plugin', disabled: true }
]
const orientationOptions = [
  { label: '横图（宽 > 高）', value: 'landscape' },
  { label: '竖图（高 > 宽）', value: 'portrait' }
]

onMounted(() => loadConditions())

const loadConditions = async () => {
  try {
    const data = await api.get('/api/admin/conditions')
    conditions.value = data.conditions || []
  } catch {}
}

const formatConfig = (cond) => {
  const c = cond.config || {}
  if (cond.type === 'path_regex') return `包含: ${c.pattern || '-'}`
  if (cond.type === 'path_exclude') return `排除: ${c.pattern || '-'}`
  if (cond.type === 'resolution') return `≥ ${c.minPixels || '?'}p`
  if (cond.type === 'orientation') return c.orientation === 'landscape' ? '横图' : '竖图'
  if (cond.type === 'aspect_ratio') return '1:1 正方形'
  return ''
}

const openAdd = () => {
  editing.value = null
  form.name = ''; form.type = 'path_regex'; form.config = defaultConfig()
  showModal.value = true
}

const openEdit = (cond) => {
  editing.value = cond
  form.name = cond.name
  form.type = cond.type
  form.config = { ...defaultConfig(), ...(cond.config || {}) }
  // 修复：cond.config.type 映射到 form.config.orientation
  if (cond.type === 'orientation' && cond.config?.type) {
    form.config.orientation = cond.config.type
  }
  if (cond.type === 'resolution' && cond.config?.min) {
    form.config.minPixels = parseInt(cond.config.min) || cond.config.minPixels || 1080
  }
  showModal.value = true
}

const closeModal = () => { showModal.value = false; editing.value = null }

const saveCondition = async () => {
  if (!form.name) return alert('请输入标签名称')

  // 构建 config
  let config = {}
  if (form.type === 'path_regex' || form.type === 'path_exclude') {
    if (!form.config.pattern) return alert('请输入路径文字')
    config = { pattern: form.config.pattern }
  } else if (form.type === 'resolution') {
    if (!form.config.minPixels || form.config.minPixels <= 0) return alert('请输入有效分辨率')
    config = { min: `${form.config.minPixels}p`, minPixels: form.config.minPixels }
  } else if (form.type === 'orientation') {
    config = { type: form.config.orientation }
  } else if (form.type === 'aspect_ratio') {
    config = { min: 0.95, max: 1.05 } // 接近 1:1
  }

  try {
    if (editing.value) {
      await api.put(`/api/admin/conditions/${editing.value.id}`, { name: form.name, config })
    } else {
      await api.post('/api/admin/conditions', { name: form.name, type: form.type, config, is_enabled: true })
    }
    await loadConditions()
    closeModal()
  } catch (err) { alert('保存失败: ' + err.message) }
}

const toggleCondition = async (cond) => {
  try {
    await api.put(`/api/admin/conditions/${cond.id}`, { is_enabled: cond.is_enabled === false })
    await loadConditions()
  } catch (err) { alert('操作失败: ' + err.message) }
}

const deleteCondition = async (cond) => {
  if (!confirm(`确定删除条件 "${cond.name}"？`)) return
  try {
    await api.del(`/api/admin/conditions/${cond.id}`)
    await loadConditions()
  } catch (err) { alert('删除失败: ' + err.message) }
}

const togglePublic = async (cond) => {
  try {
    await api.put(`/api/admin/conditions/${cond.id}`, { is_public: !cond.is_public })
    await loadConditions()
  } catch (err) { alert('操作失败: ' + err.message) }
}

const runConditionTag = async () => {
  running.value = true
  try {
    const data = await api.post('/api/admin/tags/run/condition', { overwrite: true })
    alert(`条件标签执行完成\n处理: ${data.processed} 张图片\n标记: ${data.tagged} 张`)
  } catch (err) {
    alert('执行失败: ' + (err.data?.error || err.message))
  } finally {
    running.value = false
  }
}
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xs); }
.page-desc { color: var(--fluent-text-secondary); margin-bottom: var(--space-xl); font-size: 14px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); }
.header-actions { display: flex; gap: var(--space-sm); }
.condition-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.condition-item { display: flex; justify-content: space-between; align-items: center; padding: var(--space-md); border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); }
.cond-info { display: flex; align-items: center; gap: var(--space-md); flex: 1; }
.cond-name { font-weight: 600; font-size: 14px; }
.cond-type { font-size: 11px; padding: 2px 8px; background: var(--fluent-hover); border-radius: 12px; }
.cond-config { font-size: 13px; color: var(--fluent-text-secondary); }
.cond-status { font-size: 11px; padding: 2px 8px; border-radius: 12px; }
.cond-status.enabled { background: #e6f4ea; color: #107c10; }
.cond-actions { display: flex; gap: 6px; align-items: center; }
.public-toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; color: var(--fluent-text-secondary); }
.public-toggle input { margin: 0; }
.empty-msg { text-align: center; padding: var(--space-xl); color: var(--fluent-text-secondary); }
.form-group { margin-bottom: var(--space-lg); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-sm); }
.fluent-input { width: 100%; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
.form-hint { font-size: 12px; color: var(--fluent-text-secondary); margin-top: var(--space-xs); }
.input-with-unit { display: flex; align-items: center; gap: var(--space-sm); }
.input-with-unit .fluent-input { width: 150px; }
.unit { font-size: 14px; color: var(--fluent-text-secondary); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { width: 500px; padding: var(--space-xl); }
.modal h3 { margin-bottom: var(--space-lg); }
.modal-actions { display: flex; gap: var(--space-md); justify-content: flex-end; margin-top: var(--space-lg); }
</style>
