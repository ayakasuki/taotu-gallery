<template>
  <div class="conditions-page">
    <div class="conditions-layout">
      <section class="conditions-panel">
      <header class="conditions-header">
        <div>
          <div class="breadcrumb"><span>管理</span><i>/</i><span>条件标签</span></div>
          <h1>条件标签</h1>
          <p>通过条件标签对图片进行自动识别与筛选，满足图库的内容质量与展示规范。</p>
        </div>
        <div class="header-actions">
          <button type="button" class="scan-all-btn" :disabled="running" @click="runConditionTag">
            <img src="/icons/actions/refresh-64x64.png" alt="" />{{ running ? '扫描中...' : '立即扫描所有图片' }}
          </button>
          <button type="button" class="add-condition-btn" @click="openAdd">
            <img src="/icons/actions/add-64x64.png" alt="" />添加条件标签
          </button>
        </div>
      </header>

      <div class="condition-table">
        <div class="table-head">
          <span>条件名称</span>
          <span>条件类型</span>
          <span>配置摘要</span>
          <span>启用状态</span>
          <span>公开开关</span>
          <span>操作</span>
        </div>

        <div v-if="loading" class="empty-row">正在载入条件标签...</div>
        <div v-else-if="!conditions.length" class="empty-row">暂无条件标签，点击右上角添加新的自动筛选规则。</div>

        <div v-for="cond in conditions" v-else :key="cond.id" class="condition-row">
          <div class="name-cell">
            <strong>{{ cond.name }}</strong>
            <small>ID: {{ conditionCode(cond.id) }}</small>
          </div>
          <div>
            <span class="type-pill" :class="typeTone(cond.type)">{{ typeLabel(cond.type) }}</span>
          </div>
          <div class="summary-cell">{{ formatConfig(cond) }}</div>
          <div>
            <span class="status-dot" :class="{ enabled: isEnabled(cond) }">
              <i></i>{{ isEnabled(cond) ? '启用' : '禁用' }}
            </span>
          </div>
          <div>
            <label class="pink-toggle" title="公共条件标签">
              <input type="checkbox" :checked="!!cond.is_public" @change="togglePublic(cond)" />
              <i></i>
            </label>
          </div>
          <div class="row-actions">
            <button type="button" class="icon-btn edit" title="编辑" @click="openEdit(cond)">
              <img src="/icons/actions/edit-64x64.png" alt="" />
            </button>
            <button type="button" class="icon-btn enable" :title="isEnabled(cond) ? '禁用' : '启用'" @click="toggleCondition(cond)">
              <img src="/icons/status/enabled-64x64.png" alt="" />
            </button>
            <button type="button" class="icon-btn delete" title="删除" @click="deleteCondition(cond)">
              <img src="/icons/actions/trash-64x64.png" alt="" />
            </button>
          </div>
        </div>
      </div>

      <footer class="condition-pagination">
        <span>共 {{ total }} 条条件</span>
        <div class="pager-buttons">
          <button type="button" :disabled="page <= 1" @click="goPage(page - 1)">
            <img src="/icons/gallery/pagination-prev-64x64.png" alt="" />
          </button>
          <button type="button" class="current">{{ page }}</button>
          <button type="button" :disabled="page >= totalPages" @click="goPage(page + 1)">
            <img src="/icons/gallery/pagination-next-64x64.png" alt="" />
          </button>
        </div>
      </footer>
      </section>

      <aside class="tag-config-card">
        <header>
          <div>
            <h2>通用配置</h2>
            <p>配置条件标签与标签同步的全局执行策略。</p>
          </div>
          <span class="saved-badge"><i>✓</i>已保存</span>
        </header>

        <label class="config-field">
          <span>延迟执行时间</span>
          <div>
            <input v-model.number="tagConfig.delayMinutes" type="number" min="0" step="1" />
            <em>分钟</em>
          </div>
          <small>标签配置变更后的延迟执行窗口。</small>
        </label>

        <label class="config-field">
          <span>差异阈值</span>
          <div>
            <input v-model.number="tagConfig.diffThreshold" type="number" min="0" max="1" step="0.1" />
            <em>0-1</em>
          </div>
          <small>超过阈值时触发完整重标签，低于阈值则按差异增量处理。</small>
        </label>

        <label class="config-toggle">
          <span>
            自动监听标签变更
            <small>保持标签变更后的自动同步策略。</small>
          </span>
          <label class="pink-toggle">
            <input type="checkbox" v-model="tagConfig.autoSync" />
            <i></i>
          </label>
        </label>

        <button type="button" class="config-save-btn" @click="saveTagConfig">
          <img src="/icons/actions/save-64x64.png" alt="" />保存通用配置
        </button>
      </aside>
    </div>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <section class="condition-modal">
        <header class="modal-header">
          <h2>{{ editing ? '编辑条件标签' : '添加条件标签' }}</h2>
          <button type="button" class="modal-close" @click="closeModal">×</button>
        </header>

        <div class="modal-form">
          <label class="form-line">
            <span>标签名称</span>
            <input v-model.trim="form.name" placeholder="例如：1080p 图片" />
          </label>

          <label class="form-line">
            <span>条件类型</span>
            <select v-model="form.type" @change="resetConfigForType">
              <option v-for="option in conditionTypeOptions" :key="option.value" :value="option.value" :disabled="option.disabled">
                {{ option.label }}
              </option>
            </select>
          </label>

          <label v-if="form.type === 'path_regex'" class="form-line">
            <span>路径包含（可选）</span>
            <input v-model.trim="form.config.pattern" placeholder="例如：/scenery/, /landscape/" />
            <small>多个路径用逗号分隔</small>
          </label>

          <label v-if="form.type === 'path_exclude'" class="form-line">
            <span>路径排除（可选）</span>
            <input v-model.trim="form.config.pattern" placeholder="例如：/low_quality/, /watermark/" />
            <small>多个路径用逗号分隔</small>
          </label>

          <label v-if="form.type === 'resolution'" class="form-line">
            <span>分辨率档位</span>
            <select v-model.number="form.config.minPixels">
              <option v-for="option in resolutionOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>

          <div v-if="form.type === 'orientation' || form.type === 'aspect_ratio'" class="check-group">
            <span>横图 / 竖图</span>
            <div class="checkbox-row">
              <label class="soft-check">
                <input v-model="orientationSelections" type="checkbox" value="landscape" />
                <i></i>仅横图（宽高比 > 1.1）
              </label>
              <label class="soft-check">
                <input v-model="orientationSelections" type="checkbox" value="portrait" />
                <i></i>仅竖图（宽高比 < 0.9）
              </label>
              <label class="soft-check">
                <input v-model="orientationSelections" type="checkbox" value="square" />
                <i></i>仅正方形（0.9 - 1.1）
              </label>
            </div>
          </div>
        </div>

        <footer class="modal-actions">
          <button type="button" class="cancel-btn" @click="closeModal">取消</button>
          <button type="button" class="save-btn" @click="saveCondition">保存</button>
        </footer>
      </section>
    </div>

    <ConfirmDeleteDialog
      :show="deleteDialog.show"
      title="确认删除条件"
      :message="deleteDialog.message"
      :effects="deleteDialog.effects"
      :avatar-text="deleteDialog.avatarText"
      :loading="deleteDialog.loading"
      @confirm="confirmDeleteCondition"
      @cancel="closeDeleteDialog"
    />
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const { showAdminToast } = useAdminToast()
const conditions = ref([])
const showModal = ref(false)
const editing = ref(null)
const running = ref(false)
const loading = ref(false)
const page = ref(1)
const pageSize = 8
const total = ref(0)
const deleteDialog = reactive({ show: false, payload: null, message: '', effects: [], avatarText: '条', loading: false })

const typeLabels = {
  path_regex: '路径包含',
  path_exclude: '路径规则',
  resolution: '分辨率',
  orientation: '宽高比',
  aspect_ratio: '宽高比',
  avg_color: '平均颜色',
  include_color: '包含颜色',
  plugin: '插件'
}

const conditionTypeOptions = [
  { label: '分辨率', value: 'resolution' },
  { label: '路径包含', value: 'path_regex' },
  { label: '路径排除', value: 'path_exclude' },
  { label: '宽高比', value: 'orientation' }
]

const resolutionOptions = [
  { label: '1080p以下（短边 <1080，最长边 ≤2560）', value: 720 },
  { label: '1080p（短边 ≥1080，最长边 ≤2560）', value: 1080 },
  { label: '2K（最长边 >2560 且 ≤3840）', value: 1440 },
  { label: '4K+（最长边 >3840）', value: 2160 }
]

const defaultConfig = (type = 'resolution') => {
  if (type === 'path_regex' || type === 'path_exclude') return { pattern: '' }
  if (type === 'resolution') return { level: '1080p', min: '1080p', minPixels: 1080 }
  if (type === 'orientation') return { type: 'landscape' }
  if (type === 'aspect_ratio') return { min: 0.9, max: 1.1 }
  return {}
}

const form = reactive({ name: '', type: 'resolution', config: defaultConfig('resolution') })
const orientationSelections = ref(['landscape'])
const tagConfig = reactive({ delayMinutes: 5, diffThreshold: 0.5, autoSync: true })
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

onMounted(async () => {
  await Promise.all([loadConditions(), loadTagConfig()])
})

async function loadConditions() {
  loading.value = true
  try {
    const data = await api.get('/api/admin/conditions', { page: page.value, pageSize })
    conditions.value = (data.conditions || []).map(normalizeCondition)
    total.value = Number(data.total ?? conditions.value.length)
    if (page.value > totalPages.value) {
      page.value = totalPages.value
      await loadConditions()
    }
  } catch {
    conditions.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function loadTagConfig() {
  try {
    const data = await api.get('/api/admin/site-config')
    tagConfig.delayMinutes = Number(data.tagDelayMinutes ?? 5)
    tagConfig.diffThreshold = Number(data.tagDiffThreshold ?? 0.5)
    tagConfig.autoSync = data.tagAutoSync !== false
  } catch {}
}

async function saveTagConfig() {
  try {
    await api.put('/api/admin/site-config', {
      tagDelayMinutes: Number(tagConfig.delayMinutes || 0),
      tagDiffThreshold: Number(tagConfig.diffThreshold || 0),
      tagAutoSync: !!tagConfig.autoSync
    })
    showAdminToast('通用配置已保存', 'success')
  } catch (err) {
    showAdminToast('保存失败: ' + (err.data?.error || err.message), 'error')
  }
}

function normalizeCondition(cond) {
  return {
    ...cond,
    config: parseConfig(cond.config),
    is_enabled: cond.is_enabled !== false && cond.is_enabled !== 0,
    is_public: cond.is_public === true || cond.is_public === 1
  }
}

function parseConfig(config) {
  if (!config) return {}
  if (typeof config === 'object') return config
  try { return JSON.parse(config) } catch { return {} }
}

function conditionCode(id) {
  return `cond_${String(id).padStart(3, '0')}`
}

function typeLabel(type) {
  return typeLabels[type] || type
}

function typeTone(type) {
  if (type === 'resolution') return 'tone-resolution'
  if (type === 'path_regex') return 'tone-include'
  if (type === 'path_exclude') return 'tone-path'
  if (type === 'orientation' || type === 'aspect_ratio') return 'tone-ratio'
  return 'tone-plugin'
}

function splitPattern(value) {
  return String(value || '')
    .split(/[,，]/)
    .map(part => part.trim())
    .filter(Boolean)
}

function formatPatternList(value) {
  const items = splitPattern(value)
  return items.length ? items.join(', ') : '-'
}

function resolutionSummary(config = {}) {
  const minPixels = Number(config.minPixels || parseInt(config.min) || 1080)
  const level = String(config.level || '').toLowerCase()
  if (minPixels < 1080 || level.includes('below') || level.includes('under') || level.includes('以下')) return '1080p以下（短边 < 1080，最长边 ≤ 2560）'
  if (minPixels >= 2160 || level.includes('4k')) return '4K+（最长边 > 3840）'
  if (minPixels >= 1440 || level.includes('2k')) return '2K（最长边 > 2560 且 ≤ 3840）'
  return '1080p（短边 ≥ 1080，最长边 ≤ 2560）'
}

function formatConfig(cond) {
  const config = cond.config || {}
  if (cond.type === 'path_regex') return `包含路径：${formatPatternList(config.pattern)}`
  if (cond.type === 'path_exclude') return `排除路径：${formatPatternList(config.pattern)}`
  if (cond.type === 'resolution') return resolutionSummary(config)
  if (cond.type === 'orientation') {
    if (config.type === 'portrait') return '竖图（宽高比 < 0.9）'
    if (config.type === 'square') return '1:1 正方形（0.9 - 1.1）'
    return '横图（宽高比 > 1.1）'
  }
  if (cond.type === 'aspect_ratio') return '1:1 正方形（0.9 - 1.1）'
  return '按自定义条件筛选'
}

function isEnabled(cond) {
  return cond.is_enabled !== false
}

function openAdd() {
  editing.value = null
  form.name = ''
  form.type = 'resolution'
  form.config = defaultConfig(form.type)
  orientationSelections.value = ['landscape']
  showModal.value = true
}

function openEdit(cond) {
  const normalized = normalizeCondition(cond)
  editing.value = normalized
  form.name = normalized.name
  form.type = normalized.type === 'aspect_ratio' ? 'orientation' : normalized.type
  form.config = { ...defaultConfig(form.type), ...(normalized.config || {}) }
  if (normalized.type === 'orientation') {
    const type = form.config.type || form.config.orientation || 'landscape'
    orientationSelections.value = [type]
  } else if (normalized.type === 'aspect_ratio') {
    orientationSelections.value = ['square']
  } else {
    orientationSelections.value = []
  }
  showModal.value = true
}

function resetConfigForType() {
  form.config = defaultConfig(form.type)
  if (form.type === 'orientation') orientationSelections.value = ['landscape']
  else if (form.type === 'aspect_ratio') orientationSelections.value = ['square']
  else orientationSelections.value = []
}

function closeModal() {
  showModal.value = false
  editing.value = null
}

function buildConfigForSave() {
  if (form.type === 'path_regex' || form.type === 'path_exclude') {
    if (!form.config.pattern) throw new Error('请输入路径规则')
    return { pattern: form.config.pattern }
  }
  if (form.type === 'resolution') {
    const minPixels = Number(form.config.minPixels || 1080)
    if (!minPixels || minPixels <= 0) throw new Error('请选择有效分辨率')
    const level = minPixels < 1080 ? 'below1080p' : (minPixels >= 2160 ? '4k' : (minPixels >= 1440 ? '2k' : '1080p'))
    return { level, min: `${minPixels}p`, minPixels }
  }
  if (form.type === 'orientation') {
    const selected = orientationSelections.value[0]
    if (!selected || selected === 'square') {
      return { min: 0.9, max: 1.1 }
    }
    return { type: selected }
  }
  if (form.type === 'aspect_ratio') return { min: 0.9, max: 1.1 }
  return { ...(form.config || {}) }
}

async function saveCondition() {
  if (!form.name) return showAdminToast('请输入标签名称', 'error')

  try {
    const config = buildConfigForSave()
    const payloadType = form.type === 'orientation' && orientationSelections.value[0] === 'square' ? 'aspect_ratio' : form.type
    const payload = { name: form.name, type: payloadType, config, is_enabled: true }
    if (editing.value) {
      await api.put(`/api/admin/conditions/${editing.value.id}`, payload)
    } else {
      await api.post('/api/admin/conditions', payload)
    }
    await loadConditions()
    closeModal()
    showAdminToast('条件标签已保存', 'success')
  } catch (err) {
    showAdminToast('保存失败: ' + (err.data?.error || err.message || err), 'error')
  }
}

async function toggleCondition(cond) {
  try {
    await api.put(`/api/admin/conditions/${cond.id}`, { is_enabled: !isEnabled(cond) })
    await loadConditions()
  } catch (err) {
    showAdminToast('操作失败: ' + (err.data?.error || err.message), 'error')
  }
}

async function deleteCondition(cond) {
  deleteDialog.show = true
  deleteDialog.payload = cond
  deleteDialog.message = `删除条件 "${cond.name}"？`
  deleteDialog.effects = ['条件规则会被删除', '已写入图片的标签不会自动删除']
}

function closeDeleteDialog() {
  if (deleteDialog.loading) return
  deleteDialog.show = false
  deleteDialog.payload = null
  deleteDialog.effects = []
}

async function confirmDeleteCondition() {
  if (!deleteDialog.payload || deleteDialog.loading) return
  deleteDialog.loading = true
  const cond = deleteDialog.payload
  try {
    await api.del(`/api/admin/conditions/${cond.id}`)
    if (conditions.value.length === 1 && page.value > 1) page.value -= 1
    await loadConditions()
    showAdminToast('条件标签已删除', 'success')
    deleteDialog.loading = false
    closeDeleteDialog()
  } catch (err) {
    showAdminToast('删除失败: ' + (err.data?.error || err.message), 'error')
  } finally {
    deleteDialog.loading = false
  }
}

async function togglePublic(cond) {
  try {
    await api.put(`/api/admin/conditions/${cond.id}`, { is_public: !cond.is_public })
    await loadConditions()
  } catch (err) {
    showAdminToast('操作失败: ' + (err.data?.error || err.message), 'error')
  }
}

async function runConditionTag() {
  running.value = true
  try {
    const data = await api.post('/api/admin/tags/run/condition', { force: true })
    showAdminToast(data.message || `条件标签执行完成，处理 ${data.processed} 张，标记 ${data.tagged} 张`, 'success')
  } catch (err) {
    showAdminToast('执行失败: ' + (err.data?.error || err.message), 'error')
  } finally {
    running.value = false
  }
}

function goPage(nextPage) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return
  page.value = nextPage
  loadConditions()
}

watch(orientationSelections, (value) => {
  if (form.type !== 'orientation') return
  const last = value[value.length - 1]
  if (!last) {
    orientationSelections.value = ['landscape']
    return
  }
  if (orientationSelections.value.length !== 1 || orientationSelections.value[0] !== last) {
    orientationSelections.value = [last]
  }
  if (last === 'square') {
    form.config = defaultConfig('aspect_ratio')
  } else {
    form.config = { type: last }
  }
}, { deep: true })
</script>

<style scoped>
.conditions-page {
  position: relative;
  min-height: calc(100vh - 96px);
  padding: 2px 0 18px;
}

.conditions-page::before {
  content: '';
  position: fixed;
  inset: 64px 0 0 220px;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(circle at 15% 8%, rgba(180, 230, 255, 0.42), transparent 30%),
    radial-gradient(circle at 92% 6%, rgba(255, 190, 215, 0.34), transparent 28%),
    linear-gradient(135deg, rgba(248, 251, 255, 0.94), rgba(255, 249, 253, 0.86) 52%, rgba(245, 251, 255, 0.94));
}

.conditions-layout {
  min-height: calc(100vh - 126px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
  align-items: stretch;
}

.conditions-panel {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) 50px;
  padding: 22px 24px;
  border: 1px solid rgba(224, 229, 240, 0.72);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: 0 18px 42px rgba(79, 92, 124, 0.08);
  backdrop-filter: blur(22px) saturate(1.08);
}

.tag-config-card {
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto auto auto 42px;
  align-content: start;
  gap: 18px;
  padding: 20px;
  border: 1px solid rgba(224, 229, 240, 0.72);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: 0 18px 42px rgba(79, 92, 124, 0.08);
  backdrop-filter: blur(22px) saturate(1.08);
}

.tag-config-card header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(224, 229, 240, 0.66);
}

.tag-config-card h2 {
  margin: 0 0 6px;
  color: #303a51;
  font-size: 18px;
  font-weight: 900;
}

.tag-config-card p,
.tag-config-card small {
  margin: 0;
  color: #96a1b5;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.55;
}

.saved-badge {
  min-width: 72px;
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border: 1px solid rgba(84, 204, 145, 0.2);
  border-radius: 999px;
  background: rgba(237, 252, 244, 0.9);
  color: #42bd7b;
  font-size: 12px;
  font-weight: 900;
}

.saved-badge i {
  font-style: normal;
}

.config-field {
  display: grid;
  gap: 8px;
  color: #657188;
  font-size: 13px;
  font-weight: 900;
}

.config-field > div {
  min-height: 38px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 54px;
  align-items: center;
  border: 1px solid rgba(218, 224, 238, 0.88);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
}

.config-field input {
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  border: none;
  outline: none;
  background: transparent;
  color: #647088;
  font-size: 14px;
  font-weight: 900;
}

.config-field em {
  color: #a2abbc;
  font-size: 12px;
  font-style: normal;
  font-weight: 900;
}

.config-toggle {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px;
  border: 1px solid rgba(224, 229, 240, 0.72);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.48);
  color: #657188;
  font-size: 13px;
  font-weight: 900;
}

.config-toggle span {
  display: grid;
  gap: 4px;
}

.config-save-btn {
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.46);
  border-radius: 8px;
  background: linear-gradient(90deg, #ff6b9e, #ff77aa);
  color: white;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 12px 26px rgba(255, 108, 158, 0.2);
}

.config-save-btn img {
  width: 16px;
  height: 16px;
}

.conditions-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  margin-bottom: 18px;
}

.breadcrumb {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  color: #9aa5b8;
  font-size: 13px;
  font-weight: 900;
}

.breadcrumb i {
  color: #d2d8e4;
  font-style: normal;
}

.conditions-header h1 {
  margin: 0 0 5px;
  color: #303a51;
  font-size: 28px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.1;
}

.conditions-header p {
  color: #8994aa;
  font-size: 14px;
  font-weight: 800;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  gap: 14px;
  flex: 0 0 auto;
  padding-top: 30px;
}

.scan-all-btn,
.add-condition-btn {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 18px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.66);
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.scan-all-btn {
  border: 1px solid rgba(255, 111, 157, 0.3);
  color: #ff6f9d;
}

.add-condition-btn {
  border: 1px solid rgba(156, 125, 245, 0.3);
  color: #8d74eb;
}

.scan-all-btn img,
.add-condition-btn img {
  width: 16px;
  height: 16px;
}

.scan-all-btn:hover:not(:disabled),
.add-condition-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(89, 96, 122, 0.1);
}

.scan-all-btn:disabled {
  opacity: 0.62;
  cursor: default;
}

.condition-table {
  min-height: 0;
  overflow: auto;
  border: 1px solid rgba(224, 229, 240, 0.74);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.42);
}

.table-head,
.condition-row {
  display: grid;
  grid-template-columns: 1.25fr 0.82fr 1.45fr 0.72fr 0.72fr 0.88fr;
  align-items: center;
  gap: 18px;
}

.table-head {
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 46px;
  padding: 0 18px;
  border-bottom: 1px solid rgba(224, 229, 240, 0.74);
  color: #8792a8;
  font-size: 12px;
  font-weight: 900;
}

.condition-row {
  min-height: 60px;
  padding: 0 18px;
  border-bottom: 1px solid rgba(224, 229, 240, 0.72);
  color: #657188;
  font-size: 12px;
  font-weight: 850;
}

.condition-row:last-child {
  border-bottom: none;
}

.name-cell {
  display: grid;
  gap: 3px;
}

.name-cell strong {
  color: #4f5a72;
  font-size: 13px;
  font-weight: 900;
}

.name-cell small {
  color: #a0aabd;
  font-size: 12px;
  font-weight: 800;
}

.type-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.tone-resolution,
.tone-ratio {
  border-color: rgba(235, 174, 120, 0.32);
  background: rgba(255, 242, 232, 0.86);
  color: #d48652;
}

.tone-path {
  border-color: rgba(154, 129, 245, 0.28);
  background: rgba(245, 242, 255, 0.86);
  color: #8c74eb;
}

.tone-include {
  border-color: rgba(235, 174, 120, 0.32);
  background: rgba(255, 242, 232, 0.86);
  color: #c98654;
}

.tone-plugin {
  border-color: rgba(130, 203, 237, 0.28);
  background: rgba(239, 250, 255, 0.86);
  color: #4aa4d0;
}

.summary-cell {
  min-width: 0;
  overflow: hidden;
  color: #8792a8;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #a5adbd;
  font-size: 13px;
  font-weight: 900;
}

.status-dot i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c7cedb;
}

.status-dot.enabled {
  color: #41be85;
}

.status-dot.enabled i {
  background: #45c58a;
}

.pink-toggle input {
  display: none;
}

.pink-toggle i {
  position: relative;
  display: block;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: #d8ddea;
  cursor: pointer;
  transition: background 0.16s ease;
}

.pink-toggle i::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 6px rgba(75, 86, 110, 0.25);
  transition: transform 0.16s ease;
}

.pink-toggle input:checked + i {
  background: #ff6f9d;
}

.pink-toggle input:checked + i::after {
  transform: translateX(16px);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-btn {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  cursor: pointer;
}

.icon-btn img {
  width: 15px;
  height: 15px;
  object-fit: contain;
}

.icon-btn.edit {
  border: 1px solid rgba(156, 125, 245, 0.24);
  background: rgba(246, 242, 255, 0.9);
}

.icon-btn.enable {
  border: 1px solid rgba(72, 207, 174, 0.24);
  background: rgba(235, 252, 247, 0.9);
}

.icon-btn.delete {
  border: 1px solid rgba(255, 111, 157, 0.24);
  background: rgba(255, 241, 246, 0.9);
}

.empty-row {
  min-height: 160px;
  display: grid;
  place-items: center;
  color: #99a4b8;
  font-size: 13px;
  font-weight: 900;
}

.condition-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding-top: 14px;
  color: #8792a8;
  font-size: 13px;
  font-weight: 900;
}

.pager-buttons {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.pager-buttons button {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(224, 229, 240, 0.84);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.62);
  color: #94a0b5;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
}

.pager-buttons button.current {
  border-color: rgba(255, 111, 157, 0.5);
  background: rgba(255, 241, 247, 0.86);
  color: #ff6f9d;
}

.pager-buttons button:disabled {
  opacity: 0.48;
  cursor: default;
}

.pager-buttons img {
  width: 16px;
  height: 16px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 320;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(52, 60, 78, 0.22);
  backdrop-filter: blur(10px);
}

.condition-modal {
  width: min(720px, 100%);
  padding: 22px;
  border: 1px solid rgba(224, 229, 240, 0.78);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 26px 70px rgba(69, 78, 102, 0.18);
  backdrop-filter: blur(22px);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 24px;
}

.modal-header h2 {
  margin: 0;
  color: #303a51;
  font-size: 22px;
  font-weight: 900;
}

.modal-close {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: #8893a8;
  font-size: 30px;
  line-height: 1;
  cursor: pointer;
}

.modal-form {
  display: grid;
  gap: 17px;
}

.form-line,
.check-group {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  align-items: start;
  gap: 20px;
  color: #5f6b82;
  font-size: 14px;
  font-weight: 900;
}

.form-line input,
.form-line select {
  width: 100%;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid rgba(218, 224, 238, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: #66728a;
  font-size: 14px;
  font-weight: 850;
  outline: none;
}

.form-line select {
  appearance: none;
  padding-right: 36px;
  background-image: url('/icons/nav/chevron-down-64x64.png');
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 14px 14px;
}

.form-line small {
  grid-column: 2;
  margin-top: -10px;
  color: #a2abbd;
  font-size: 12px;
  font-weight: 850;
}

.checkbox-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px 26px;
}

.soft-check {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #7c879d;
  font-size: 14px;
  font-weight: 900;
}

.soft-check input {
  display: none;
}

.soft-check i {
  position: relative;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  border: 2px solid rgba(202, 211, 226, 0.9);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.74);
}

.soft-check input:checked + i {
  border-color: #ff6f9d;
  background: #ff6f9d;
}

.soft-check input:checked + i::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 6px;
  height: 11px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 14px;
  margin-top: 28px;
}

.cancel-btn,
.save-btn {
  min-width: 150px;
  min-height: 42px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 900;
  cursor: pointer;
}

.cancel-btn {
  border: 1px solid rgba(224, 229, 240, 0.88);
  background: rgba(255, 255, 255, 0.72);
  color: #717c91;
}

.save-btn {
  border: 1px solid rgba(255, 255, 255, 0.46);
  background: linear-gradient(90deg, #ff6b9e, #ff77aa);
  color: white;
  box-shadow: 0 12px 26px rgba(255, 108, 158, 0.2);
}

@media (max-width: 1100px) {
  .conditions-layout {
    grid-template-columns: 1fr;
  }

  .conditions-header {
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-start;
    padding-top: 0;
  }

  .table-head,
  .condition-row {
    grid-template-columns: 1.1fr 0.82fr 1.3fr 0.72fr 0.72fr 0.88fr;
    gap: 12px;
  }
}
</style>
