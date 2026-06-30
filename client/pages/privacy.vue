<template>
  <main class="legal-page page-container">
    <section class="legal-hero glass-card">
      <p class="eyebrow">Taotu Gallery Privacy</p>
      <h1>隐私政策</h1>
      <p>本隐私政策说明本站在提供图片托管、图库索引、用户账号、API Token、公开展示、相册管理和运维配置等功能时，可能如何收集、使用、保存、保护和处理个人信息及相关数据。</p>
      <div class="meta-row">
        <span>版本：0.3.1-pre-fix3</span>
        <span>适用对象：访问者、注册用户、上传者、部署者</span>
        <span>最后更新：2026-06-30</span>
      </div>
    </section>

    <section class="legal-layout">
      <aside class="legal-toc glass-card">
        <strong>目录</strong>
        <a v-for="item in toc" :key="item.id" :href="`#${item.id}`">{{ item.title }}</a>
      </aside>

      <article class="legal-content glass-card">
        <section id="scope">
          <h2>一、适用范围与角色说明</h2>
          <p>本站是基于开源图片托管与图库索引项目部署的服务。本隐私政策适用于本站实际部署环境中的访问、注册、上传、管理、分享、API 调用和运维配置行为。</p>
          <p>开源项目作者仅提供软件代码，不直接运营各部署站点，不控制部署者如何配置服务器、数据库、存储、域名、日志、第三方服务或用户管理规则。自行部署者应根据自身实际情况补充运营主体、联系方式、数据存储地点、个人信息保护负责人和投诉渠道。</p>
        </section>

        <section id="collection">
          <h2>二、我们可能收集的信息</h2>
          <p>为实现本站功能，部署站点可能根据配置和用户行为收集以下信息：</p>
          <ul>
            <li>账号信息：用户名、邮箱、密码哈希、头像、角色、注册时间、配额、账号状态；</li>
            <li>验证信息：图片验证码、邮箱验证码、找回密码验证码及其过期状态；</li>
            <li>图片与元数据：文件名、相对路径、哈希访问路径、图片尺寸、文件大小、MIME 类型、平均色、方向、缩略图、中等图、上传来源、公开状态、相册关系、标签关系；</li>
            <li>用户生成内容：相册名称和描述、标签名称、私有标签、条件标签、公告阅读状态、上传记录；</li>
            <li>接口与安全信息：API Token 标签、Token 创建时间、调用路径、访问时间、IP、User-Agent、接口状态、错误信息；</li>
            <li>站点配置：公开域名、备案号、SMTP、Redis、WebDAV、背景图、Logo、上传限制、默认展示模式等部署者配置；</li>
            <li>设备与日志信息：浏览器类型、操作系统、请求日志、异常日志、运维备份和恢复记录。</li>
          </ul>
          <p>本站默认不要求用户提供真实姓名、身份证号、精确地理位置、通讯录、支付信息或生物识别信息。若部署者自行扩展或接入第三方服务，应另行说明。</p>
        </section>

        <section id="use">
          <h2>三、信息使用目的</h2>
          <p>部署站点可能为以下目的使用信息：</p>
          <ul>
            <li>创建和维护用户账号，完成登录、注册、找回密码和权限隔离；</li>
            <li>保存、索引、展示、公开、隐藏、删除和管理用户上传或导入的图片；</li>
            <li>生成缩略图、中等图、平均色块、哈希 URL、嵌入代码和 API 返回结果；</li>
            <li>提供标签、相册、条件标签、公告通知、图片管理、仪表盘统计等功能；</li>
            <li>执行配额控制、安全审计、异常排查、反滥用、防攻击、防刷接口和故障恢复；</li>
            <li>根据法律法规、监管要求、争议处理、侵权投诉或司法行政机关要求进行必要处理。</li>
          </ul>
        </section>

        <section id="public">
          <h2>四、公开图片、外链和嵌入代码</h2>
          <p>当用户将图片或相册设为公开，或主动分享图片链接、缩略图链接、中等图链接、HTML、BBCode、Markdown、API 地址或随机图地址时，相关图片和元数据可能被任何获得链接的人访问。</p>
          <p>公开内容可能被浏览器、CDN、代理服务器、搜索引擎、第三方网站、社交平台或其它用户缓存、保存、转发和再次传播。即使你之后取消公开或删除内容，第三方已经缓存或保存的副本也可能无法完全撤回。</p>
          <p>请勿上传或公开包含敏感个人信息、他人隐私、未成年人信息、证件信息、精确位置、商业秘密或未经授权肖像的图片。因用户自行公开造成的后果由用户自行承担。</p>
        </section>

        <section id="storage">
          <h2>五、存储、缩略图与备份</h2>
          <p>本站图片通常保存在部署者配置的本地图库、上传目录或自定义路径中。数据库保存图片索引、标签关系、相册关系、公开状态和哈希路径，不对外暴露真实本地路径。</p>
          <p>为提升访问性能，本站会生成缩略图和中等图。外部自定义路径导入的图片可能在 `data/gallery/.derived/&lt;源图路径hash&gt;/` 生成派生缩略图，不会在外部原始目录写入 `.thumbs`。删除自定义路径时，系统会清理对应派生缩略图和数据库索引，但不会删除外部原始图片。</p>
          <p>部署者可使用备份恢复功能导出数据库和本地图库文件。备份包可能包含个人信息、图片文件、路径索引、标签关系和站点配置，部署者应妥善保管、加密存储并限制访问。</p>
        </section>

        <section id="cookies">
          <h2>六、Cookie、本地存储与 Token</h2>
          <p>本站可能使用浏览器本地存储或 Cookie 保存登录状态、JWT、界面偏好、验证码状态、通知状态或其它必要信息。API Token 可用于接口认证，用户应妥善保管，不应公开粘贴到不可信页面或第三方工具。</p>
          <p>若用户清除浏览器数据、退出登录或 Token 被删除，部分登录状态、偏好设置或接口访问能力可能失效。</p>
        </section>

        <section id="third-party">
          <h2>七、第三方服务</h2>
          <p>部署者可能配置 SMTP 邮件服务、Redis、WebDAV、CDN、反向代理、对象存储、日志平台、统计工具或其它第三方基础设施。这些第三方服务可能根据其自身规则处理必要的数据。</p>
          <p>开源项目作者不控制部署者选用的第三方服务，也不对第三方服务的数据处理、可用性、安全性或合规性承担责任。部署者应自行审查第三方服务条款和隐私政策。</p>
        </section>

        <section id="sharing">
          <h2>八、信息共享、转让与披露</h2>
          <p>除以下情形外，部署站点通常不会主动向无关第三方出售用户个人信息：</p>
          <ul>
            <li>用户主动公开、分享、嵌入或通过 API 调用输出的信息；</li>
            <li>为提供邮件、缓存、存储、备份、CDN、安全防护、日志分析等必要服务而向服务提供方提供必要信息；</li>
            <li>为处理侵权投诉、安全事件、争议解决、用户请求或服务维护所必需；</li>
            <li>根据法律法规、司法机关、行政机关、监管部门或网络安全要求必须提供；</li>
            <li>部署主体发生合并、分立、转让、清算或资产处置时，在依法告知或确保受让方继续受本政策约束的前提下转移必要数据。</li>
          </ul>
        </section>

        <section id="rights">
          <h2>九、用户权利</h2>
          <p>在符合法律法规和部署者规则的前提下，用户可请求访问、更正、删除、取消公开、导出或限制处理其账号信息和上传内容。注册用户可在站内管理图片、标签、相册、头像、密码和 API Token。</p>
          <p>对于备份、日志、安全审计、争议处理或法律要求必须保留的信息，部署者可能无法立即删除，但应在必要范围和期限内保存。</p>
        </section>

        <section id="security">
          <h2>十、安全措施与用户责任</h2>
          <p>本站提供哈希化图片 URL、权限隔离、JWT、密码哈希、Redis 验证码、API Token、公开/私有状态、备份恢复和管理权限等基础能力。部署者应进一步配置 HTTPS、强密码、数据库权限、服务器防火墙、备份加密、访问日志和安全更新。</p>
          <p>任何互联网服务都无法保证绝对安全。因用户弱密码、Token 泄露、公开分享、浏览器缓存、第三方网站引用、部署配置错误、服务器被攻击或第三方服务异常造成的损失，由相应责任方依法承担。</p>
        </section>

        <section id="children">
          <h2>十一、未成年人保护</h2>
          <p>未成年人应在监护人同意和指导下使用本站。用户不得上传、传播、诱导生成或公开任何侵害未成年人权益的图片或信息。部署者发现相关违法违规内容后，应及时删除、屏蔽、保留证据并依法处理。</p>
        </section>

        <section id="opensource">
          <h2>十二、开源项目责任边界</h2>
          <p>本隐私政策中的“本站”指实际部署和运营该服务的网站。开源项目作者不直接收集、存储或处理各部署站点的用户数据，也无法控制部署者服务器上的数据使用方式。</p>
          <p>部署者应根据其所在地区、服务器所在地和实际用户范围，自行补充正式隐私政策、联系方式、个人信息处理者身份、跨境传输说明、数据保存期限和投诉渠道。因部署者未履行个人信息保护义务产生的责任，由部署者自行承担。</p>
        </section>

        <section id="changes">
          <h2>十三、政策更新与联系</h2>
          <p>部署者可根据法律法规、功能变化、安全要求和运营策略更新本隐私政策。更新后将在本页面公布；用户继续使用本站即表示接受更新后的政策。</p>
          <p>本页面为开源项目默认模板，部署者应在正式上线前根据实际情况补充运营主体名称、联系方式、投诉邮箱、备案信息和数据保护负责人。</p>
        </section>
      </article>
    </section>
  </main>
</template>

<script setup>
const toc = [
  { id: 'scope', title: '适用范围' },
  { id: 'collection', title: '收集信息' },
  { id: 'use', title: '使用目的' },
  { id: 'public', title: '公开与外链' },
  { id: 'storage', title: '存储备份' },
  { id: 'cookies', title: 'Token 与本地存储' },
  { id: 'third-party', title: '第三方服务' },
  { id: 'sharing', title: '共享披露' },
  { id: 'rights', title: '用户权利' },
  { id: 'security', title: '安全措施' },
  { id: 'children', title: '未成年人' },
  { id: 'opensource', title: '开源边界' },
  { id: 'changes', title: '政策更新' }
]
</script>

<style scoped>
.legal-page { min-height: calc(100vh - 160px); color: #4f5b72; }
.glass-card { border: 1px solid rgba(226, 230, 241, 0.72); border-radius: 18px; background: rgba(255,255,255,0.72); box-shadow: 0 20px 56px rgba(84, 94, 120, 0.08); backdrop-filter: blur(22px) saturate(1.08); }
.legal-hero { padding: 34px 38px; margin-bottom: 18px; }
.eyebrow { margin: 0 0 8px; color: #f45f93; font-size: 13px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
h1 { margin: 0 0 12px; color: #2d3850; font-size: 34px; font-weight: 950; }
.legal-hero p { max-width: 920px; margin: 0; color: #68748b; font-size: 15px; font-weight: 800; line-height: 1.9; }
.meta-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
.meta-row span { padding: 7px 11px; border-radius: 999px; background: rgba(255, 241, 247, 0.82); color: #f45f93; font-size: 12px; font-weight: 900; }
.legal-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 18px; align-items: start; }
.legal-toc { position: sticky; top: 92px; display: grid; gap: 4px; padding: 16px; }
.legal-toc strong { color: #2d3850; font-size: 15px; font-weight: 950; margin-bottom: 8px; }
.legal-toc a { padding: 8px 10px; border-radius: 10px; color: #6d7890; text-decoration: none; font-size: 13px; font-weight: 850; }
.legal-toc a:hover { background: rgba(255, 241, 247, 0.86); color: #f45f93; }
.legal-content { padding: 30px 36px; }
.legal-content section { scroll-margin-top: 100px; padding-bottom: 24px; margin-bottom: 24px; border-bottom: 1px solid rgba(226, 230, 241, 0.72); }
.legal-content section:last-child { border-bottom: 0; margin-bottom: 0; padding-bottom: 0; }
h2 { margin: 0 0 12px; color: #2f3a52; font-size: 22px; font-weight: 950; }
p, li { color: #606b82; font-size: 14px; font-weight: 760; line-height: 1.95; }
p { margin: 0 0 12px; }
ul { margin: 8px 0 0; padding-left: 22px; }
li { margin: 6px 0; }
@media (max-width: 980px) { .legal-layout { grid-template-columns: 1fr; } .legal-toc { position: static; } .legal-hero, .legal-content { padding: 24px; } h1 { font-size: 28px; } }
</style>
