<template>
  <div class="strategy-edit-page">
    <section class="edit-card">
      <header class="edit-header">
        <div><button class="back-btn" type="button" @click="navigateTo('/admin/strategies')"><TaotuIcon name="back" />返回存储策略</button><h1>{{ isCreate ? '新建存储策略' : `编辑存储策略 #${route.params.id}` }}</h1></div>
        <button type="button" class="save-btn" :disabled="saving" @click="saveStrategy">{{ saving ? '保存中...' : '保存策略' }}</button>
      </header>
      <div class="form-grid">
        <label class="field"><span>策略名称 <b>*</b></span><input v-model.trim="form.name" /></label>
        <label class="field"><span>关联用户组</span><TaotuSelect v-model="form.group_ids" multiple :options="groupOptions" placeholder="可选择多个用户组" /></label>
        <label class="field full"><span>简介</span><textarea v-model.trim="form.description" /></label>
        <label class="field"><span>挂载策略</span><TaotuSelect v-model="form.type" :options="typeOptions" :disabled="!isCreate" /></label>
      </div>

      <div class="mount-card">
        <template v-if="form.type === 'local'">
          <label class="field full">
            <span>存储挂载路径 <TaotuIcon name="visibility-info" title="本地策略只能填写服务器上的绝对路径；留空时使用当前项目 data/uploads。" /></span>
            <input v-model.trim="form.config.basePath" placeholder="/data/uploads 或 /data1/xxx/data/uploads" />
          </label>
        </template>
        <template v-else-if="form.type === 'tencent_cos'">
          <label class="field"><span>Bucket</span><input v-model.trim="form.config.bucket" /></label>
          <label class="field"><span>地域 Region</span><input v-model.trim="form.config.region" placeholder="ap-guangzhou" /></label>
          <label class="field"><span>SecretId</span><input v-model.trim="form.config.secretId" /></label>
          <label class="field"><span>SecretKey</span><input v-model.trim="form.config.secretKey" type="password" /></label>
          <label class="field"><span>路径前缀</span><input v-model.trim="form.config.prefix" placeholder="data/uploads" /></label>
          <label class="field"><span>访问域名</span><input v-model.trim="form.config.publicDomain" placeholder="https://" /></label>
        </template>
        <template v-else-if="form.type === 'aliyun_oss'">
          <label class="field"><span>Bucket</span><input v-model.trim="form.config.bucket" /></label>
          <label class="field"><span>Region</span><input v-model.trim="form.config.region" /></label>
          <label class="field"><span>Endpoint</span><input v-model.trim="form.config.endpoint" /></label>
          <label class="field"><span>AccessKeyId</span><input v-model.trim="form.config.accessKeyId" /></label>
          <label class="field"><span>AccessKeySecret</span><input v-model.trim="form.config.accessKeySecret" type="password" /></label>
          <label class="field"><span>路径前缀</span><input v-model.trim="form.config.prefix" placeholder="data/uploads" /></label>
        </template>
        <template v-else-if="form.type === 'ftp'">
          <label class="field"><span>访问域名</span><input v-model.trim="form.config.publicDomain" placeholder="http(s)://" /></label>
          <label class="field"><span>URL Queries</span><input v-model.trim="form.config.urlQueries" /></label>
          <label class="field"><span>根目录</span><input v-model.trim="form.config.rootDir" /></label>
          <label class="field"><span>主机地址</span><input v-model.trim="form.config.host" /></label>
          <label class="field"><span>连接端口</span><input v-model.number="form.config.port" type="number" /></label>
          <label class="field"><span>用户名</span><input v-model.trim="form.config.username" /></label>
          <label class="field"><span>密码</span><input v-model.trim="form.config.password" type="password" /></label>
          <div class="switches full"><label><input v-model="form.config.secure" type="checkbox" />加密连接</label><label><input v-model="form.config.passive" type="checkbox" />被动模式</label></div>
        </template>
        <template v-else>
          <label class="field"><span>访问域名</span><input v-model.trim="form.config.publicDomain" placeholder="http(s)://" /></label>
          <label class="field"><span>URL Queries</span><input v-model.trim="form.config.urlQueries" /></label>
          <label class="field"><span>根目录</span><input v-model.trim="form.config.rootDir" /></label>
          <label class="field"><span>主机地址</span><input v-model.trim="form.config.host" /></label>
          <label class="field"><span>连接端口</span><input v-model.number="form.config.port" type="number" /></label>
          <label class="field"><span>用户名</span><input v-model.trim="form.config.username" /></label>
          <label class="field"><span>密码</span><input v-model.trim="form.config.password" type="password" /></label>
          <label class="field full"><span>私钥</span><textarea v-model.trim="form.config.privateKey" /></label>
          <label class="field"><span>私钥口令</span><input v-model.trim="form.config.passphrase" /></label>
          <div class="switches"><label><input v-model="form.config.useProxy" type="checkbox" />是否使用代理</label></div>
          <label v-if="form.config.useProxy" class="field full"><span>代理地址</span><input v-model.trim="form.config.proxyUrl" placeholder="http(s)://host:port 或 socks5://host:port" /></label>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const route = useRoute()
const isCreate = computed(() => route.params.id === 'create')
const saving = ref(false)
const groups = ref([])
const typeOptions = [
  { label: '本地', value: 'local' },
  { label: '腾讯云 COS', value: 'tencent_cos' },
  { label: '阿里云 OSS', value: 'aliyun_oss' },
  { label: 'FTP', value: 'ftp' },
  { label: 'SFTP', value: 'sftp' }
]
const groupOptions = computed(() => groups.value.map(g => ({ label: g.name, value: g.id, description: g.is_default ? '默认用户组' : `${g.user_count || 0} 个用户` })))
const form = reactive(defaultForm())

function defaultConfig(type) {
  if (type === 'local') return { basePath: '' }
  if (type === 'tencent_cos') return { bucket: '', region: 'ap-guangzhou', secretId: '', secretKey: '', prefix: 'data/uploads', publicDomain: '' }
  if (type === 'aliyun_oss') return { bucket: '', region: '', endpoint: '', accessKeyId: '', accessKeySecret: '', prefix: 'data/uploads', publicDomain: '' }
  if (type === 'ftp') return { host: '', port: 21, username: '', password: '', rootDir: '/', publicDomain: '', urlQueries: '', secure: false, passive: true }
  return { host: '', port: 22, username: '', password: '', privateKey: '', passphrase: '', rootDir: '/', publicDomain: '', urlQueries: '', useProxy: false, proxyUrl: '' }
}
function defaultForm() { return { name: '', description: '', type: 'local', group_ids: [], config: defaultConfig('local') } }
watch(() => form.type, (type, oldType) => { if (type !== oldType && isCreate.value) form.config = defaultConfig(type) })
onMounted(async () => {
  groups.value = (await api.get('/api/admin/groups')).groups || []
  if (!isCreate.value) {
    const data = await api.get(`/api/admin/strategies/${route.params.id}`)
    Object.assign(form, defaultForm(), data, { group_ids: data.group_ids || [], config: { ...defaultConfig(data.type), ...(data.config || {}) } })
  }
})
async function saveStrategy() {
  if (!form.name.trim()) return
  saving.value = true
  try {
    const payload = JSON.parse(JSON.stringify(form))
    const saved = isCreate.value
      ? await api.post('/api/admin/strategies', payload)
      : await api.put(`/api/admin/strategies/${route.params.id}`, payload)
    navigateTo(`/admin/strategies/${saved.id}`)
  } finally { saving.value = false }
}
</script>

<style scoped>
.strategy-edit-page { max-width: 1180px; margin: 0 auto; }
.edit-card { padding: 24px; border: 1px solid rgba(234,224,236,.92); border-radius: 14px; background: rgba(255,255,255,.84); box-shadow: 0 24px 72px rgba(84,76,104,.14); backdrop-filter: blur(24px); }
.edit-header { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.edit-header h1 { margin: 8px 0 0; color: #30384e; font-size: 22px; font-weight: 900; }
.back-btn, .save-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: 8px; cursor: pointer; font-weight: 900; }
.back-btn { height: 30px; background: transparent; color: #8b93a8; }
.save-btn { height: 38px; padding: 0 16px; background: linear-gradient(135deg,#f76da1,#f35f98); color: #fff; box-shadow: 0 12px 24px rgba(242,96,151,.22); }
.form-grid, .mount-card { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px; }
.mount-card { margin-top: 18px; padding: 18px; border: 1px solid rgba(226,231,242,.9); border-radius: 12px; background: rgba(247,249,253,.64); }
.full { grid-column: 1 / -1; }
.field { display: grid; gap: 8px; color: #6d7589; font-size: 13px; font-weight: 900; }
.field span b { color: #f05f98; }
.field .taotu-svg-icon { width: 15px; height: 15px; color: #f05f98; cursor: help; vertical-align: -2px; }
.field input, .field textarea { width: 100%; min-height: 38px; padding: 0 12px; border: 1px solid rgba(226,231,242,.9); border-radius: 8px; background: rgba(255,255,255,.76); color: #3d465c; font-weight: 850; outline: 0; }
.field textarea { min-height: 88px; padding: 12px; resize: vertical; }
.switches { display: flex; align-items: center; gap: 16px; color: #687186; font-weight: 900; }
.switches label { display: inline-flex; align-items: center; gap: 8px; }
</style>
