<template>
  <div class="admin-api">
    <h1 class="page-title">API 设置</h1>
    <div class="fluent-card">
      <h3>API Token 管理</h3>
      <div class="token-list">
        <div v-for="token in tokens" :key="token.id" class="token-item">
          <div class="token-info">
            <span class="token-label">{{ token.label || '未命名' }}</span>
            <span class="token-global" v-if="token.is_global">全局</span>
            <span class="token-date">{{ new Date(token.created_at).toLocaleDateString() }}</span>
          </div>
          <button class="fluent-btn fluent-btn-secondary" @click="deleteToken(token.id)">删除</button>
        </div>
        <div v-if="tokens.length === 0" class="empty-msg">暂无 Token</div>
      </div>
      <div class="add-token">
        <input v-model="newLabel" class="fluent-input" placeholder="Token 名称" />
        <button class="fluent-btn fluent-btn-primary" @click="createToken">生成 Token</button>
      </div>
      <div v-if="newToken" class="new-token-box">
        <p>新 Token（请妥善保存，仅显示一次）：</p>
        <code>{{ newToken }}</code>
        <button class="fluent-btn fluent-btn-secondary" @click="copyToken">复制</button>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
const tokens = ref([])
const newLabel = ref('')
const newToken = ref('')

onMounted(() => loadTokens())

const loadTokens = async () => {
  try {
    const api = useApi()
    const data = await api.get('/api/admin/api/tokens')
    tokens.value = data.tokens || []
  } catch {}
}

const createToken = async () => {
  try {
    const api = useApi()
    const data = await api.post('/api/admin/api/tokens', { label: newLabel.value })
    newToken.value = data.token
    newLabel.value = ''
    await loadTokens()
  } catch (err) { alert('创建失败: ' + err.message) }
}

const deleteToken = async (id) => {
  if (!confirm('确定删除此 Token？')) return
  try {
    const api = useApi()
    await api.del(`/api/admin/api/tokens/${id}`)
    await loadTokens()
  } catch (err) { alert('删除失败: ' + err.message) }
}

const copyToken = async () => {
  try { await navigator.clipboard.writeText(newToken.value); alert('已复制') } catch {}
}
</script>

<style scoped>
.page-title { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xl); }
.token-list { margin-bottom: var(--space-lg); }
.token-item { display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) 0; border-bottom: 1px solid var(--fluent-border); }
.token-info { display: flex; align-items: center; gap: var(--space-md); }
.token-label { font-weight: 500; }
.token-global { font-size: 11px; padding: 1px 6px; background: var(--fluent-blue-light); color: var(--fluent-blue); border-radius: 10px; }
.token-date { font-size: 12px; color: var(--fluent-text-secondary); }
.add-token { display: flex; gap: var(--space-md); }
.fluent-input { flex: 1; padding: 8px 12px; border: 1px solid var(--fluent-border); border-radius: var(--radius-sm); font-size: 14px; }
.new-token-box { margin-top: var(--space-lg); padding: var(--space-md); background: #fff4ce; border-radius: var(--radius-sm); }
.new-token-box p { font-size: 13px; margin-bottom: var(--space-sm); }
.new-token-box code { display: block; word-break: break-all; font-size: 12px; margin-bottom: var(--space-sm); }
.empty-msg { text-align: center; padding: var(--space-lg); color: var(--fluent-text-secondary); }
</style>
