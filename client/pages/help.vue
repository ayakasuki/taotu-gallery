<template>
  <main class="help-page page-container">
    <section class="help-hero glass-card">
      <div>
        <p class="eyebrow">Taotu Gallery Help</p>
        <h1>帮助中心</h1>
        <p>这里整理了{{ siteName }}常用功能说明、账号与上传问题、公开分享注意事项、隐私安全和部署者管理建议。本站是图片托管与图库索引系统，用户和部署者都应自行确保上传与公开内容合法合规。</p>
      </div>
      <label class="help-search">
        <img src="/icons/actions/search-64x64.png" alt="" />
        <input v-model.trim="keyword" placeholder="搜索上传、相册、标签、公开图片、API、隐私安全..." />
      </label>
    </section>

    <section class="help-contact glass-card">
      <div>
        <strong>需要联系管理员？</strong>
        <p>请优先联系当前部署站点 ID 最靠前的管理员邮箱。</p>
      </div>
      <a class="contact-mail" :class="{ loading: contact.loading }" :href="contact.email ? `mailto:${contact.email}` : undefined">
        {{ contact.email }}
        <small v-if="contact.isDefaultEmail && !contact.loading">（该管理员可能未更改用户中心邮箱，请用其他方式联系网站管理员。）</small>
      </a>
    </section>

    <section class="help-grid">
      <article v-for="category in filteredCategories" :key="category.title" class="help-card glass-card">
        <img :src="category.icon" alt="" />
        <h2>{{ category.title }}</h2>
        <ul>
          <li v-for="item in category.items.slice(0, category.expanded ? category.items.length : 4)" :key="item.title">
            <button type="button" @click="openArticle(category, item)">{{ item.title }}</button>
          </li>
        </ul>
        <button v-if="category.items.length > 4" type="button" class="more-btn" @click="category.expanded = !category.expanded">
          {{ category.expanded ? '收起' : '查看更多' }}
        </button>
      </article>
    </section>

    <section class="article-panel glass-card">
      <div class="article-head">
        <span>{{ activeCategory }}</span>
        <h2>{{ activeArticle.title }}</h2>
      </div>
      <p v-for="paragraph in activeArticle.body" :key="paragraph">{{ paragraph }}</p>
      <ul v-if="activeArticle.tips?.length">
        <li v-for="tip in activeArticle.tips" :key="tip">{{ tip }}</li>
      </ul>
    </section>
  </main>
</template>

<script setup>
const api = useApi()
const keyword = ref('')
const siteName = ref('桃图智库')
const contact = reactive({ email: '正在读取管理员邮箱...', isDefaultEmail: false, loading: true })

const siteNameHelpTitle = computed(() => `了解${siteName.value}是什么`)
const siteNameHelpBody = computed(() => [
  `${siteName.value}是自托管图片托管、图库索引和标签管理系统。站点可以用于上传图片、扫描本地路径、管理相册、生成外链和嵌入代码。`,
  '本站只托管和索引图片，不代表站点或开源项目作者拥有、认可或授权图片内容。'
])

const categories = reactive([
  {
    title: '开始使用',
    icon: '/icons/nav/gallery-64x64.png',
    expanded: false,
    items: [
      { title: siteNameHelpTitle, body: siteNameHelpBody, tips: ['上传前请确认图片来源合法。', '公开图片可能被第三方缓存、引用或转发。'] },
      { title: '注册、登录和找回密码', body: ['如果部署者开启注册，你可以通过邮箱验证码注册账号。登录后可管理自己的图片、私有标签、API Token 和账号安全。', '忘记密码时，请使用找回密码功能或联系当前部署站点管理员。'], tips: ['验证码有效期较短，请及时填写。', '请勿将密码或 Token 发送给他人。'] },
      { title: '认识公共图库、我的图库和用户图库', body: ['公共图库展示被设置为公开的图片；我的图库展示当前账号上传或拥有的图片；管理员可按用户筛选图库。', '不同部署站点可能根据运营规则限制公开、上传、搜索或 API 调用。'] },
      { title: '查看图片详情和嵌入代码', body: ['图片详情页支持缩略图、中等图、完整图切换，并提供源地址、HTML、BBCode、Markdown 等嵌入代码。', '使用嵌入代码前，请确认你有权公开和传播对应图片。'] },
      { title: '理解平均色块和懒加载', body: ['图库滚动时会先显示平均色块占位，再逐张加载中等图，以降低大量图片同时请求造成的卡顿。', '如果图片刚导入还没有缩略图，系统会在请求时按需生成派生缩略图。'] }
    ]
  },
  {
    title: '上传、导入和管理图片',
    icon: '/icons/nav/upload-64x64.png',
    expanded: false,
    items: [
      { title: '上传图片', body: ['用户可在上传页选择文件上传。上传成功后，系统会生成公开链接、缩略图、中等图和嵌入代码。', '上传者应确保图片不违反法律法规、不侵犯他人权利、不包含敏感隐私或违法内容。'] },
      { title: '自定义路径扫描导入', body: ['管理员可在综合配置/路径管理中添加本地路径并扫描入库。外部路径原图不会被移动；系统只保存索引和派生缩略图。', '删除自定义路径时，会清理该路径扫描入库的图片记录、标签关联和派生缩略图，但不会删除外部原始图片。'] },
      { title: '批量公开和批量删除', body: ['路径扫描可选择批量公开；相册设置可公开或取消公开相册内全部图片；图片管理页多选后可批量删除或批量公开/不公开。', '批量删除前请仔细确认，上传源文件可能按后端规则删除，本地扫描图片默认不删除外部原图。'] },
      { title: '缩略图、中等图和完整图区别', body: ['缩略图适合列表小图；中等图适合首页瀑布流和网格展示；完整图用于下载或高质量查看。', '自定义路径图片的派生缩略图默认保存在 data/gallery/.derived 目录。'] },
      { title: '为什么图片不显示或显示色块', body: ['如果图片仍在加载、外部路径不可读、原图被移动或缩略图正在生成，页面可能暂时显示平均色块。', '请刷新页面、检查路径权限，或联系管理员确认服务器是否能读取原图。'] }
    ]
  },
  {
    title: '相册、标签和搜索',
    icon: '/icons/gallery/tag-add-64x64.png',
    expanded: false,
    items: [
      { title: '创建和管理相册', body: ['相册可用于整理图片、设置封面、公开相册和管理相册内图片。', '相册公开不等于相册内所有图片都公开；如需统一公开，请使用“公开所有图片”。'] },
      { title: '平台标签和私有标签', body: ['平台标签用于公共管理；私有标签归用户所有。管理员编辑平台标签时不会覆盖图片所属用户的私有标签。', '普通用户只能维护自己的私有标签和互斥关系。'] },
      { title: '条件标签是什么', body: ['条件标签可按路径、排除路径、分辨率、横图、竖图、正方图等规则自动标记图片。', '定时扫描和上传后处理默认增量执行，手动立即扫描全部图片才会全量处理。'] },
      { title: '搜索和筛选图片', body: ['你可以按文件名、图库来源、相册、标签、分组和排序方式筛选图片。', '如果选择了互斥标签组合，接口会返回错误而不是静默返回空结果。'] },
      { title: '图片浏览数和排序', body: ['图片详情访问可能增加浏览数。排序方式可按最新、热门或文件名等维度展示，具体以部署站点配置为准。'] }
    ]
  },
  {
    title: 'API、外链和分享',
    icon: '/icons/nav/api-64x64.png',
    expanded: false,
    items: [
      { title: '生成和使用 API Token', body: ['登录用户可生成 API Token，用于接口认证访问自己的私有内容。管理员可管理 Token。', 'Token 等同访问凭据，请不要公开到网页、仓库、聊天记录或不可信工具。'] },
      { title: '使用图片外链', body: ['图片外链通过哈希路径访问，不暴露服务器真实路径。缩略图和中等图通过 s=thumb 或 s=medium 参数访问。', '公开外链可能被第三方缓存和转发，删除后也不保证第三方副本立即消失。'] },
      { title: '随机图片和嵌入接口', body: ['API 支持按标签、相册、方向、随机等参数获取图片。非法互斥标签组合会返回错误。', '请合理控制请求频率，禁止刷流量、恶意爬取或绕过权限访问他人内容。'] },
      { title: 'Markdown、BBCode 和 HTML 嵌入', body: ['图片详情页提供多种嵌入格式。切换缩略图、中等图、完整图后，嵌入代码会同步更新地址。'] },
      { title: '外部网站引用图片注意事项', body: ['引用图片前请确认图片允许公开传播，并遵守目标网站规则。不要使用本站托管违法、侵权、隐私或未授权图片。'] }
    ]
  },
  {
    title: '隐私、安全和法律',
    icon: '/icons/status/locked-64x64.png',
    expanded: false,
    items: [
      { title: '公开图片的隐私风险', body: ['公开图片、相册、外链和嵌入代码可能被任何获得链接的人访问，也可能被浏览器、CDN、搜索引擎或第三方网站缓存。', '请勿公开包含身份证件、住址、联系方式、精确位置、未成年人隐私或商业秘密的图片。'] },
      { title: '如何删除个人数据', body: ['你可以在账号页面修改头像、密码和部分个人信息，也可以删除自己的图片、标签或 Token。', '如需进一步删除账号或处理备份中的历史数据，请联系当前部署站点管理员。'] },
      { title: '举报违法或侵权内容', body: ['如果你认为本站图片侵犯你的著作权、肖像权、隐私权或其它合法权益，请向管理员提供具体链接、权属证明和联系方式。', '管理员核实后可删除、取消公开、限制账号并保留必要日志。'] },
      { title: '服务条款和隐私政策', body: ['请阅读页脚中的服务条款和隐私政策。部署者可根据实际主体、服务器地区、备案和运营规则补充正式文本。'] },
      { title: '开源项目责任边界', body: ['开源项目作者只提供软件代码，不直接运营各部署站点。部署者和用户应自行承担部署、上传、公开、分享和合规责任。'] }
    ]
  },
  {
    title: '部署者和管理员',
    icon: '/icons/actions/settings-64x64.png',
    expanded: false,
    items: [
      { title: '首次部署和管理员账号', body: ['服务启动会检查环境变量、数据库、迁移和首个管理员。空用户表会自动创建首个管理员。', '请尽快修改默认邮箱和密码，配置备案号、公开域名、SMTP、Redis、HTTPS 和备份策略。'] },
      { title: '数据库迁移和升级', body: ['启动时会自动执行 Knex 迁移。0.3.1 系列会自动补齐 custom_paths.make_public、albums.all_picture_public 等新增字段。', '旧 0.3.1 系列数据库升级后会自动补齐字段，默认值为 false。'] },
      { title: '备份恢复和 WebDAV', body: ['运维监控中可创建数据库和图库备份，恢复前会读取 manifest 并让管理员选择恢复项。', 'WebDAV 用于同步配置索引数据，不等于完整图片文件同步。'] },
      { title: '内容审核建议', body: ['部署者应根据所在地法律、服务器所在地和用户规模设置内容审核、投诉处理、日志留存、未成年人保护和数据安全流程。'] },
      { title: '联系信息显示规则', body: ['帮助中心展示当前部署站点 ID 最靠前管理员的邮箱。如果仍是默认邮箱，会提示用户改用其它方式联系管理员。'] }
    ]
  }
])

const activeCategory = ref(categories[0].title)
const activeArticle = ref(categories[0].items[0])

const filteredCategories = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return categories
  return categories
    .map(category => ({
      ...category,
      items: category.items.filter(item => {
        const haystack = [category.title, item.title, ...(item.body || []), ...(item.tips || [])].join(' ').toLowerCase()
        return haystack.includes(text)
      })
    }))
    .filter(category => category.items.length > 0)
})

function openArticle(category, item) {
  activeCategory.value = category.title
  activeArticle.value = item
}

onMounted(async () => {
  try {
    const siteConfig = await api.get('/api/admin/site-config/public').catch(() => null)
    siteName.value = siteConfig?.siteName || '桃图智库'
    const data = await api.get('/api/public/contact', { _: Date.now() })
    contact.email = data.email || 'admin@example.com'
    contact.isDefaultEmail = !!data.isDefaultEmail
  } catch {
    contact.email = 'admin@example.com'
    contact.isDefaultEmail = true
  } finally {
    contact.loading = false
  }
})
</script>

<style scoped>
.help-page { min-height: calc(100vh - 160px); color: #4f5b72; }
.glass-card { border: 1px solid rgba(226, 230, 241, 0.72); border-radius: 18px; background: rgba(255,255,255,0.72); box-shadow: 0 20px 56px rgba(84, 94, 120, 0.08); backdrop-filter: blur(22px) saturate(1.08); }
.help-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 460px); gap: 24px; align-items: end; padding: 34px 38px; margin-bottom: 18px; }
.eyebrow { margin: 0 0 8px; color: #f45f93; font-size: 13px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
h1 { margin: 0 0 12px; color: #2d3850; font-size: 34px; font-weight: 950; }
.help-hero p { max-width: 880px; margin: 0; color: #68748b; font-size: 15px; font-weight: 800; line-height: 1.9; }
.help-search { height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 15px; border: 1px solid rgba(226, 230, 241, 0.9); border-radius: 999px; background: rgba(255,255,255,0.86); }
.help-search img { width: 18px; height: 18px; }
.help-search input { width: 100%; border: 0; outline: none; background: transparent; color: #4f5b72; font-size: 14px; font-weight: 850; }
.help-contact { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 18px 22px; margin-bottom: 18px; }
.help-contact strong { color: #2d3850; font-size: 17px; font-weight: 950; }
.help-contact p { margin: 5px 0 0; color: #7c879c; font-size: 13px; font-weight: 800; }
.contact-mail { display: inline-flex; flex-direction: column; align-items: flex-end; color: #f45f93; font-size: 15px; font-weight: 950; text-decoration: none; }
.contact-mail.loading { color: #9aa4b8; pointer-events: none; }
.contact-mail small { max-width: 420px; margin-top: 4px; color: #9aa4b8; font-size: 12px; font-weight: 800; text-align: right; }
.help-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.help-card { padding: 26px 26px 22px; min-height: 360px; }
.help-card > img { width: 44px; height: 44px; object-fit: contain; margin-bottom: 16px; }
.help-card h2 { margin: 0 0 18px; color: #172033; font-size: 24px; font-weight: 950; line-height: 1.25; }
.help-card ul { display: grid; gap: 14px; margin: 0 0 18px; padding: 0; list-style: none; }
.help-card button:not(.more-btn) { padding: 0; border: 0; background: transparent; color: #172033; font-size: 15px; font-weight: 850; line-height: 1.55; text-align: left; cursor: pointer; }
.help-card button:not(.more-btn):hover { color: #0076b6; }
.more-btn { min-height: 38px; padding: 0 16px; border: 2px solid #172033; border-radius: 999px; background: transparent; color: #172033; font-size: 13px; font-weight: 950; cursor: pointer; }
.more-btn:hover { border-color: #f45f93; color: #f45f93; }
.article-panel { margin-top: 18px; padding: 28px 34px; }
.article-head span { color: #f45f93; font-size: 13px; font-weight: 950; }
.article-head h2 { margin: 6px 0 14px; color: #2d3850; font-size: 25px; font-weight: 950; }
.article-panel p, .article-panel li { color: #606b82; font-size: 14px; font-weight: 760; line-height: 1.95; }
.article-panel p { margin: 0 0 12px; }
.article-panel ul { margin: 8px 0 0; padding-left: 22px; }
@media (max-width: 1180px) { .help-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .help-hero { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .help-grid { grid-template-columns: 1fr; } .help-contact { align-items: flex-start; flex-direction: column; } .contact-mail { align-items: flex-start; } .contact-mail small { text-align: left; } .help-hero, .article-panel { padding: 24px; } }
</style>
