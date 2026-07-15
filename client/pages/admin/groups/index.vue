<template>
  <div class="admin-groups-page">
    <section class="groups-card">
      <header class="groups-header">
        <div>
          <h1>用户组</h1>
          <p>按用户组配置上传限制、图片处理规则与内容审核策略。</p>
        </div>
        <button type="button" class="primary-action" @click="navigateTo('/admin/groups/create')">
          <TaotuIcon name="create-plus" />新用户组
        </button>
      </header>

      <div class="groups-table">
        <div class="table-head">
          <span>ID</span><span>用户组名称</span><span>默认</span><span>图片审核</span><span>用户数量</span><span>策略数量</span><span>操作</span>
        </div>
        <div v-if="loading" class="empty-row">加载中...</div>
        <div v-else-if="groups.length === 0" class="empty-row">暂无用户组</div>
        <div v-for="group in groups" v-else :key="group.id" class="table-row">
          <span>#{{ group.id }}</span>
          <strong>{{ group.name }}</strong>
          <span class="status-icon" :class="group.is_default ? 'ok' : 'no'">
            <TaotuIcon :name="group.is_default ? 'success' : 'failure'" filled />
          </span>
          <span class="status-icon" :class="group.image_review_enabled ? 'ok' : 'no'">
            <TaotuIcon :name="group.image_review_enabled ? 'success' : 'failure'" filled />
          </span>
          <span>{{ group.user_count || 0 }}</span>
          <span>{{ group.strategy_count || 0 }}</span>
          <span><button type="button" class="edit-btn" @click="navigateTo(`/admin/groups/${group.id}`)">编辑</button></span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const groups = ref([])
const loading = ref(false)

onMounted(loadGroups)

async function loadGroups() {
  loading.value = true
  try {
    const data = await api.get('/api/admin/groups')
    groups.value = data.groups || []
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.admin-groups-page { max-width: 1180px; margin: 0 auto; }
.groups-card { padding: 24px; border: 1px solid rgba(234,224,236,.92); border-radius: 14px; background: rgba(255,255,255,.82); box-shadow: 0 24px 72px rgba(84,76,104,.14); backdrop-filter: blur(24px); }
.groups-header { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.groups-header h1 { margin: 0; color: #30384e; font-size: 22px; font-weight: 900; }
.groups-header p { margin: 7px 0 0; color: #8b93a8; font-size: 13px; font-weight: 800; }
.primary-action, .edit-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: 8px; cursor: pointer; font-weight: 900; }
.primary-action { height: 38px; padding: 0 16px; background: linear-gradient(135deg,#f76da1,#f35f98); color: #fff; box-shadow: 0 12px 24px rgba(242,96,151,.22); }
.primary-action .taotu-svg-icon { width: 18px; height: 18px; }
.groups-table { overflow: hidden; border: 1px solid rgba(226,231,242,.78); border-radius: 10px; background: rgba(255,255,255,.68); }
.table-head, .table-row { display: grid; grid-template-columns: 80px minmax(180px,1fr) 100px 120px 110px 110px 110px; align-items: center; gap: 12px; padding: 0 16px; }
.table-head { height: 42px; background: rgba(247,249,253,.82); color: #7e879a; font-size: 12px; font-weight: 900; }
.table-row { min-height: 54px; border-top: 1px solid rgba(226,231,242,.74); color: #566077; font-size: 13px; font-weight: 850; }
.table-row strong { color: #323a50; }
.status-icon .taotu-svg-icon { width: 22px; height: 22px; }
.status-icon.ok { color: #45bd8f; }
.status-icon.no { color: #f26193; }
.edit-btn { height: 30px; padding: 0 12px; border: 1px solid rgba(255,166,196,.48); background: rgba(255,241,247,.78); color: #f05f98; }
.empty-row { padding: 40px; color: #9aa3b8; text-align: center; font-weight: 900; }
</style>
