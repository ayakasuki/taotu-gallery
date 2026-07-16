<template>
  <div class="group-edit-page">
    <section class="group-card">
      <header class="group-header">
        <div>
          <button type="button" class="back-btn" @click="navigateTo('/admin/groups')"><TaotuIcon name="back" />返回用户组</button>
          <h1>{{ isCreate ? '新建用户组' : `编辑用户组 #${route.params.id}` }}</h1>
        </div>
        <button type="button" class="save-btn" :disabled="saving" @click="saveGroup">{{ saving ? '保存中...' : '保存用户组' }}</button>
      </header>

      <nav class="tabs">
        <button type="button" :class="{ active: tab === 'base' }" @click="tab = 'base'">综合配置</button>
        <button type="button" :class="{ active: tab === 'review' }" @click="tab = 'review'">图片审核</button>
      </nav>

      <div v-if="tab === 'base'" class="form-grid">
        <label class="field full"><span>用户组名称 <b>*</b></span><input v-model.trim="form.name" /></label>
        <label class="field"><span>最大文件大小 MB <b>*</b> <TaotuIcon name="visibility-info" title="默认 0 代表不限制单张图片大小。" /></span><input v-model.number="form.max_file_size_mb" type="number" min="0" step="0.01" /></label>
        <label class="field"><span>并发上传限制 <b>*</b> <TaotuIcon name="visibility-info" title="默认 0 代表不限制单次选择或并发上传数量。" /></span><input v-model.number="form.max_concurrent_uploads" type="number" min="0" /></label>
        <label class="field"><span>每分钟上传限制 <b>*</b> <TaotuIcon name="visibility-info" title="默认 0 代表不限制每分钟上传数量。" /></span><input v-model.number="form.upload_limit_minute" type="number" min="0" /></label>
        <label class="field"><span>每小时上传限制 <b>*</b> <TaotuIcon name="visibility-info" title="默认 0 代表不限制每小时上传数量。" /></span><input v-model.number="form.upload_limit_hour" type="number" min="0" /></label>
        <label class="field"><span>每天上传限制 <b>*</b> <TaotuIcon name="visibility-info" title="默认 0 代表不限制每天上传数量。" /></span><input v-model.number="form.upload_limit_day" type="number" min="0" /></label>
        <label class="field"><span>每周上传限制 <b>*</b> <TaotuIcon name="visibility-info" title="默认 0 代表不限制每周上传数量。" /></span><input v-model.number="form.upload_limit_week" type="number" min="0" /></label>
        <label class="field"><span>每月上传限制 <b>*</b> <TaotuIcon name="visibility-info" title="默认 0 代表不限制每月上传数量。" /></span><input v-model.number="form.upload_limit_month" type="number" min="0" /></label>

        <label class="field">
          <span>路径命名规则 <TaotuIcon name="visibility-info" title="点击查看命名规则对照表" @click.prevent="showRuleHelp = true" /></span>
          <input v-model.trim="form.path_rule" />
        </label>
        <label class="field">
          <span>文件命名规则 <TaotuIcon name="visibility-info" title="点击查看命名规则对照表" @click.prevent="showRuleHelp = true" /></span>
          <input v-model.trim="form.filename_rule" />
        </label>

        <div class="range-field full">
          <div><span>图片质量</span><b>{{ form.image_quality }}%</b></div>
          <input v-model.number="form.image_quality" type="range" min="40" max="100" />
        </div>
        <label class="field"><span>中等图最大宽度</span><input v-model.number="form.medium_width" type="number" min="1" /></label>
        <label class="field"><span>中等图最大高度</span><input v-model.number="form.medium_height" type="number" min="1" /></label>
        <div class="formats full">
          <span>支持的图片格式</span>
          <label v-for="item in formatOptions" :key="item" class="format-check">
            <input v-model="form.allowed_formats" type="checkbox" :value="item" />
            <span>{{ item.toUpperCase() }}</span>
          </label>
        </div>
        <div class="setting-row full">
          <div><strong>是否默认 <TaotuIcon name="visibility-info" title="设置默认后，新用户注册会自动属于该用户组；默认组只能有一个。" /></strong><span>新用户注册后将会属于该默认用户组。</span></div>
          <button type="button" class="pink-switch" :class="{ active: form.is_default }" @click="form.is_default = !form.is_default"><i /></button>
        </div>
      </div>

      <div v-else class="form-grid">
        <div class="setting-row full">
          <div><strong>图片审核</strong><span>开启后会标记该用户组图片的 NSFW 状态，不健康内容默认不进入公开展示。</span></div>
          <button type="button" class="pink-switch" :class="{ active: form.image_review_enabled }" @click="form.image_review_enabled = !form.image_review_enabled"><i /></button>
        </div>
        <div class="setting-row full">
          <div><strong>不健康内容展示</strong><span>关闭时不展示该用户组的不健康图片。</span></div>
          <button type="button" class="pink-switch" :class="{ active: form.nsfw_visible }" @click="form.nsfw_visible = !form.nsfw_visible"><i /></button>
        </div>
        <label class="field full"><span>内容合规引擎</span><TaotuSelect v-model="form.nsfw_engine" :options="engineOptions" /></label>
        <div v-if="form.nsfw_engine === 'nsfwjs'" class="engine-card full">
          <label class="field full">
            <span>配置接口地址 <TaotuIcon name="visibility-info" title="当前为外接 nsfw.js 兼容服务：接口返回官方 predictions 数组，如 [{ className: 'Porn', probability: 0.93 }]。" /></span>
            <input v-model.trim="form.nsfw_config.nsfwjs.endpoint" placeholder="http(s)://nsfwjs-service/predict" />
          </label>
          <label v-for="name in nsfwClasses" :key="name" class="field">
            <span>{{ name }} 阈值（%） <TaotuIcon name="visibility-info" title="100% 代表此项不参与限制；0% 代表只要命中此项就判定不合规。" /></span>
            <input v-model.number="form.nsfw_config.nsfwjs.thresholds[name]" type="number" min="0" max="100" />
          </label>
        </div>
        <div v-else class="engine-card full">
          <label class="field"><span>地域</span><input v-model.trim="form.nsfw_config.tencent_ims.region" placeholder="ap-guangzhou" /></label>
          <label class="field"><span>Endpoint</span><input v-model.trim="form.nsfw_config.tencent_ims.endpoint" placeholder="ims.tencentcloudapi.com" /></label>
          <label class="field"><span>SecretId</span><input v-model.trim="form.nsfw_config.tencent_ims.secretId" /></label>
          <label class="field"><span>SecretKey</span><input v-model.trim="form.nsfw_config.tencent_ims.secretKey" type="password" /></label>
        </div>
      </div>
    </section>

    <div v-if="showRuleHelp" class="rule-modal" @click.self="showRuleHelp = false">
      <div class="rule-card">
        <button type="button" class="close-btn" @click="showRuleHelp = false"><TaotuIcon name="close" /></button>
        <div class="rule-row head"><span>规则</span><span>说明</span></div>
        <div v-for="item in ruleHelp" :key="item.key" class="rule-row"><code>{{ item.key }}</code><strong>{{ item.desc }}</strong></div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const { showAdminToast } = useAdminToast()
const route = useRoute()
const isCreate = computed(() => route.params.id === 'create')
const tab = ref('base')
const saving = ref(false)
const showRuleHelp = ref(false)
const formatOptions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'ico']
const nsfwClasses = ['Drawing', 'Hentai', 'Neutral', 'Porn', 'Sexy']
const engineOptions = [{ label: 'nsfw.js', value: 'nsfwjs' }, { label: '腾讯云 IMS', value: 'tencent_ims' }]
const ruleHelp = [
  { key: '{yyyy}', desc: '年份（2026）' }, { key: '{yy}', desc: '两位数年份（26）' }, { key: '{mm}', desc: '月份（01）' }, { key: '{dd}', desc: '当月的第几号（04）' },
  { key: '{timestamp}', desc: '时间戳（秒）' }, { key: '{uniqid}', desc: '唯一字符串' }, { key: '{md5}', desc: '随机 md5 值' }, { key: '{md5-16}', desc: '16 位随机 md5 值' },
  { key: '{str-random-16}', desc: '16 位随机字符串' }, { key: '{str-random-10}', desc: '10 位随机字符串' }, { key: '{filename}', desc: '文件原始名称' }, { key: '{uid}', desc: '用户 ID' }
]
const form = reactive(defaultForm())

function defaultForm() {
  return {
    name: '',
    is_default: false,
    max_file_size_mb: 0,
    max_concurrent_uploads: 0,
    upload_limit_minute: 0,
    upload_limit_hour: 0,
    upload_limit_day: 0,
    upload_limit_week: 0,
    upload_limit_month: 0,
    path_rule: '{yyyy}-{mm}-{dd}',
    filename_rule: '{uniqid}',
    image_quality: 85,
    medium_width: 1920,
    medium_height: 1080,
    allowed_formats: [...formatOptions],
    image_review_enabled: false,
    nsfw_visible: false,
    nsfw_engine: 'nsfwjs',
    nsfw_config: {
      nsfwjs: { endpoint: '', thresholds: { Drawing: 100, Hentai: 60, Neutral: 100, Porn: 40, Sexy: 70 } },
      tencent_ims: { endpoint: '', secretId: '', secretKey: '', region: 'ap-guangzhou' }
    }
  }
}

onMounted(async () => {
  if (!isCreate.value) {
    const data = await api.get(`/api/admin/groups/${route.params.id}`)
    Object.assign(form, defaultForm(), data)
  }
})

async function saveGroup() {
  if (!form.name.trim()) return showAdminToast('请输入用户组名称', 'error')
  saving.value = true
  try {
    const payload = JSON.parse(JSON.stringify(form))
    const saved = isCreate.value
      ? await api.post('/api/admin/groups', payload)
      : await api.put(`/api/admin/groups/${route.params.id}`, payload)
    const queued = Number(saved.review_queue?.queued || 0)
    showAdminToast(
      queued > 0 ? `用户组已保存，${queued} 张已有图片已进入内容审核` : '用户组已保存',
      'success'
    )
    navigateTo(`/admin/groups/${saved.id}`)
  } catch (error) {
    showAdminToast(error?.data?.error || error.message || '用户组保存失败', 'error', 5000)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.group-edit-page { max-width: 1180px; margin: 0 auto; }
.group-card { padding: 24px; border: 1px solid rgba(234,224,236,.92); border-radius: 14px; background: rgba(255,255,255,.84); box-shadow: 0 24px 72px rgba(84,76,104,.14); backdrop-filter: blur(24px); }
.group-header { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.group-header h1 { margin: 8px 0 0; color: #30384e; font-size: 22px; font-weight: 900; }
.back-btn, .save-btn, .close-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 0; border-radius: 8px; cursor: pointer; font-weight: 900; }
.back-btn { height: 30px; background: transparent; color: #8b93a8; }
.save-btn { height: 38px; padding: 0 16px; background: linear-gradient(135deg,#f76da1,#f35f98); color: #fff; box-shadow: 0 12px 24px rgba(242,96,151,.22); }
.tabs { display: flex; gap: 10px; padding: 6px; margin-bottom: 18px; border-radius: 10px; background: rgba(247,249,253,.82); }
.tabs button { height: 34px; padding: 0 16px; border: 0; border-radius: 8px; background: transparent; color: #7d869a; font-weight: 900; cursor: pointer; }
.tabs button.active { background: #fff; color: #f05f98; box-shadow: 0 8px 18px rgba(92,84,118,.1); }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
.full { grid-column: 1 / -1; }
.field { display: grid; gap: 8px; color: #6d7589; font-size: 13px; font-weight: 900; }
.field span b { color: #f05f98; }
.field input { height: 38px; padding: 0 12px; border: 1px solid rgba(226,231,242,.9); border-radius: 8px; background: rgba(255,255,255,.76); color: #3d465c; font-weight: 850; outline: 0; }
.field .taotu-svg-icon { width: 15px; height: 15px; color: #f05f98; cursor: pointer; vertical-align: -2px; }
.range-field { padding: 14px; border: 1px solid rgba(226,231,242,.9); border-radius: 10px; background: rgba(255,255,255,.6); }
.range-field div { display: flex; justify-content: space-between; margin-bottom: 10px; color: #596277; font-weight: 900; }
.range-field input { width: 100%; accent-color: #f05f98; }
.formats { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 14px; border: 1px solid rgba(226,231,242,.9); border-radius: 10px; background: rgba(255,255,255,.6); color: #6d7589; font-weight: 900; }
.format-check { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
.setting-row, .engine-card { padding: 14px; border: 1px solid rgba(226,231,242,.9); border-radius: 10px; background: rgba(255,255,255,.62); }
.setting-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.setting-row strong { color: #30384e; font-size: 14px; }
.setting-row span { display: block; margin-top: 4px; color: #8b93a8; font-size: 12px; font-weight: 850; }
.pink-switch { width: 48px; min-width: 48px; height: 26px; padding: 3px; border: 0; border-radius: 999px; background: #d8dce8; cursor: pointer; }
.pink-switch i { width: 20px; height: 20px; display: block; border-radius: 50%; background: #fff; box-shadow: 0 4px 12px rgba(66,59,86,.16); transition: transform .18s ease; }
.pink-switch.active { background: var(--taotu-button-active-bg,#f15c96); }
.pink-switch.active i { transform: translateX(22px); }
.engine-card { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px; }
.rule-modal { position: fixed; inset: 0; z-index: 2200; display: grid; place-items: center; background: rgba(38,44,62,.26); }
.rule-card { position: relative; width: min(860px, calc(100vw - 48px)); padding: 28px 32px; border-radius: 10px; background: rgba(255,255,255,.96); box-shadow: 0 24px 80px rgba(58,64,88,.24); }
.close-btn { position: absolute; top: 16px; right: 16px; width: 32px; height: 32px; background: transparent; color: #9aa3b8; }
.rule-row { display: grid; grid-template-columns: minmax(180px,.7fr) 1fr; padding: 10px 12px; border-bottom: 1px solid rgba(226,231,242,.9); color: #60697e; }
.rule-row.head { background: rgba(247,249,253,.9); color: #8b93a8; font-weight: 900; }
.rule-row code { color: #697386; font-weight: 900; }
.rule-row strong { color: #202638; font-weight: 900; }
</style>
