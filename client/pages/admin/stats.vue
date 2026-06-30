<template>
  <div class="ops-page">
    <section class="ops-stats-row" aria-label="运维统计">
      <article v-for="card in statCards" :key="card.key" class="ops-stat-card" :class="card.tone">
        <div>
          <span class="stat-label">{{ card.label }}</span>
          <strong>{{ formatNumber(card.value) }}</strong>
          <small>较昨日 <b>{{ formatChange(card.change) }}</b></small>
        </div>
        <div class="stat-icon"><img :src="card.icon" alt="" /></div>
      </article>
    </section>

    <section class="monitor-grid">
      <article class="ops-card chart-card">
        <div class="card-title-row">
          <h2>API 调用量（近 30 天）</h2>
          <select v-model="chartRange" class="range-select" @change="loadOpsData">
            <option value="30">近 30 天</option>
          </select>
        </div>
        <div class="line-chart">
          <div class="y-axis">
            <span>15k</span><span>12k</span><span>9k</span><span>6k</span><span>3k</span><span>0</span>
          </div>
          <svg viewBox="0 0 640 260" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="opsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#ff7dac" stop-opacity="0.26" />
                <stop offset="100%" stop-color="#ff7dac" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            <g class="grid-lines">
              <line v-for="y in [24, 66, 108, 150, 192, 234]" :key="y" x1="0" :y1="y" x2="640" :y2="y" />
            </g>
            <path class="area-path" :d="apiAreaPath" />
            <polyline class="line-path" :points="apiLinePoints" />
          </svg>
          <div class="x-axis">
            <span v-for="label in chartLabels" :key="label">{{ label }}</span>
          </div>
        </div>
      </article>

      <article class="ops-card hot-card">
        <h2>热门图片 Top 10</h2>
        <div class="hot-list">
          <div v-for="img in topImages" :key="img.id" class="hot-row">
            <img :src="assetUrl(img.thumb_url || img.medium_url || img.url)" :alt="img.filename" />
            <span>{{ img.filename }}</span>
            <em>◎ {{ formatCompact(img.view_count) }}</em>
            <em class="likes">♡ {{ formatCompact(img.like_count) }}</em>
          </div>
          <div v-if="!topImages.length" class="mini-empty">暂无热门图片</div>
        </div>
        <NuxtLink to="/admin/images" class="rank-link">查看全部排行 →</NuxtLink>
      </article>

      <article class="ops-card empty-card">
        <div class="empty-illustration">
          <div class="folder-icon"></div>
        </div>
        <strong>暂无数据</strong>
        <span>当前条件下暂无相关数据</span>
        <button class="ghost-btn" @click="refreshAll">刷新</button>
      </article>
    </section>

    <section class="bottom-ops-grid">
      <article class="ops-card backup-card">
        <h2>备份与恢复</h2>
        <div class="backup-top-grid">
          <div class="inner-panel backup-options">
            <h3>备份内容</h3>
            <label v-for="item in backupItems" :key="item.key" class="check-line" :class="{ disabled: isDatabaseLinked(item.model) }">
              <input
                type="checkbox"
                :checked="backupOptions[item.model]"
                :disabled="isDatabaseLinked(item.model)"
                @change="toggleBackupOption(item.model, $event.target.checked)"
              />
              <span>{{ item.label }}</span>
            </label>
          </div>

          <div class="inner-panel create-panel">
            <h3>创建备份</h3>
            <button class="primary-btn" :disabled="backupLoading" @click="createBackup">
              {{ backupLoading ? '备份中...' : '创建备份' }}
            </button>
            <div v-if="backupLoading || backupProgress.percent" class="progress-block">
              <div class="progress-copy"><b>{{ backupProgress.label }}</b><span>{{ backupProgress.percent }}%</span></div>
              <div class="progress-track"><i :style="{ width: backupProgress.percent + '%' }"></i></div>
              <small>{{ backupProgress.step }}</small>
            </div>
          </div>

          <div class="inner-panel result-panel">
            <h3>备份结果</h3>
            <div v-if="backupResult" class="result-box" :class="backupResult.success ? 'success' : 'error'">
              <div class="result-title">
                <img :src="backupResult.success ? '/icons/admin/status-ok-placeholder.svg' : '/icons/admin/status-error-placeholder.svg'" alt="" />
                <b>{{ backupResult.success ? '备份创建成功' : '备份创建失败' }}</b>
              </div>
              <p>{{ backupResult.message }}</p>
            </div>
            <ul v-if="backupResult?.warnings?.length" class="result-warnings">
              <li v-for="warning in backupResult.warnings" :key="warning">{{ warning }}</li>
            </ul>
            <dl v-if="backupResult?.success && backupResult.filename" class="result-meta">
              <dt>文件名：</dt><dd>{{ backupResult.filename }}</dd>
              <dt>大小：</dt><dd>{{ formatSize(backupResult.size) }}</dd>
              <dt>耗时：</dt><dd>{{ formatDuration(backupResult.duration_ms) }}</dd>
            </dl>
          </div>
        </div>

        <div class="backup-table-panel">
          <h3>备份列表</h3>
          <div class="backup-table" :class="{ expanded: showAllBackups }">
            <div class="backup-head"><span>文件名</span><span>大小</span><span>创建时间</span><span>操作</span></div>
            <div v-for="backup in visibleBackups" :key="backup.filename" class="backup-row">
              <span>{{ backup.filename }}</span>
              <span>{{ formatSize(backup.size) }}</span>
              <span>{{ formatDateTime(backup.created_at) }}</span>
              <span class="row-actions">
                <button class="restore-btn" @click="openRestoreDialog(backup)">恢复</button>
                <button class="delete-btn" @click="deleteBackup(backup)">删除</button>
              </span>
            </div>
            <div v-if="!backups.length" class="empty-line">暂无备份</div>
          </div>
          <button v-if="backups.length > 3" class="all-link" type="button" @click="showAllBackups = !showAllBackups">
            {{ showAllBackups ? '收起备份列表 ↑' : '查看全部备份 →' }}
          </button>
        </div>
      </article>

      <article class="ops-card webdav-card">
        <div class="card-title-row webdav-title">
          <h2>云同步（WebDAV）</h2>
          <label class="switch-line"><span>启用云同步</span><input v-model="webdav.configured" type="checkbox" /><i></i></label>
        </div>

        <div class="webdav-main">
          <div class="connection-panel">
            <h3>连接配置</h3>
            <label><span>服务器地址</span><input v-model="webdav.url" placeholder="https://dav.example.com/dav" /></label>
            <label><span>用户名</span><input v-model="webdav.username" placeholder="taotu_admin" /></label>
            <label class="password-line">
              <span>密码</span>
              <input v-model="webdav.password" :type="showPassword ? 'text' : 'password'" placeholder="••••••••••••••" />
              <button type="button" @click="showPassword = !showPassword">◎</button>
            </label>
            <label><span>远程路径</span><input v-model="webdav.remotePath" placeholder="/taotu-backup" /></label>
            <div class="webdav-actions">
              <button class="primary-btn" @click="saveWebdav">保存配置</button>
              <button class="outline-btn" :disabled="testing" @click="testWebdav">{{ testing ? '测试中...' : '测试连接' }}</button>
              <button class="outline-btn" :disabled="syncing" @click="runSync">立即同步</button>
              <button class="muted-btn" :disabled="testing || syncing"><span class="spinner"></span>{{ testing ? '测试中...' : syncing ? '同步中...' : '待命' }}</button>
            </div>
          </div>

          <div class="sync-note-panel">
            <h3>可同步内容说明</h3>
            <p>开启云同步后，以下内容将自动同步到远程服务器：</p>
            <ul>
              <li>标签数据（包含标签分类与关联）</li>
              <li>图片路径配置（存储映射关系）</li>
              <li>条件与筛选配置（搜索条件等）</li>
              <li>网站配置（站点设置与主题等）</li>
            </ul>
            <small>注意：图片文件本身不会同步，仅同步配置与索引数据。</small>
          </div>
        </div>

        <div class="sync-status" :class="syncStatus.success ? 'success' : 'error'">
          <img :src="syncStatus.success ? '/icons/admin/status-ok-placeholder.svg' : '/icons/admin/status-error-placeholder.svg'" alt="" />
          <div><b>{{ syncStatus.success ? '同步成功' : (syncStatus.message === '尚未同步' ? '尚未同步' : '同步失败') }}</b><span>{{ syncStatus.updatedAt ? `最新同步于 ${formatDateTime(syncStatus.updatedAt)}` : syncStatus.message }}</span></div>
          <button type="button" @click="openSyncLogs">查看日志 →</button>
        </div>
      </article>
    </section>

    <div v-if="restoreDialog.open" class="modal-mask" @click.self="closeRestoreDialog">
      <div class="restore-modal">
        <h2>恢复备份</h2>
        <p class="modal-desc">恢复前请确认内容。数据库恢复会覆盖整站数据；本地图库只恢复图片文件，不恢复数据库记录、标签关系或配置内容。</p>
        <div class="restore-file">
          <b>{{ restoreDialog.filename }}</b>
          <span>{{ restoreDialog.createdAt ? formatDateTime(restoreDialog.createdAt) : '未知创建时间' }}</span>
        </div>
        <div class="restore-options">
          <label v-for="item in restoreDialog.items" :key="item.key" class="check-line">
            <input v-model="restoreDialog.selected" type="checkbox" :value="item.key" />
            <span>{{ item.label }}</span>
            <small>{{ item.description }}</small>
          </label>
        </div>
        <div class="risk-box">恢复是高风险操作，请确保当前数据已经备份。数据库项会恢复完整数据库，包含网站配置、条件配置、标签管理、图片元数据与关联关系。</div>
        <div class="modal-actions">
          <button class="ghost-btn" @click="closeRestoreDialog">取消</button>
          <button class="primary-btn" :disabled="restoreLoading || !restoreDialog.selected.length" @click="confirmRestore">{{ restoreLoading ? '恢复中...' : '确认恢复' }}</button>
        </div>
      </div>
    </div>

    <div v-if="syncLogDialog.open" class="modal-mask" @click.self="closeSyncLogs">
      <div class="restore-modal sync-log-modal">
        <h2>同步日志</h2>
        <p class="modal-desc">这里显示最近 20 次 WebDAV 测试连接和同步结果。</p>
        <div class="sync-log-list">
          <div v-for="log in syncLogDialog.logs" :key="`${log.type}-${log.updatedAt}`" class="sync-log-row" :class="log.success ? 'success' : 'error'">
            <span>{{ log.type === 'test' ? '测试连接' : '立即同步' }}</span>
            <b>{{ log.success ? '成功' : '失败' }}</b>
            <em>{{ formatDateTime(log.updatedAt) }}</em>
            <small>{{ log.message }}</small>
          </div>
          <div v-if="!syncLogDialog.logs.length" class="empty-line">暂无同步日志</div>
        </div>
        <div class="modal-actions">
          <button class="ghost-btn" @click="closeSyncLogs">关闭</button>
        </div>
      </div>
    </div>

    <ConfirmDeleteDialog
      :show="deleteDialog.show"
      title="确认删除备份"
      :message="deleteDialog.message"
      :effects="deleteDialog.effects"
      :loading="deleteDialog.loading"
      @confirm="confirmDeleteBackup"
      @cancel="closeDeleteDialog"
    />
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const config = useRuntimeConfig()
const chartRange = ref('30')
const opsData = ref({ cards: {}, apiTrend: { labels: [], values: [] }, topImages: [] })
const backups = ref([])
const showAllBackups = ref(false)
const backupLoading = ref(false)
const backupResult = ref(null)
const backupProgress = reactive({ percent: 0, label: '', step: '' })
const showPassword = ref(false)
const testing = ref(false)
const syncing = ref(false)
const restoreLoading = ref(false)
const syncStatus = ref({ success: false, message: '尚未同步', updatedAt: null })
const webdav = reactive({ configured: false, url: '', username: '', password: '', remotePath: '/gallery-sync/' })
const restoreDialog = reactive({ open: false, filename: '', createdAt: null, items: [], selected: [] })
const syncLogDialog = reactive({ open: false, logs: [] })
const deleteDialog = reactive({ show: false, payload: null, message: '', effects: [], loading: false })
const backupOptions = reactive({ includeDatabase: true, includeGallery: true, includeTags: true, includeConditions: true, includeSiteConfig: true })

const backupItems = [
  { key: 'database', label: '数据库', model: 'includeDatabase' },
  { key: 'gallery', label: '本地图库', model: 'includeGallery' },
  { key: 'tags', label: '标签文件', model: 'includeTags' },
  { key: 'conditions', label: '条件配置', model: 'includeConditions' },
  { key: 'siteConfig', label: '网站配置', model: 'includeSiteConfig' }
]

const statDefinitions = [
  { key: 'totalImages', label: '总图片', icon: '/icons/admin/image-management-64x64.png', tone: 'pink' },
  { key: 'totalAlbums', label: '总相册', icon: '/icons/admin/album-management-64x64.png', tone: 'blue' },
  { key: 'totalUsers', label: '总用户', icon: '/icons/admin/users-64x64.png', tone: 'green' },
  { key: 'todayApiCalls', label: '今日 API 调用', icon: '/icons/admin/api-settings-64x64.png', tone: 'purple' },
  { key: 'todayUploads', label: '今日上传', icon: '/icons/admin/cloud-sync-64x64.png', tone: 'rose' }
]

const statCards = computed(() => statDefinitions.map((item) => ({ ...item, ...(opsData.value.cards?.[item.key] || { value: 0, change: 0 }) })))
const topImages = computed(() => opsData.value.topImages || [])
const visibleBackups = computed(() => showAllBackups.value ? backups.value : backups.value.slice(0, 3))
const chartLabels = computed(() => {
  const labels = opsData.value.apiTrend?.labels || []
  if (labels.length <= 8) return labels
  return labels.filter((_, index) => index % 4 === 0 || index === labels.length - 1)
})
const apiLinePoints = computed(() => buildLinePoints(opsData.value.apiTrend?.values || []))
const apiAreaPath = computed(() => {
  const points = apiLinePoints.value
  if (!points) return ''
  return `M ${points} L 640 240 L 0 240 Z`
})

function buildLinePoints(values) {
  const list = values.length ? values.map(v => Number(v || 0)) : Array.from({ length: 30 }, () => 0)
  const max = Math.max(...list, 1)
  return list.map((value, index) => {
    const x = (index / Math.max(1, list.length - 1)) * 640
    const y = 236 - (value / max) * 210
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

const assetUrl = (url) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${config.public.apiBase || ''}${url}`
}
const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value || 0))
const formatChange = (value) => `${Number(value || 0) >= 0 ? '+' : '-'}${formatNumber(Math.abs(Number(value || 0)))}`
const formatCompact = (value) => {
  const num = Number(value || 0)
  if (num >= 10000) return `${(num / 10000).toFixed(1)}w`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
  return String(num)
}
const formatSize = (bytes = 0) => {
  const value = Number(bytes || 0)
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`
}
const formatDuration = (ms = 0) => {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000))
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `00:${mm}:${ss}`
}
const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

const isDatabaseLinked = (model) => backupOptions.includeDatabase && ['includeTags', 'includeConditions', 'includeSiteConfig'].includes(model)
function toggleBackupOption(model, checked) {
  backupOptions[model] = checked
  if (model === 'includeDatabase' && checked) {
    backupOptions.includeTags = true
    backupOptions.includeConditions = true
    backupOptions.includeSiteConfig = true
  }
}

async function loadOpsData() {
  opsData.value = await api.get('/api/admin/stats/ops')
}
async function loadBackups() {
  const data = await api.get('/api/admin/backup/list')
  backups.value = data.backups || []
}
async function loadWebdav() {
  const [cfg, status] = await Promise.all([
    api.get('/api/admin/cloud-sync/config'),
    api.get('/api/admin/cloud-sync/status').catch(() => ({ success: false, message: '尚未同步', updatedAt: null }))
  ])
  Object.assign(webdav, { configured: Boolean(cfg.configured), url: cfg.url || '', username: cfg.username || '', password: '', remotePath: cfg.remotePath || '/gallery-sync/' })
  syncStatus.value = status
}
async function refreshAll() {
  await Promise.all([loadOpsData(), loadBackups(), loadWebdav()])
}

async function createBackup() {
  backupLoading.value = true
  backupResult.value = null
  backupProgress.percent = 18
  backupProgress.label = '备份中...'
  backupProgress.step = '正在准备备份包...'
  const started = Date.now()
  try {
    window.setTimeout(() => { if (backupLoading.value) { backupProgress.percent = 45; backupProgress.step = '正在备份数据库...' } }, 300)
    window.setTimeout(() => { if (backupLoading.value) { backupProgress.percent = 72; backupProgress.step = '正在写入图片文件...' } }, 900)
    const result = await api.post('/api/admin/backup', backupOptions)
    backupProgress.percent = 100
    backupProgress.step = '备份文件已保存。'
    backupResult.value = { success: true, message: '备份文件已创建并保存到本地。', duration_ms: result.duration_ms || Date.now() - started, ...result }
    await loadBackups()
  } catch (err) {
    backupResult.value = { success: false, message: err?.data?.error || err.message || '备份失败' }
  } finally {
    backupLoading.value = false
  }
}

async function openRestoreDialog(backup) {
  const data = await api.get(`/api/admin/restore/inspect/${encodeURIComponent(backup.filename)}`)
  restoreDialog.open = true
  restoreDialog.filename = backup.filename
  restoreDialog.createdAt = data.created_at || backup.created_at
  restoreDialog.items = data.restorableItems || []
  restoreDialog.selected = restoreDialog.items.map(item => item.key)
}
function closeRestoreDialog() {
  restoreDialog.open = false
  restoreDialog.filename = ''
  restoreDialog.items = []
  restoreDialog.selected = []
}
async function confirmRestore() {
  restoreLoading.value = true
  try {
    await api.post('/api/admin/restore', { filename: restoreDialog.filename, options: { restoreItems: restoreDialog.selected } })
    closeRestoreDialog()
    backupResult.value = { success: true, message: '恢复完成。建议刷新页面并验证图片路径。' }
  } catch (err) {
    backupResult.value = { success: false, message: err?.data?.error || err.message || '恢复失败' }
  } finally {
    restoreLoading.value = false
  }
}
async function deleteBackup(backup) {
  deleteDialog.show = true
  deleteDialog.payload = backup
  deleteDialog.message = `删除备份 "${backup.filename}"？`
  deleteDialog.effects = ['备份文件会被删除', '删除后无法再用该备份恢复']
}

function closeDeleteDialog() {
  if (deleteDialog.loading) return
  deleteDialog.show = false
  deleteDialog.payload = null
  deleteDialog.effects = []
}

async function confirmDeleteBackup() {
  if (!deleteDialog.payload || deleteDialog.loading) return
  deleteDialog.loading = true
  const backup = deleteDialog.payload
  await api.del(`/api/admin/backup/${encodeURIComponent(backup.filename)}`)
  await loadBackups()
  deleteDialog.loading = false
  closeDeleteDialog()
}

async function saveWebdav() {
  await api.put('/api/admin/cloud-sync/config', { ...webdav, configured: webdav.configured })
  await loadWebdav()
}
async function testWebdav() {
  testing.value = true
  try {
    syncStatus.value = await api.post('/api/admin/cloud-sync/test')
  } finally {
    testing.value = false
  }
}
async function runSync() {
  syncing.value = true
  try {
    syncStatus.value = await api.post('/api/admin/cloud-sync/run')
  } finally {
    syncing.value = false
  }
}

async function openSyncLogs() {
  const data = await api.get('/api/admin/cloud-sync/logs')
  syncLogDialog.logs = data.logs || []
  syncLogDialog.open = true
}
function closeSyncLogs() {
  syncLogDialog.open = false
  syncLogDialog.logs = []
}

onMounted(refreshAll)
</script>

<style scoped>
.ops-page { display: flex; flex-direction: column; gap: 20px; color: #5c6982; }
.ops-page::before { content: ''; position: fixed; inset: 64px 0 0 220px; z-index: -1; pointer-events: none; background: linear-gradient(180deg, rgba(248, 251, 255, 0.9), rgba(255, 248, 252, 0.72) 48%, rgba(245, 251, 255, 0.92)); }
.ops-stats-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 18px; }
.ops-stat-card, .ops-card, .inner-panel, .backup-table-panel, .restore-modal { border: 1px solid rgba(224, 229, 240, 0.72); background: rgba(255, 255, 255, 0.66); box-shadow: 0 16px 38px rgba(79, 92, 124, 0.08); backdrop-filter: blur(22px) saturate(1.08); }
.ops-stat-card { min-height: 104px; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 18px 16px; border-radius: 12px; }
.stat-label { display: block; margin-bottom: 7px; color: #8490a8; font-size: 13px; font-weight: 900; }
.ops-stat-card strong { display: block; color: #26324a; font-size: 27px; line-height: 1.05; font-weight: 900; }
.ops-stat-card small { display: block; margin-top: 8px; color: #8792a9; font-size: 13px; font-weight: 800; }
.ops-stat-card small b { color: #ff6f9d; font-weight: 900; }
.stat-icon { width: 54px; height: 54px; display: grid; place-items: center; flex: 0 0 auto; border-radius: 50%; background: var(--soft); }
.stat-icon img { width: 30px; height: 30px; object-fit: contain; }
.ops-stat-card.pink { --soft: #f2e5ff; } .ops-stat-card.blue { --soft: #edf4ff; } .ops-stat-card.green { --soft: #e5f8f2; } .ops-stat-card.purple { --soft: #f3e9ff; } .ops-stat-card.rose { --soft: #ffe8f1; }
.monitor-grid { display: grid; grid-template-columns: 2fr 1fr 2.1fr; gap: 18px; }
.ops-card { border-radius: 13px; padding: 18px; }
.card-title-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
h2 { margin: 0; color: #3d4860; font-size: 18px; line-height: 1.2; font-weight: 900; } h3 { margin: 0 0 14px; color: #56627a; font-size: 14px; font-weight: 900; }
.range-select { height: 34px; padding: 0 12px; border: 1px solid rgba(220, 226, 238, 0.9); border-radius: 8px; background: rgba(255,255,255,0.72); color: #7c879c; font-weight: 800; }
.chart-card, .hot-card, .empty-card { min-height: 256px; }
.line-chart { position: relative; min-height: 218px; margin-top: 12px; padding: 4px 0 22px 34px; }
.line-chart svg { width: 100%; height: 190px; display: block; overflow: visible; }
.grid-lines line { stroke: rgba(220, 226, 238, 0.88); stroke-width: 1; } .area-path { fill: url(#opsAreaGradient); } .line-path { fill: none; stroke: #ff78a7; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.y-axis { position: absolute; left: 0; top: 2px; height: 198px; display: flex; flex-direction: column; justify-content: space-between; color: #a0aabc; font-size: 12px; font-weight: 800; }
.x-axis { display: flex; justify-content: space-between; padding-top: 5px; color: #98a2b5; font-size: 12px; font-weight: 800; }
.hot-list { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.hot-row { display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px 42px; align-items: center; gap: 8px; min-height: 30px; }
.hot-row img { width: 42px; height: 28px; border-radius: 5px; object-fit: cover; background: #f4f6fb; }
.hot-row span { overflow: hidden; color: #5d6880; font-size: 12px; font-weight: 900; text-overflow: ellipsis; white-space: nowrap; }
.hot-row em { color: #8d98ad; font-size: 11px; font-style: normal; font-weight: 800; text-align: right; white-space: nowrap; } .hot-row .likes { color: #ff77a5; }
.rank-link, .all-link { min-height: 36px; display: flex; align-items: center; justify-content: center; width: 100%; margin-top: 12px; border: 1px solid rgba(224, 229, 240, 0.78); border-radius: 8px; background: rgba(255,255,255,0.48); color: #9b7cf4; font-size: 13px; font-weight: 900; text-decoration: none; cursor: pointer; }
.empty-card { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.empty-illustration { position: relative; width: 118px; height: 86px; margin-bottom: 14px; opacity: 0.82; }
.folder-icon { position: absolute; inset: 22px 16px 10px; border-radius: 13px; background: linear-gradient(180deg, #ffc2d8, #ffdce9); box-shadow: 0 14px 30px rgba(255, 126, 170, 0.18); }
.folder-icon::before { content: ''; position: absolute; top: -14px; left: 14px; width: 48px; height: 22px; border-radius: 12px 12px 4px 4px; background: #ffc2d8; }
.empty-card strong { color: #9aa4b7; font-size: 16px; font-weight: 900; } .empty-card span { margin: 8px 0 16px; color: #aab3c3; font-size: 13px; font-weight: 800; }
.ghost-btn { min-height: 34px; padding: 0 24px; border: 1px solid rgba(220, 226, 238, 0.82); border-radius: 8px; background: rgba(255,255,255,0.58); color: #9b7cf4; font-weight: 900; cursor: pointer; }
.bottom-ops-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: stretch; }
.backup-card, .webdav-card { min-height: 430px; }
.backup-top-grid { display: grid; grid-template-columns: 0.78fr 1fr 1.5fr; gap: 14px; margin-top: 16px; }
.inner-panel { min-height: 148px; padding: 14px; border-radius: 8px; }
.check-line { display: flex; align-items: center; gap: 8px; min-height: 25px; color: #67728a; font-size: 13px; font-weight: 900; }
.check-line input { width: 14px; height: 14px; accent-color: #ff6f9d; } .check-line.disabled { opacity: 0.78; }
.create-panel .primary-btn { width: 100%; margin: 7px 0 16px; }
.primary-btn, .outline-btn, .muted-btn { min-height: 38px; padding: 0 20px; border-radius: 8px; font-size: 13px; font-weight: 900; cursor: pointer; }
.primary-btn { border: none; background: linear-gradient(90deg, #ff6b9e, #ff77aa); color: white; box-shadow: 0 10px 22px rgba(255, 108, 158, 0.2); }
.outline-btn { border: 1px solid rgba(255, 111, 157, 0.45); background: rgba(255,255,255,0.62); color: #ff6f9d; }
.muted-btn { border: 1px solid rgba(220, 226, 238, 0.86); background: rgba(255,255,255,0.52); color: #9fa8ba; } button:disabled { opacity: 0.68; cursor: default; }
.progress-copy { display: flex; justify-content: space-between; color: #7d86f2; font-size: 13px; font-weight: 900; }
.progress-track { height: 5px; margin: 9px 0; border-radius: 999px; background: #efeefb; overflow: hidden; } .progress-track i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #ff78a8, #7d86f2); }
.progress-block small { color: #a3acbd; font-weight: 800; }
.result-box { padding: 12px; border-radius: 8px; border: 1px solid; } .result-box.success { background: rgba(229, 255, 247, 0.72); border-color: rgba(65, 196, 156, 0.32); color: #34b88c; } .result-box.error { background: rgba(255, 239, 244, 0.72); border-color: rgba(240, 95, 120, 0.32); color: #df5f78; }
.result-title { display: flex; align-items: center; gap: 8px; font-weight: 900; } .result-title img { width: 18px; height: 18px; } .result-box p { margin: 5px 0 0 26px; color: #99a4b7; font-size: 12px; font-weight: 800; }
.result-warnings { display: grid; gap: 6px; margin: 10px 0 0; padding: 10px 12px 10px 28px; border: 1px solid rgba(245, 177, 77, 0.32); border-radius: 8px; background: rgba(255, 249, 232, 0.76); color: #b47a20; font-size: 12px; font-weight: 900; line-height: 1.55; }
.result-meta { display: grid; grid-template-columns: 56px 1fr; gap: 8px; margin: 14px 0 0; color: #8792a7; font-size: 13px; font-weight: 800; } .result-meta dd { margin: 0; color: #6b768e; }
.backup-table-panel { margin-top: 14px; padding: 14px; border-radius: 8px; }
.backup-table { max-height: 142px; border: 1px solid rgba(224, 229, 240, 0.78); border-radius: 8px; overflow: hidden; }
.backup-table.expanded { max-height: 260px; overflow-y: auto; }
.backup-head, .backup-row { display: grid; grid-template-columns: minmax(0, 1.5fr) 120px 180px 110px; align-items: center; min-height: 35px; padding: 0 12px; border-bottom: 1px solid rgba(224, 229, 240, 0.72); color: #8792a6; font-size: 12px; font-weight: 900; }
.backup-row:last-child { border-bottom: none; } .backup-row span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-actions { display: flex; gap: 8px; justify-content: flex-end; }
.restore-btn, .delete-btn { min-height: 26px; padding: 0 11px; border-radius: 6px; font-size: 12px; font-weight: 900; cursor: pointer; }
.restore-btn { border: 1px solid rgba(155, 124, 244, 0.28); background: rgba(244, 239, 255, 0.82); color: #8c72df; } .delete-btn { border: 1px solid rgba(255, 111, 157, 0.28); background: rgba(255, 240, 246, 0.82); color: #ff6f9d; }
.empty-line, .mini-empty { padding: 18px; text-align: center; color: #a0aabc; font-weight: 800; }
.webdav-title { padding-bottom: 13px; border-bottom: 1px solid rgba(224, 229, 240, 0.72); }
.switch-line { display: flex; align-items: center; gap: 8px; color: #66728a; font-size: 13px; font-weight: 900; } .switch-line input { display: none; }
.switch-line i { position: relative; width: 38px; height: 20px; border-radius: 999px; background: #dbe1ef; } .switch-line i::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: white; box-shadow: 0 2px 6px rgba(75, 86, 110, 0.25); transition: transform 0.18s ease; }
.switch-line input:checked + i { background: #8c7cf3; } .switch-line input:checked + i::after { transform: translateX(18px); }
.webdav-main { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); gap: 18px; padding: 18px 0 14px; }
.connection-panel label { display: grid; grid-template-columns: 88px minmax(0, 1fr); align-items: center; gap: 10px; margin-bottom: 10px; color: #6d7890; font-size: 13px; font-weight: 900; }
.connection-panel input { min-height: 34px; padding: 0 12px; border: 1px solid rgba(220, 226, 238, 0.86); border-radius: 8px; background: rgba(255,255,255,0.58); color: #6d7890; outline: none; }
.password-line { position: relative; } .password-line button { position: absolute; right: 8px; width: 26px; height: 26px; border: none; background: transparent; color: #9ca6b8; cursor: pointer; }
.webdav-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 13px; }
.spinner { width: 14px; height: 14px; display: inline-block; margin-right: 8px; border: 2px solid #d9dcff; border-top-color: #8c7cf3; border-radius: 50%; vertical-align: -2px; }
.sync-note-panel { padding: 18px; border: 1px solid rgba(230, 220, 248, 0.88); border-radius: 8px; background: rgba(250, 247, 255, 0.72); }
.sync-note-panel p, .sync-note-panel small { color: #95a0b4; font-size: 12px; font-weight: 800; line-height: 1.8; }
.sync-note-panel ul { display: grid; gap: 10px; margin: 12px 0; padding: 0; list-style: none; } .sync-note-panel li { color: #66728a; font-size: 13px; font-weight: 900; }
.sync-note-panel li::before { content: '✓'; display: inline-grid; place-items: center; width: 18px; height: 18px; margin-right: 8px; border-radius: 50%; background: #ffe1ec; color: #ff6f9d; font-size: 11px; }
.sync-status { min-height: 58px; display: grid; grid-template-columns: 24px minmax(0, 1fr) 112px; align-items: center; gap: 12px; padding: 10px 14px; border: 1px solid; border-radius: 8px; }
.sync-status.success { border-color: rgba(61, 196, 156, 0.3); background: rgba(229, 255, 247, 0.72); color: #34b88c; } .sync-status.error { border-color: rgba(240, 95, 120, 0.28); background: rgba(255, 242, 246, 0.72); color: #df5f78; }
.sync-status img { width: 18px; height: 18px; } .sync-status b { display: block; font-size: 14px; font-weight: 900; } .sync-status span { color: #8190a8; font-size: 12px; font-weight: 800; } .sync-status button { border: none; background: transparent; color: #8c72df; font-size: 13px; font-weight: 900; text-decoration: none; text-align: right; cursor: pointer; }
.modal-mask { position: fixed; inset: 0; z-index: 300; display: grid; place-items: center; padding: 24px; background: rgba(52, 60, 78, 0.24); backdrop-filter: blur(10px); }
.restore-modal { width: min(620px, 100%); padding: 22px; border-radius: 14px; } .restore-modal h2 { margin-bottom: 10px; }
.modal-desc { color: #7b879d; font-size: 13px; font-weight: 800; line-height: 1.7; }
.restore-file { display: flex; justify-content: space-between; gap: 16px; margin: 14px 0; padding: 12px; border: 1px solid rgba(224, 229, 240, 0.78); border-radius: 8px; color: #63708a; font-size: 13px; font-weight: 900; }
.restore-options { display: grid; gap: 8px; } .restore-options .check-line { display: grid; grid-template-columns: 18px 90px minmax(0, 1fr); align-items: center; } .restore-options small { color: #9ba5b6; font-weight: 800; }
.risk-box { margin-top: 14px; padding: 12px; border: 1px solid rgba(255, 111, 157, 0.22); border-radius: 8px; background: rgba(255, 240, 246, 0.66); color: #d8688a; font-size: 13px; font-weight: 900; line-height: 1.7; }
.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 18px; }
.sync-log-list { display: grid; gap: 9px; max-height: 360px; overflow-y: auto; margin-top: 14px; }
.sync-log-row { display: grid; grid-template-columns: 82px 48px 148px minmax(0, 1fr); align-items: center; gap: 10px; min-height: 42px; padding: 10px 12px; border: 1px solid rgba(224, 229, 240, 0.74); border-radius: 8px; background: rgba(255,255,255,0.58); color: #6a758e; font-size: 12px; font-weight: 900; }
.sync-log-row.success b { color: #34b88c; } .sync-log-row.error b { color: #df5f78; }
.sync-log-row em { color: #98a3b7; font-style: normal; } .sync-log-row small { overflow: hidden; color: #7c879d; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 1380px) { .ops-stats-row { gap: 12px; } .ops-stat-card { padding: 16px 14px; } .ops-stat-card strong { font-size: 23px; } .monitor-grid { grid-template-columns: 1.7fr 0.95fr 1.6fr; } .backup-head, .backup-row { grid-template-columns: minmax(0, 1.35fr) 100px 150px 104px; } }
@media (max-width: 1180px) { .ops-stats-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } .monitor-grid, .bottom-ops-grid, .webdav-main { grid-template-columns: 1fr; } }
</style>
