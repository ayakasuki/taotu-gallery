<template>
  <div class="site-config-page">
    <header class="site-config-header">
      <div>
        <h1>站点配置 <span>/ site-config</span></h1>
        <p>配置网站的基本信息、外观、邮件服务、安全与部署等全局设置</p>
      </div>
      <div class="global-actions">
        <button type="button" class="ghost-action" :disabled="loading" @click="reloadSiteConfig">
          <img src="/icons/actions/refresh-64x64.png" alt="" />重置
        </button>
        <button type="button" class="ghost-action" :disabled="saving" @click="saveSiteConfig('全部配置已保存')">
          保存全部
        </button>
        <button type="button" class="primary-action" :disabled="saving || changingPassword" @click="saveAllChanges">
          <img src="/icons/actions/confirm-64x64.png" alt="" />保存所有更改
        </button>
      </div>
    </header>

    <section class="site-config-grid">
      <article class="site-card brand-card">
        <div class="card-heading">
          <h2>品牌与显示</h2>
          <span class="saved-badge" :class="{ dirty: isCardDirty('brand') }">
            <img :src="cardBadgeIcon('brand')" alt="" />{{ cardBadgeText('brand') }}
          </span>
        </div>

        <div class="brand-top-row">
          <label class="field-block">
            <span>网站名称</span>
            <input v-model.trim="form.siteName" class="soft-input" placeholder="桃图智库" />
          </label>

          <div class="favicon-block">
            <span class="field-title">网站图标（Favicon）</span>
            <div class="favicon-row">
              <div class="favicon-preview">
                <img v-if="iconPreview" :src="iconPreview" alt="" />
                <span v-else>桃</span>
              </div>
              <div class="upload-copy">
                <button type="button" class="outline-action compact" :disabled="uploadingIcon" @click="iconInput?.click()">
                  <img src="/icons/actions/edit-64x64.png" alt="" />{{ uploadingIcon ? '上传中...' : '更换图标' }}
                </button>
                <p>建议尺寸 64x64px，支持 PNG / ICO</p>
                <b v-if="form.icon">已上传</b>
              </div>
            </div>
            <input ref="iconInput" type="file" accept="image/*,.ico" hidden @change="handleIconUpload" />
          </div>
        </div>

        <label class="field-block">
          <span>背景图 URL</span>
          <input v-model.trim="form.bgUrl" class="soft-input" placeholder="https://cdn.taotu.ai/backgrounds/bg-spring.jpg" />
        </label>

        <div class="background-upload">
          <span class="field-title">背景图上传</span>
          <div class="bg-upload-row">
            <div class="bg-preview">
              <img v-if="backgroundPreview" :src="backgroundPreview" alt="" />
              <span v-else>背景图预览</span>
            </div>
            <div class="upload-copy">
              <button type="button" class="outline-action compact" :disabled="uploadingBg" @click="bgInput?.click()">
                <img src="/icons/actions/edit-64x64.png" alt="" />{{ uploadingBg ? '上传中...' : '更换背景图' }}
              </button>
              <p>建议尺寸 1920x1080px 或更高</p>
              <b v-if="form.bgUrl">已上传</b>
            </div>
          </div>
          <input ref="bgInput" type="file" accept="image/*" hidden @change="handleBgUpload" />
        </div>

        <div class="range-field">
          <div class="range-title">
            <span>背景模糊度</span>
            <b>{{ form.bgBlur }}%</b>
          </div>
          <input v-model.number="form.bgBlur" type="range" min="0" max="100" class="pink-range" :style="rangeFillStyle(form.bgBlur, 0, 100)" />
          <p>数值越大，背景越模糊</p>
        </div>

        <div class="mask-grid">
          <div class="field-block color-field">
            <span>上半部分遮罩</span>
            <div class="color-input-wrap">
              <input v-model.trim="form.overlayTop" class="soft-input" @focus="openColorPicker('top')" />
              <button type="button" class="color-trigger" :style="{ background: safeColor(form.overlayTop) }" @click.stop="openColorPicker('top')"></button>
            </div>
            <div v-if="activeColorPicker === 'top'" class="color-popover top-popover" @click.stop>
              <div class="popover-row">
                <span>颜色</span>
                <input v-model="colorEditor.hex" type="color" />
              </div>
              <div class="popover-row alpha-row">
                <span>透明度 {{ colorAlphaPercent }}%</span>
                <input v-model.number="colorEditor.alpha" type="range" min="0" max="1" step="0.01" class="pink-range compact-range" :style="rangeFillStyle(colorEditor.alpha, 0, 1)" />
              </div>
              <div class="popover-actions">
                <button type="button" @click="activeColorPicker = ''">关闭</button>
                <button type="button" @click="applyColorPicker">应用</button>
              </div>
            </div>
          </div>

          <div class="field-block color-field">
            <span>下半部分遮罩</span>
            <div class="color-input-wrap">
              <input v-model.trim="form.overlayBottom" class="soft-input" @focus="openColorPicker('bottom')" />
              <button type="button" class="color-trigger" :style="{ background: safeColor(form.overlayBottom) }" @click.stop="openColorPicker('bottom')"></button>
            </div>
            <div v-if="activeColorPicker === 'bottom'" class="color-popover bottom-popover" @click.stop>
              <div class="popover-row">
                <span>颜色</span>
                <input v-model="colorEditor.hex" type="color" />
              </div>
              <div class="popover-row alpha-row">
                <span>透明度 {{ colorAlphaPercent }}%</span>
                <input v-model.number="colorEditor.alpha" type="range" min="0" max="1" step="0.01" class="pink-range compact-range" :style="rangeFillStyle(colorEditor.alpha, 0, 1)" />
              </div>
              <div class="popover-actions">
                <button type="button" @click="activeColorPicker = ''">关闭</button>
                <button type="button" @click="applyColorPicker">应用</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card-footer">
          <button type="button" class="primary-action" :disabled="saving" @click="saveSiteConfig('外观配置已保存')">
            <img src="/icons/actions/edit-64x64.png" alt="" />保存外观
          </button>
        </div>
      </article>

      <article class="site-card access-card">
        <div class="card-heading">
          <h2>访问与注册</h2>
          <span class="saved-badge" :class="{ dirty: isCardDirty('access') }">
            <img :src="cardBadgeIcon('access')" alt="" />{{ cardBadgeText('access') }}
          </span>
        </div>

        <label class="field-block">
          <span>公开域名</span>
          <input v-model.trim="form.publicDomain" class="soft-input" placeholder="https://taotu.ai" />
        </label>

        <div class="switch-row">
          <span>开放注册</span>
          <label class="pink-switch">
            <input v-model="form.registrationEnabled" type="checkbox" />
            <i></i>
          </label>
        </div>

        <div class="switch-row">
          <span>用户注册后需审核</span>
          <label class="pink-switch">
            <input v-model="form.registrationRequireReview" type="checkbox" />
            <i></i>
          </label>
        </div>

        <div class="switch-row">
          <span>注册需邮箱验证</span>
          <label class="pink-switch">
            <input v-model="form.emailVerification" type="checkbox" />
            <i></i>
          </label>
        </div>

        <label class="field-block">
          <span>用户配额</span>
          <input v-model.number="form.registrationMaxUsers" class="soft-input" type="number" min="0" placeholder="10000" />
          <small>最大注册用户数，0 表示不限制</small>
        </label>

        <label class="field-block suffix-field">
          <span>用户存储默认配额</span>
          <input v-model.number="form.defaultStorageLimit" class="soft-input" type="number" min="0" placeholder="1024" />
          <em>MB</em>
          <small>普通用户默认可用存储空间，0 表示不限制</small>
        </label>

        <div class="card-footer">
          <button type="button" class="primary-action" :disabled="saving" @click="saveSiteConfig('访问与注册已保存')">
            <img src="/icons/actions/refresh-64x64.png" alt="" />保存访问与注册
          </button>
        </div>
      </article>

      <article class="site-card password-card">
        <div class="card-heading">
          <h2>管理员账号与密码</h2>
          <span class="saved-badge" :class="{ dirty: isCardDirty('password') }">
            <img :src="cardBadgeIcon('password')" alt="" />{{ cardBadgeText('password') }}
          </span>
        </div>

        <label class="field-block">
          <span>旧密码</span>
          <div class="password-input">
            <input v-model="form.oldPassword" :type="showPassword.old ? 'text' : 'password'" class="soft-input" placeholder="请输入旧密码" autocomplete="current-password" />
            <button type="button" @click="showPassword.old = !showPassword.old">
              <img :src="showPassword.old ? '/icons/actions/eye-off-64x64.png' : '/icons/actions/eye-64x64.png'" alt="" />
            </button>
          </div>
        </label>

        <label class="field-block">
          <span>新密码</span>
          <div class="password-input">
            <input v-model="form.newPassword" :type="showPassword.new ? 'text' : 'password'" class="soft-input" placeholder="请输入新密码" autocomplete="new-password" />
            <button type="button" @click="showPassword.new = !showPassword.new">
              <img :src="showPassword.new ? '/icons/actions/eye-off-64x64.png' : '/icons/actions/eye-64x64.png'" alt="" />
            </button>
          </div>
        </label>

        <label class="field-block">
          <span>确认新密码</span>
          <div class="password-input">
            <input v-model="form.confirmPassword" :type="showPassword.confirm ? 'text' : 'password'" class="soft-input" placeholder="请再次输入新密码" autocomplete="new-password" />
            <button type="button" @click="showPassword.confirm = !showPassword.confirm">
              <img :src="showPassword.confirm ? '/icons/actions/eye-off-64x64.png' : '/icons/actions/eye-64x64.png'" alt="" />
            </button>
          </div>
          <small>密码长度至少 8 位，建议包含大小写字母、数字和符号</small>
        </label>

        <div class="card-footer">
          <button type="button" class="primary-action" :disabled="changingPassword" @click="changePassword">
            <img src="/icons/actions/edit-64x64.png" alt="" />{{ changingPassword ? '保存中...' : '保存密码' }}
          </button>
        </div>
      </article>

      <article class="site-card smtp-card">
        <div class="card-heading">
          <h2>邮件服务（SMTP）</h2>
          <span class="saved-badge" :class="{ dirty: isCardDirty('smtp') }">
            <img :src="cardBadgeIcon('smtp')" alt="" />{{ cardBadgeText('smtp') }}
          </span>
        </div>

        <div class="smtp-top-grid">
          <label class="field-block">
            <span>SMTP 服务器</span>
            <input v-model.trim="form.smtpHost" class="soft-input" placeholder="smtp.qq.com" />
          </label>
          <label class="field-block">
            <span>端口</span>
            <input v-model.number="form.smtpPort" class="soft-input" type="number" placeholder="587" />
          </label>
          <label class="field-block">
            <span>SSL / TLS</span>
            <select v-model="form.smtpSecurity" class="soft-input soft-select">
              <option value="STARTTLS">STARTTLS</option>
              <option value="SSL/TLS">SSL/TLS</option>
              <option value="NONE">不加密</option>
            </select>
          </label>
        </div>

        <div class="two-col-grid">
          <label class="field-block">
            <span>账号</span>
            <input v-model.trim="form.smtpUsername" class="soft-input" placeholder="no-reply@taotu.ai" />
          </label>
          <label class="field-block">
            <span>密码</span>
            <div class="password-input">
              <input v-model="form.smtpPassword" :type="showPassword.smtp ? 'text' : 'password'" class="soft-input" placeholder="请输入授权码" autocomplete="new-password" />
              <button type="button" @click="showPassword.smtp = !showPassword.smtp">
                <img :src="showPassword.smtp ? '/icons/actions/eye-off-64x64.png' : '/icons/actions/eye-64x64.png'" alt="" />
              </button>
            </div>
          </label>
        </div>

        <label class="field-block">
          <span>发件人</span>
          <input v-model.trim="form.smtpFrom" class="soft-input" placeholder="桃图智库 <no-reply@taotu.ai>" />
        </label>

        <label class="field-block">
          <span>测试收件邮箱</span>
          <input v-model.trim="form.smtpTestTo" class="soft-input" placeholder="test@example.com" />
        </label>

        <div class="split-footer">
          <button type="button" class="outline-action mail-test" :disabled="testingSmtp" @click="testSmtp">
            <img src="/icons/upload/url-upload-64x64.png" alt="" />{{ testingSmtp ? '发送中...' : '发送测试' }}
          </button>
          <button type="button" class="primary-action" :disabled="saving" @click="saveSiteConfig('邮件配置已保存')">
            <img src="/icons/actions/edit-64x64.png" alt="" />保存邮件配置
          </button>
        </div>
      </article>

      <article class="site-card image-card">
        <div class="card-heading">
          <h2>上传与图片处理</h2>
          <span class="saved-badge" :class="{ dirty: isCardDirty('image') }">
            <img :src="cardBadgeIcon('image')" alt="" />{{ cardBadgeText('image') }}
          </span>
        </div>

        <div class="two-col-grid">
          <label class="field-block suffix-field">
            <span>中等图最大宽度</span>
            <input v-model.number="form.mediumWidth" class="soft-input" type="number" min="1" />
            <em>px</em>
          </label>
          <label class="field-block suffix-field">
            <span>中等图最大高度</span>
            <input v-model.number="form.mediumHeight" class="soft-input" type="number" min="1" />
            <em>px</em>
          </label>
        </div>
        <p class="inline-hint">用于列表页、详情页等中等尺寸图片生成</p>

        <div class="range-field image-quality">
          <div class="range-title">
            <span>图片质量</span>
            <b>{{ form.imageQuality }}%</b>
          </div>
          <input v-model.number="form.imageQuality" type="range" min="40" max="100" class="pink-range" :style="rangeFillStyle(form.imageQuality, 40, 100)" />
        </div>

        <label class="field-block suffix-field max-size-field">
          <span>允许上传的最大文件大小</span>
          <input v-model.number="form.defaultMaxFileSize" class="soft-input" type="number" min="0" />
          <em>MB</em>
        </label>

        <div class="formats-block">
          <span>支持的图片格式</span>
          <div class="format-row">
            <label v-for="format in formatOptions" :key="format.key" class="format-check">
              <input v-model="form.allowedFormats" type="checkbox" :value="format.key" />
              <i></i>
              <b>{{ format.label }}</b>
            </label>
          </div>
        </div>

        <div class="card-footer">
          <button type="button" class="primary-action" :disabled="saving" @click="saveSiteConfig('图片配置已保存')">
            <img src="/icons/actions/edit-64x64.png" alt="" />保存图片配置
          </button>
        </div>
      </article>

      <article class="site-card security-card">
        <div class="card-heading">
          <h2>安全与部署</h2>
          <span class="saved-badge" :class="{ dirty: isCardDirty('security') }">
            <img :src="cardBadgeIcon('security')" alt="" />{{ cardBadgeText('security') }}
          </span>
        </div>

        <label class="field-block">
          <span>备案号</span>
          <input v-model.trim="form.recordNumber" class="soft-input" placeholder="粤ICP备2023123456号-1" />
          <small>显示在网站底部（如需展示）</small>
        </label>

        <div class="switch-row">
          <span>启用 HTTPS</span>
          <label class="pink-switch">
            <input v-model="form.httpsEnabled" type="checkbox" />
            <i></i>
          </label>
        </div>

        <label class="field-block">
          <span>证书路径（fullchain.pem）</span>
          <input v-model.trim="form.certPath" class="soft-input" placeholder="/etc/ssl/certs/taotu.ai/fullchain.pem" />
        </label>

        <label class="field-block">
          <span>私钥路径（privkey.pem）</span>
          <input v-model.trim="form.keyPath" class="soft-input" placeholder="/etc/ssl/private/taotu.ai/privkey.pem" />
        </label>

        <div class="card-footer">
          <button type="button" class="primary-action" :disabled="saving" @click="saveSiteConfig('安全配置已保存')">
            <img src="/icons/actions/edit-64x64.png" alt="" />保存安全配置
          </button>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const api = useApi()
const { readSiteConfigCache, writeSiteConfigCache, normalizeAssetUrl } = useUiCache()
const { showAdminToast } = useAdminToast()

const defaultOverlayTop = 'rgba(255, 255, 255, 0.08)'
const defaultOverlayBottom = 'rgba(255, 246, 250, 0.42)'
const defaultSiteBg = '/site_bg.png'
const formatOptions = [
  { key: 'jpg', label: 'JPG / JPEG' },
  { key: 'png', label: 'PNG' },
  { key: 'webp', label: 'WebP' },
  { key: 'gif', label: 'GIF' }
]

const form = reactive({
  siteName: '',
  publicDomain: '',
  registrationEnabled: false,
  registrationRequireReview: false,
  emailVerification: false,
  registrationMaxUsers: 0,
  recordNumber: '',
  httpsEnabled: false,
  certPath: '',
  keyPath: '',
  icon: '',
  bgUrl: '',
  bgBlur: 0,
  overlayTop: defaultOverlayTop,
  overlayBottom: defaultOverlayBottom,
  mediumWidth: 1920,
  mediumHeight: 1080,
  imageQuality: 85,
  allowedFormats: ['jpg', 'png', 'webp', 'gif'],
  defaultStorageLimit: 1024,
  defaultMaxFileSize: 20,
  smtpHost: '',
  smtpPort: 587,
  smtpSecurity: 'STARTTLS',
  smtpUsername: '',
  smtpPassword: '',
  smtpFrom: '',
  smtpTestTo: '',
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const loading = ref(false)
const saving = ref(false)
const testingSmtp = ref(false)
const changingPassword = ref(false)
const uploadingIcon = ref(false)
const uploadingBg = ref(false)
const iconInput = ref(null)
const bgInput = ref(null)
const iconStamp = ref(0)
const bgStamp = ref(0)
const activeColorPicker = ref('')
const colorEditor = reactive({ hex: '#ffffff', alpha: 0.08 })
const showPassword = reactive({ old: false, new: false, confirm: false, smtp: false })
const savedSnapshots = reactive({})

const iconPreview = computed(() => previewUrl(form.icon, iconStamp.value))
const backgroundPreview = computed(() => previewUrl(form.bgUrl || defaultSiteBg, form.bgUrl ? bgStamp.value : 0))
const passwordDirty = computed(() => !!form.oldPassword || !!form.newPassword || !!form.confirmPassword)
const colorAlphaPercent = computed(() => Math.round(Number(colorEditor.alpha || 0) * 100))

function previewUrl(url, stamp = 0) {
  if (!url) return ''
  const normalized = normalizeAssetUrl(url)
  if (!stamp || /^data:/i.test(normalized)) return normalized
  return `${normalized}${normalized.includes('?') ? '&' : '?'}t=${stamp}`
}

function showMessage(text, type = 'success') {
  showAdminToast(text, type)
}

const cardFields = {
  brand: ['siteName', 'icon', 'bgUrl', 'bgBlur', 'overlayTop', 'overlayBottom'],
  access: ['publicDomain', 'registrationEnabled', 'registrationRequireReview', 'emailVerification', 'registrationMaxUsers', 'defaultStorageLimit'],
  password: ['oldPassword', 'newPassword', 'confirmPassword'],
  smtp: ['smtpHost', 'smtpPort', 'smtpSecurity', 'smtpUsername', 'smtpPassword', 'smtpFrom', 'smtpTestTo'],
  image: ['mediumWidth', 'mediumHeight', 'imageQuality', 'allowedFormats', 'defaultMaxFileSize'],
  security: ['recordNumber', 'httpsEnabled', 'certPath', 'keyPath']
}

function normalizeSnapshotValue(value) {
  if (Array.isArray(value)) return [...value].sort()
  return value
}

function cardSnapshot(cardKey) {
  const fields = cardFields[cardKey] || []
  return JSON.stringify(fields.map(field => [field, normalizeSnapshotValue(form[field])]))
}

function markCardSaved(cardKey) {
  savedSnapshots[cardKey] = cardSnapshot(cardKey)
}

function markAllCardsSaved() {
  Object.keys(cardFields).forEach(markCardSaved)
}

function markConfigCardsSaved() {
  Object.keys(cardFields).filter(key => key !== 'password').forEach(markCardSaved)
}

function isCardDirty(cardKey) {
  return savedSnapshots[cardKey] !== cardSnapshot(cardKey)
}

function cardBadgeText(cardKey) {
  return isCardDirty(cardKey) ? '未保存' : '已保存'
}

function cardBadgeIcon(cardKey) {
  return isCardDirty(cardKey) ? '/icons/status/warning-64x64.png' : '/icons/admin/status-ok-placeholder.svg'
}

markAllCardsSaved()

function normalizeFormats(value) {
  const incoming = Array.isArray(value) ? value : []
  const mapped = incoming.map(item => String(item || '').toLowerCase().replace('jpeg', 'jpg'))
  const allowed = formatOptions.map(item => item.key)
  const unique = [...new Set(mapped.filter(item => allowed.includes(item)))]
  return unique.length ? unique : ['jpg', 'png', 'webp', 'gif']
}

function applyForm(data = {}) {
  form.siteName = data.siteName || ''
  form.publicDomain = data.publicDomain || ''
  form.registrationEnabled = !!data.registration?.enabled
  form.registrationRequireReview = !!data.registration?.requireReview
  form.emailVerification = !!data.registration?.emailVerification
  form.registrationMaxUsers = Number(data.registration?.maxUsers || 0)
  form.recordNumber = data.recordNumber || ''
  form.httpsEnabled = !!data.https?.enabled
  form.certPath = data.https?.certPath || ''
  form.keyPath = data.https?.keyPath || ''
  form.icon = data.icon || ''
  form.bgUrl = data.background?.type === 'default' ? '' : (data.background?.value || '')
  form.bgBlur = clampNumber(data.background?.blur, 0, 100, 0)
  form.overlayTop = data.background?.overlayTop || defaultOverlayTop
  form.overlayBottom = data.background?.overlayBottom || defaultOverlayBottom
  form.mediumWidth = Number(data.mediumSize?.width || 1920)
  form.mediumHeight = Number(data.mediumSize?.height || 1080)
  form.imageQuality = clampNumber(data.imageProcessing?.quality, 40, 100, 85)
  form.allowedFormats = normalizeFormats(data.imageProcessing?.formats)
  form.defaultStorageLimit = data.defaultQuota?.storageLimit !== undefined && data.defaultQuota?.storageLimit !== null
    ? Math.round(Number(data.defaultQuota.storageLimit) / 1024 / 1024)
    : 1024
  form.defaultMaxFileSize = Number(data.defaultQuota?.maxFileSize ?? 20)
  form.smtpHost = data.smtp?.host || ''
  form.smtpPort = Number(data.smtp?.port || 587)
  form.smtpSecurity = data.smtp?.security || (data.smtp?.secure ? 'SSL/TLS' : 'STARTTLS')
  form.smtpUsername = data.smtp?.username || ''
  form.smtpPassword = data.smtp?.password || ''
  form.smtpFrom = data.smtp?.from || ''
  form.oldPassword = ''
  form.newPassword = ''
  form.confirmPassword = ''
  nextTick(markAllCardsSaved)
}

function clampNumber(value, min, max, fallback) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.min(max, Math.max(min, next))
}

function buildBackgroundConfig() {
  return {
    type: form.bgUrl ? (String(form.bgUrl).startsWith('/uploads/') ? 'upload' : 'url') : 'none',
    value: form.bgUrl || '',
    blur: clampNumber(form.bgBlur, 0, 100, 0),
    overlayTop: form.overlayTop || defaultOverlayTop,
    overlayBottom: form.overlayBottom || defaultOverlayBottom
  }
}

function buildSiteConfigPayload() {
  return {
    siteName: form.siteName || '桃图智库',
    publicDomain: form.publicDomain || '',
    recordNumber: form.recordNumber || '',
    icon: form.icon || null,
    logo: null,
    registration: {
      enabled: !!form.registrationEnabled,
      requireReview: !!form.registrationRequireReview,
      emailVerification: !!form.emailVerification,
      maxUsers: Math.max(0, Number(form.registrationMaxUsers || 0))
    },
    https: {
      enabled: !!form.httpsEnabled,
      certPath: form.certPath || '',
      keyPath: form.keyPath || ''
    },
    background: buildBackgroundConfig(),
    mediumSize: {
      width: Math.max(1, Number(form.mediumWidth || 1920)),
      height: Math.max(1, Number(form.mediumHeight || 1080))
    },
    defaultQuota: {
      storageLimit: Math.max(0, Number(form.defaultStorageLimit || 0)) * 1024 * 1024,
      maxFileSize: Math.max(0, Number(form.defaultMaxFileSize || 0))
    },
    imageProcessing: {
      quality: clampNumber(form.imageQuality, 40, 100, 85),
      formats: normalizeFormats(form.allowedFormats)
    },
    smtp: {
      host: form.smtpHost || '',
      port: Number(form.smtpPort || 587),
      secure: form.smtpSecurity === 'SSL/TLS',
      security: form.smtpSecurity || 'STARTTLS',
      username: form.smtpUsername || '',
      password: form.smtpPassword || '',
      from: form.smtpFrom || ''
    }
  }
}

function buildPublicSiteConfigCache(overrides = {}) {
  return {
    ...(readSiteConfigCache() || {}),
    siteName: form.siteName || '桃图智库',
    publicDomain: form.publicDomain || '',
    recordNumber: form.recordNumber || '',
    registration: {
      enabled: !!form.registrationEnabled,
      requireReview: !!form.registrationRequireReview,
      emailVerification: !!form.emailVerification,
      maxUsers: Math.max(0, Number(form.registrationMaxUsers || 0))
    },
    background: buildBackgroundConfig(),
    icon: form.icon || null,
    logo: null,
    mediumSize: {
      width: Math.max(1, Number(form.mediumWidth || 1920)),
      height: Math.max(1, Number(form.mediumHeight || 1080))
    },
    ...overrides
  }
}

async function reloadSiteConfig() {
  loading.value = true
  try {
    const data = await api.get('/api/admin/site-config')
    applyForm(data)
    writeSiteConfigCache(buildPublicSiteConfigCache())
    markAllCardsSaved()
    showMessage('配置已重新载入')
  } catch (err) {
    showMessage(`读取失败：${err.data?.error || err.message || '未知错误'}`, 'error')
  } finally {
    loading.value = false
  }
}

async function saveSiteConfig(successText = '配置已保存') {
  saving.value = true
  try {
    const payload = buildSiteConfigPayload()
    await api.put('/api/admin/site-config', payload)
    form.allowedFormats = normalizeFormats(form.allowedFormats)
    writeSiteConfigCache(buildPublicSiteConfigCache())
    markConfigCardsSaved()
    showMessage(successText)
    return true
  } catch (err) {
    showMessage(`保存失败：${err.data?.error || err.message || '未知错误'}`, 'error')
    return false
  } finally {
    saving.value = false
  }
}

async function saveAllChanges() {
  const configSaved = await saveSiteConfig(passwordDirty.value ? '配置已保存，正在处理密码' : '所有更改已保存')
  if (!configSaved) return
  if (passwordDirty.value) {
    const passwordSaved = await changePassword(true)
    if (passwordSaved) showMessage('所有更改已保存')
  }
}

async function changePassword(silent = false) {
  if (!form.oldPassword || !form.newPassword || !form.confirmPassword) {
    showMessage('请输入旧密码、新密码和确认新密码', 'error')
    return false
  }
  if (form.newPassword.length < 8) {
    showMessage('新密码长度至少 8 位', 'error')
    return false
  }
  if (form.newPassword !== form.confirmPassword) {
    showMessage('两次输入的新密码不一致', 'error')
    return false
  }

  changingPassword.value = true
  try {
    await api.post('/api/admin/auth/change-password', {
      oldPassword: form.oldPassword,
      newPassword: form.newPassword
    })
    form.oldPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
    markCardSaved('password')
    if (!silent) showMessage('密码修改成功')
    return true
  } catch (err) {
    showMessage(`密码修改失败：${err.data?.error || err.message || '未知错误'}`, 'error')
    return false
  } finally {
    changingPassword.value = false
  }
}

async function testSmtp() {
  if (!form.smtpTestTo) {
    showMessage('请输入测试收件邮箱', 'error')
    return
  }
  testingSmtp.value = true
  try {
    const saved = await saveSiteConfig('邮件配置已保存，正在发送测试邮件')
    if (!saved) return
    const res = await api.post('/api/admin/site-config/test-smtp', { to: form.smtpTestTo })
    showMessage(res.message || '测试邮件已发送')
  } catch (err) {
    showMessage(`发送失败：${err.data?.error || err.message || '未知错误'}`, 'error')
  } finally {
    testingSmtp.value = false
  }
}

async function handleIconUpload(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const fd = new FormData()
  fd.append('file', file)
  uploadingIcon.value = true
  try {
    const res = await api.request('/api/admin/site-config/upload-icon', { method: 'POST', body: fd })
    form.icon = res.url
    iconStamp.value = Date.now()
    writeSiteConfigCache(buildPublicSiteConfigCache({ icon: form.icon ? `${form.icon}?t=${iconStamp.value}` : null, logo: null }))
    showMessage('图标已上传')
  } catch (err) {
    showMessage(`图标上传失败：${err.data?.error || err.message || '未知错误'}`, 'error')
  } finally {
    uploadingIcon.value = false
  }
}

async function handleBgUpload(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const fd = new FormData()
  fd.append('file', file)
  uploadingBg.value = true
  try {
    const res = await api.request('/api/admin/site-config/upload-bg', { method: 'POST', body: fd })
    form.bgUrl = res.url
    bgStamp.value = Date.now()
    writeSiteConfigCache(buildPublicSiteConfigCache({
      background: { ...buildBackgroundConfig(), value: `${form.bgUrl}?t=${bgStamp.value}` }
    }))
    showMessage('背景图已上传')
  } catch (err) {
    showMessage(`背景图上传失败：${err.data?.error || err.message || '未知错误'}`, 'error')
  } finally {
    uploadingBg.value = false
  }
}

function parseRgba(value, fallback) {
  const raw = String(value || fallback)
  const rgba = raw.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\s*\)/i)
  if (!rgba) return parseRgba(fallback, 'rgba(255, 255, 255, 0.1)')
  const r = clampNumber(rgba[1], 0, 255, 255)
  const g = clampNumber(rgba[2], 0, 255, 255)
  const b = clampNumber(rgba[3], 0, 255, 255)
  const alpha = clampNumber(rgba[4] ?? 1, 0, 1, 1)
  return { r, g, b, alpha, hex: rgbToHex(r, g, b) }
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(item => Number(item).toString(16).padStart(2, '0')).join('')}`
}

function hexToRgb(hex) {
  const match = String(hex || '').match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (!match) return { r: 255, g: 255, b: 255 }
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16)
  }
}

function rgbaString(hex, alpha) {
  const rgb = hexToRgb(hex)
  const nextAlpha = Math.round(clampNumber(alpha, 0, 1, 0.1) * 100) / 100
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${nextAlpha})`
}

function rangeFillStyle(value, min = 0, max = 100) {
  const current = clampNumber(value, min, max, min)
  const percent = max > min ? ((current - min) / (max - min)) * 100 : 0
  const pct = Math.min(100, Math.max(0, percent))
  return {
    background: `linear-gradient(90deg, #ff6f9d 0%, #ff6f9d ${pct}%, rgba(255, 255, 255, 0.88) ${pct}%, rgba(255, 255, 255, 0.88) 100%)`
  }
}

function safeColor(value) {
  const parsed = parseRgba(value, defaultOverlayTop)
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${parsed.alpha})`
}

function openColorPicker(which) {
  activeColorPicker.value = which
  const parsed = parseRgba(which === 'top' ? form.overlayTop : form.overlayBottom, which === 'top' ? defaultOverlayTop : defaultOverlayBottom)
  colorEditor.hex = parsed.hex
  colorEditor.alpha = parsed.alpha
}

function applyColorPicker() {
  const nextValue = rgbaString(colorEditor.hex, colorEditor.alpha)
  if (activeColorPicker.value === 'top') form.overlayTop = nextValue
  if (activeColorPicker.value === 'bottom') form.overlayBottom = nextValue
}

watch([() => colorEditor.hex, () => colorEditor.alpha], () => {
  if (activeColorPicker.value) applyColorPicker()
})

onMounted(() => {
  reloadSiteConfig()
})

</script>

<style scoped>
.site-config-page {
  position: relative;
  min-height: calc(100vh - 96px);
  padding: 2px 0 18px;
}

.site-config-page::before {
  content: '';
  position: fixed;
  inset: 64px 0 0 220px;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(circle at 16% 8%, rgba(173, 224, 255, 0.42), transparent 30%),
    radial-gradient(circle at 92% 4%, rgba(255, 183, 211, 0.38), transparent 28%),
    linear-gradient(135deg, rgba(248, 251, 255, 0.92), rgba(255, 248, 252, 0.84) 52%, rgba(244, 251, 255, 0.92));
}

.site-config-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  min-height: 52px;
  margin-bottom: 18px;
}

.site-config-header h1 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 5px;
  color: #2f3950;
  font-size: 25px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.1;
}

.site-config-header h1 span {
  color: #9aa5b8;
  font-size: 14px;
  font-weight: 900;
}

.site-config-header p {
  color: #8994aa;
  font-size: 14px;
  font-weight: 800;
}

.global-actions {
  display: flex;
  justify-content: flex-end;
  gap: 14px;
  flex: 0 0 auto;
}

.ghost-action,
.primary-action,
.outline-action {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease;
}

.ghost-action {
  border: 1px solid rgba(224, 229, 240, 0.9);
  background: rgba(255, 255, 255, 0.62);
  color: #6e788d;
}

.outline-action {
  border: 1px solid rgba(255, 111, 157, 0.26);
  background: rgba(255, 255, 255, 0.66);
  color: #ff6f9d;
}

.primary-action {
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: linear-gradient(90deg, #ff6b9e, #ff77aa);
  color: white;
  box-shadow: 0 12px 26px rgba(255, 108, 158, 0.2);
}

.ghost-action:hover:not(:disabled),
.outline-action:hover:not(:disabled),
.primary-action:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 26px rgba(89, 96, 122, 0.1);
}

.ghost-action:disabled,
.outline-action:disabled,
.primary-action:disabled {
  opacity: 0.62;
  cursor: default;
}

.ghost-action img,
.primary-action img,
.outline-action img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.outline-action.compact {
  min-height: 34px;
  padding: 0 14px;
}

.site-config-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px 24px;
}

.site-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 392px;
  padding: 20px 20px 18px;
  border: 1px solid rgba(224, 229, 240, 0.72);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: 0 16px 38px rgba(79, 92, 124, 0.08);
  backdrop-filter: blur(22px) saturate(1.08);
}

.card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 17px;
}

.card-heading h2 {
  margin: 0;
  color: #344058;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 0;
}

.saved-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 11px;
  border-radius: 8px;
  background: rgba(225, 250, 240, 0.86);
  color: #5ebd90;
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.saved-badge.dirty {
  background: rgba(255, 248, 230, 0.9);
  color: #c98a27;
}

.saved-badge img {
  width: 16px;
  height: 16px;
}

.field-block {
  position: relative;
  display: grid;
  gap: 7px;
  margin-bottom: 14px;
  color: #566277;
  font-size: 13px;
  font-weight: 900;
}

.field-block small,
.inline-hint,
.range-field p,
.upload-copy p {
  color: #a0a9ba;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.4;
}

.soft-input {
  width: 100%;
  min-height: 36px;
  padding: 0 13px;
  border: 1px solid rgba(218, 224, 238, 0.9);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.58);
  color: #62708a;
  font-size: 14px;
  font-weight: 800;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.soft-input::placeholder {
  color: #c0c7d4;
}

.soft-input:focus {
  border-color: rgba(255, 111, 157, 0.54);
  box-shadow: 0 0 0 3px rgba(255, 111, 157, 0.1);
}

.soft-select {
  appearance: none;
  padding-right: 34px;
  background-image: url('/icons/nav/chevron-down-64x64.png');
  background-repeat: no-repeat;
  background-position: right 11px center;
  background-size: 13px 13px;
}

.brand-top-row {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(220px, 1.2fr);
  gap: 18px;
  align-items: start;
}

.field-title {
  display: block;
  margin-bottom: 8px;
  color: #566277;
  font-size: 13px;
  font-weight: 900;
}

.favicon-row,
.bg-upload-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.favicon-preview {
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(255, 205, 223, 0.58);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(255, 226, 238, 0.95), rgba(255, 255, 255, 0.78));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  color: #ff6f9d;
  font-size: 27px;
  font-weight: 900;
}

.favicon-preview img {
  width: 100%;
  height: 100%;
  padding: 5px;
  object-fit: contain;
}

.upload-copy {
  min-width: 0;
  display: grid;
  align-content: center;
  gap: 6px;
}

.upload-copy b {
  color: #5ab989;
  font-size: 12px;
  font-weight: 900;
}

.bg-preview {
  width: 208px;
  height: 94px;
  flex: 0 0 208px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(218, 224, 238, 0.72);
  border-radius: 8px;
  background: rgba(245, 248, 252, 0.8);
  color: #a4adbe;
  font-size: 13px;
  font-weight: 900;
}

.bg-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.range-field {
  display: grid;
  gap: 4px;
  margin-bottom: 10px;
}

.range-title {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
  color: #566277;
  font-size: 13px;
  font-weight: 900;
}

.range-title b {
  color: #8994aa;
  font-size: 13px;
}

.pink-range {
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  accent-color: #ff6f9d;
  cursor: pointer;
}

.pink-range::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 999px;
  background: transparent;
}

.pink-range::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -4px;
  border: 2px solid white;
  border-radius: 50%;
  background: #ff6f9d;
  box-shadow: 0 4px 10px rgba(255, 111, 157, 0.26);
}

.pink-range::-moz-range-track {
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
}

.pink-range::-moz-range-progress {
  height: 6px;
  border-radius: 999px;
  background: #ff6f9d;
}

.pink-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: 2px solid white;
  border-radius: 50%;
  background: #ff6f9d;
  box-shadow: 0 4px 10px rgba(255, 111, 157, 0.26);
}

.compact-range {
  min-width: 0;
}

.mask-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 8px;
}

.color-field {
  margin-bottom: 0;
}

.color-input-wrap {
  position: relative;
}

.color-input-wrap .soft-input {
  padding-right: 42px;
  font-size: 12px;
}

.color-trigger {
  position: absolute;
  top: 50%;
  right: 8px;
  width: 24px;
  height: 24px;
  border: 1px solid rgba(207, 214, 229, 0.9);
  border-radius: 50%;
  transform: translateY(-50%);
  cursor: pointer;
  box-shadow: inset 0 0 0 4px rgba(255, 255, 255, 0.56);
}

.color-popover {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 9px);
  z-index: 30;
  width: min(224px, calc(100vw - 48px));
  max-width: calc(100% + 18px);
  display: grid;
  gap: 12px;
  padding: 13px;
  border: 1px solid rgba(224, 229, 240, 0.9);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 20px 46px rgba(72, 84, 112, 0.16);
  backdrop-filter: blur(18px);
}

.top-popover {
  left: 0;
  right: auto;
}

.bottom-popover {
  left: auto;
  right: 0;
}

.popover-row {
  display: grid;
  grid-template-columns: 56px 1fr;
  align-items: center;
  gap: 10px;
  color: #66728a;
  font-size: 12px;
  font-weight: 900;
}

.popover-row input[type='color'] {
  width: 100%;
  height: 32px;
  border: 1px solid rgba(218, 224, 238, 0.9);
  border-radius: 8px;
  background: white;
}

.alpha-row {
  grid-template-columns: 86px 1fr;
}

.popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.popover-actions button {
  height: 28px;
  padding: 0 12px;
  border: 1px solid rgba(224, 229, 240, 0.9);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.7);
  color: #68748c;
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
}

.popover-actions button:last-child {
  border-color: rgba(255, 111, 157, 0.34);
  background: rgba(255, 241, 247, 0.88);
  color: #ff6f9d;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 38px;
  margin-bottom: 10px;
  color: #566277;
  font-size: 14px;
  font-weight: 900;
}

.pink-switch input {
  display: none;
}

.pink-switch i {
  position: relative;
  display: block;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: #dfe5ee;
  transition: background 0.18s ease;
}

.pink-switch i::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 6px rgba(75, 86, 110, 0.25);
  transition: transform 0.18s ease;
}

.pink-switch input:checked + i {
  background: #ff6f9d;
}

.pink-switch input:checked + i::after {
  transform: translateX(16px);
}

.password-input {
  position: relative;
}

.password-input .soft-input {
  padding-right: 42px;
}

.password-input button {
  position: absolute;
  top: 50%;
  right: 9px;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: none;
  background: transparent;
  transform: translateY(-50%);
  cursor: pointer;
}

.password-input img {
  width: 18px;
  height: 18px;
  opacity: 0.64;
}

.smtp-top-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 90px 130px;
  gap: 14px;
}

.two-col-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.split-footer,
.card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  margin-top: auto;
}

.split-footer {
  justify-content: space-between;
}

.mail-test {
  background: rgba(255, 248, 252, 0.82);
}

.suffix-field {
  position: relative;
}

.suffix-field .soft-input {
  padding-right: 42px;
}

.suffix-field em {
  position: absolute;
  right: 13px;
  top: 35px;
  color: #8994aa;
  font-style: normal;
  font-size: 13px;
  font-weight: 900;
}

.inline-hint {
  margin: -6px 0 12px;
}

.image-quality {
  margin: 3px 0 12px;
}

.max-size-field {
  max-width: 64%;
}

.formats-block {
  display: grid;
  gap: 10px;
  margin-bottom: 18px;
  color: #566277;
  font-size: 13px;
  font-weight: 900;
}

.format-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px 15px;
}

.format-check {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #8994aa;
  font-size: 12px;
  font-weight: 900;
}

.format-check input {
  display: none;
}

.format-check i {
  position: relative;
  width: 15px;
  height: 15px;
  border: 1px solid rgba(207, 214, 229, 0.92);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.74);
}

.format-check input:checked + i {
  border-color: #ff6f9d;
  background: #ff6f9d;
}

.format-check input:checked + i::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

@media (max-width: 1280px) {
  .site-config-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .site-config-header,
  .global-actions,
  .split-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .site-config-grid,
  .brand-top-row,
  .two-col-grid,
  .smtp-top-grid,
  .mask-grid {
    grid-template-columns: 1fr;
  }

  .max-size-field {
    max-width: none;
  }
}
</style>
