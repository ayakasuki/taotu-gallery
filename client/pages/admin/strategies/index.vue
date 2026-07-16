<template>
  <div class="strategies-page">
    <section class="strategy-card">
      <header class="strategy-header">
        <div><h1>存储策略</h1><p>为不同用户组绑定本地、对象存储或远程挂载配置。</p></div>
        <button type="button" class="primary-action" @click="navigateTo('/admin/strategies/create')"><TaotuIcon name="create-plus" />存储策略</button>
      </header>
      <div class="strategy-table">
        <div class="table-head"><span>ID</span><span>策略名称</span><span>挂载</span><span>用户组</span><span>图片数量</span><span>已使用存储</span><span>连接状态</span><span>操作</span></div>
        <div v-if="loading" class="empty-row">加载中...</div>
        <div v-else-if="strategies.length === 0" class="empty-row">暂无存储策略</div>
        <div v-for="item in strategies" v-else :key="item.id" class="table-row">
          <span>#{{ item.id }}</span>
          <strong>{{ item.name }}<i v-if="item.is_system_default">默认</i></strong>
          <span>{{ item.type_label }}</span>
          <span>{{ item.group_name || '-' }}</span>
          <span>{{ item.image_count || 0 }}</span>
          <span>{{ formatMb(item.used_storage) }} MB</span>
          <span class="status-cell" :class="statusInfo(item.id).status" :title="statusInfo(item.id).message">
            <span class="status-dot"></span>{{ statusInfo(item.id).label }}
          </span>
          <span class="actions">
            <button type="button" @click="navigateTo(`/admin/strategies/${item.id}`)">编辑</button>
            <button type="button" class="danger" :disabled="item.is_system_default" @click="openDeleteDialog(item)">删除</button>
          </span>
        </div>
      </div>
    </section>
    <ConfirmDeleteDialog
      :show="deleteDialog.show"
      title="删除存储策略"
      :message="deleteDialog.message"
      description="删除后该策略下的图片记录会从数据库移除，但不会直接删除挂载端原始文件。"
      :effects="deleteDialog.effects"
      :loading="deleteDialog.loading"
      @cancel="closeDeleteDialog"
      @confirm="confirmDeleteStrategy"
    />
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const strategies = ref([])
const loading = ref(false)
const statusMap = reactive({})
const deleteDialog = reactive({ show: false, target: null, message: '', effects: [], loading: false })
onMounted(loadStrategies)
async function loadStrategies() {
  loading.value = true
  try {
    strategies.value = (await api.get('/api/admin/strategies')).strategies || []
    strategies.value.forEach(item => { statusMap[item.id] = { status: 'checking', label: '连接中', message: '正在检测连接状态' } })
    checkStatuses()
  } finally { loading.value = false }
}
function formatMb(bytes) { return (Number(bytes || 0) / 1024 / 1024).toFixed(2) }
function statusInfo(id) {
  return statusMap[id] || { status: 'checking', label: '连接中', message: '等待检测连接状态' }
}
async function checkStatuses() {
  try {
    const data = await api.get('/api/admin/strategies/status')
    for (const item of data.statuses || []) {
      statusMap[item.id] = {
        status: item.status === 'normal' ? 'normal' : 'abnormal',
        label: item.status === 'normal' ? '正常' : '异常',
        message: item.message || (item.status === 'normal' ? '连接正常' : '连接异常')
      }
    }
  } catch (err) {
    strategies.value.forEach(item => {
      statusMap[item.id] = { status: 'abnormal', label: '异常', message: err.data?.error || err.message || '连接检测失败' }
    })
  }
}
function openDeleteDialog(item) {
  if (item.is_system_default) return
  deleteDialog.target = item
  deleteDialog.message = `确定删除存储策略「${item.name}」吗？`
  deleteDialog.effects = [
    `数据库中关联该策略的 ${item.image_count || 0} 条图片记录会被移除`,
    '挂载端原始文件不会被自动删除',
    '系统默认本地策略不可删除'
  ]
  deleteDialog.show = true
}
function closeDeleteDialog() {
  if (deleteDialog.loading) return
  Object.assign(deleteDialog, { show: false, target: null, message: '', effects: [], loading: false })
}
async function confirmDeleteStrategy() {
  if (!deleteDialog.target) return
  deleteDialog.loading = true
  try {
    await api.del(`/api/admin/strategies/${deleteDialog.target.id}`)
    Object.assign(deleteDialog, { show: false, target: null, message: '', effects: [], loading: false })
    await loadStrategies()
  } finally {
    deleteDialog.loading = false
  }
}
</script>

<style scoped>
.strategies-page { max-width: 1180px; margin: 0 auto; }
.strategy-card { padding: 24px; border: 1px solid rgba(234,224,236,.92); border-radius: 14px; background: rgba(255,255,255,.82); box-shadow: 0 24px 72px rgba(84,76,104,.14); backdrop-filter: blur(24px); }
.strategy-header { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.strategy-header h1 { margin: 0; color: #30384e; font-size: 22px; font-weight: 900; }
.strategy-header p { margin: 7px 0 0; color: #8b93a8; font-size: 13px; font-weight: 800; }
.primary-action { height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 16px; border: 0; border-radius: 8px; background: linear-gradient(135deg,#f76da1,#f35f98); color: #fff; cursor: pointer; font-weight: 900; box-shadow: 0 12px 24px rgba(242,96,151,.22); }
.strategy-table { overflow: hidden; border: 1px solid rgba(226,231,242,.78); border-radius: 10px; background: rgba(255,255,255,.68); }
.table-head, .table-row { display: grid; grid-template-columns: 70px minmax(160px,1fr) 110px minmax(120px,.7fr) 92px 120px 96px 150px; align-items: center; gap: 12px; padding: 0 16px; }
.table-head { height: 42px; background: rgba(247,249,253,.82); color: #7e879a; font-size: 12px; font-weight: 900; }
.table-row { min-height: 54px; border-top: 1px solid rgba(226,231,242,.74); color: #566077; font-size: 13px; font-weight: 850; }
.table-row strong { color: #323a50; }
.table-row i { margin-left: 7px; padding: 3px 6px; border-radius: 6px; background: rgba(255,239,246,.8); color: #f05f98; font-size: 11px; font-style: normal; }
.status-cell { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 900; white-space: nowrap; }
.status-dot { width: 9px; height: 9px; flex: 0 0 9px; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 15%, transparent); }
.status-cell.normal { color: #28be73; }
.status-cell.checking { color: #ff9f2f; }
.status-cell.abnormal { color: #ff4d68; }
.actions { display: flex; gap: 8px; }
.actions button { height: 30px; padding: 0 10px; border: 1px solid rgba(255,166,196,.48); border-radius: 7px; background: rgba(255,241,247,.78); color: #f05f98; font-weight: 900; cursor: pointer; }
.actions .danger { color: #f26180; }
.actions button:disabled { opacity: .45; cursor: not-allowed; }
.empty-row { padding: 40px; color: #9aa3b8; text-align: center; font-weight: 900; }
</style>
