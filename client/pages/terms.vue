<template>
  <main class="legal-page page-container">
    <section class="legal-hero glass-card">
      <p class="eyebrow">Taotu Gallery Legal</p>
      <h1>服务条款</h1>
      <p>本服务条款适用于使用本站图片托管、图库索引、标签管理、相册展示、API 调用和嵌入代码等功能的访问者、注册用户、上传者以及自行部署本开源项目的部署者。</p>
      <div class="meta-row">
        <span>版本：0.3.1-pre-fix3</span>
        <span>适用地区：中华人民共和国境内及部署者实际服务地区</span>
        <span>最后更新：2026-06-30</span>
      </div>
    </section>

    <section class="legal-layout">
      <aside class="legal-toc glass-card">
        <strong>目录</strong>
        <a v-for="item in toc" :key="item.id" :href="`#${item.id}`">{{ item.title }}</a>
      </aside>

      <article class="legal-content glass-card">
        <section id="acceptance">
          <h2>一、条款接受与适用范围</h2>
          <p>当你访问、注册、上传、管理、分享、调用 API、使用外链或嵌入代码时，即表示你已阅读、理解并同意本服务条款。若你不同意本条款，请立即停止使用本站服务。</p>
          <p>本站是基于开源项目部署的图片托管与图库索引系统。开源项目作者仅提供软件代码与技术实现，不直接运营各部署站点，不参与部署者的内容审核、用户管理、数据处理或商业运营。不同部署站点可根据自身业务、地区法律和合规需求另行补充规则。</p>
        </section>

        <section id="service">
          <h2>二、服务内容与性质</h2>
          <p>本站主要提供图片上传、图片托管、缩略图与中等图生成、图片索引、标签与条件标签、相册管理、公开/私有权限、API Token、嵌入代码、WebDAV 配置同步及备份恢复等功能。</p>
          <p>本站只托管、索引和展示图片及相关元数据，不主动取得图片著作权、肖像权、商标权或其它知识产权。除法律规定或部署者另有约定外，上传者仍保留其对合法上传内容依法享有的权利。</p>
          <p>本站可能根据功能需要生成缩略图、中等图、平均色块、哈希访问地址、标签关系和相册索引，这些处理仅用于提升访问性能、展示体验和管理效率，不代表本站对图片内容作出认可、背书或授权。</p>
        </section>

        <section id="accounts">
          <h2>三、账号、权限与安全</h2>
          <p>注册用户应提供真实、准确、合法且可联系的信息，并妥善保管账号、密码、验证码、API Token 和其它访问凭据。因用户保管不善导致的上传、删除、公开、API 调用、外链传播或其它后果，由用户自行承担。</p>
          <p>部署者可根据站点管理需要设置注册开关、用户配额、公开图片规则、相册权限、API Token 权限、公告通知、备份恢复和管理员权限。普通用户不得绕过权限控制访问、下载、修改或删除他人内容。</p>
        </section>

        <section id="content">
          <h2>四、用户内容与合法合规义务</h2>
          <p>上传者和自行部署者应确保其上传、扫描、导入、公开、分享、外链或嵌入的图片及相关文字信息来源合法，并已取得必要授权或具备合法使用依据。</p>
          <p>你不得上传、存储、传播、链接、展示、调用或诱导他人访问以下内容：</p>
          <ul>
            <li>违反中华人民共和国法律法规、部门规章、公序良俗或监管要求的内容；</li>
            <li>危害国家安全、泄露国家秘密、颠覆国家政权、破坏国家统一、损害国家荣誉和利益的内容；</li>
            <li>宣扬恐怖主义、极端主义、民族仇恨、暴力、赌博、毒品、诈骗、邪教、封建迷信或其它违法犯罪活动的内容；</li>
            <li>淫秽色情、低俗擦边、未成年人不宜、侵害未成年人权益或诱导未成年人违法的内容；</li>
            <li>侵犯他人著作权、肖像权、名誉权、隐私权、商标权、商业秘密或其它合法权益的内容；</li>
            <li>含有恶意代码、钓鱼链接、木马、病毒、爬虫滥用、绕过访问限制或破坏系统稳定性的内容；</li>
            <li>未经授权抓取、批量搬运、镜像、商业化使用第三方平台图片或违反第三方服务条款的内容。</li>
          </ul>
          <p>用户或部署者因上传、导入、公开、分享、外链或使用图片引发的权利争议、行政处罚、民事赔偿、刑事责任、第三方投诉或监管处置，由相应责任主体自行承担。开源项目作者不对部署者或用户的具体内容负责。</p>
        </section>

        <section id="public-sharing">
          <h2>五、公开展示、外链与 API 使用</h2>
          <p>当用户将图片或相册设置为公开，或使用外链、HTML、BBCode、Markdown、API Token、随机图接口、嵌入接口等功能时，即表示用户理解相关内容可能被第三方访问、缓存、引用、转发或索引。</p>
          <p>用户应自行确认其公开图片适合公开传播，并自行承担因公开访问、外部引用、搜索引擎抓取、浏览器缓存、CDN 缓存或第三方平台转发产生的风险。</p>
          <p>禁止使用本站 API 或外链功能进行高频滥用、恶意爬取、攻击、刷流量、绕过权限、批量下载他人私有内容、规避第三方平台限制或从事任何违法违规活动。部署者有权限制、暂停或删除异常 Token、账号、图片、相册或访问来源。</p>
        </section>

        <section id="opensource">
          <h2>六、开源项目、部署者与责任边界</h2>
          <p>本系统为开源图片托管和智能索引项目。开源项目作者不保证所有部署站点的合法性、安全性、稳定性、内容质量、服务连续性、数据备份完整性或用户管理规范性。</p>
          <p>自行部署者是其部署站点的实际运营与管理责任主体，应根据所在地法律法规、服务器所在地规则、业务场景和用户规模，履行必要的备案、许可、内容审核、日志留存、数据安全、个人信息保护、未成年人保护和投诉处理义务。</p>
          <p>部署者应自行配置域名、备案号、HTTPS、SMTP、Redis、数据库、存储路径、备份策略、访问控制、管理员账号和内容审核流程。因部署配置错误、权限开放、弱密码、未及时更新、第三方服务异常、服务器被攻击或用户违法上传产生的后果，由部署者或相关用户自行承担。</p>
        </section>

        <section id="intellectual-property">
          <h2>七、知识产权与侵权处理</h2>
          <p>用户上传内容不代表本站或开源项目作者拥有、认可或授权该内容。用户应保证其对上传内容拥有合法权利或已取得充分授权。</p>
          <p>权利人认为本站内容侵犯其合法权益的，可向部署者提供权属证明、侵权链接、联系方式和具体理由。部署者在核实后可依法采取删除、屏蔽、取消公开、限制账号、保留证据等措施。</p>
          <p>若用户认为其内容被误删或误屏蔽，可向部署者提交反通知材料。部署者可根据法律要求、平台规则和证据情况进行处理。</p>
        </section>

        <section id="availability">
          <h2>八、服务变更、中断与数据风险</h2>
          <p>本站可能因维护、升级、迁移、备份恢复、数据库异常、网络故障、第三方服务异常、存储损坏、安全事件、监管要求或不可抗力而中断、延迟、限制或终止部分服务。</p>
          <p>部署者应自行制定备份和恢复策略。用户也应自行保存原始图片和重要数据。除法律法规另有强制规定外，本站和开源项目作者不对数据丢失、缩略图重建失败、外链失效、访问中断、缓存延迟或第三方服务故障承担超出法律规定范围的责任。</p>
        </section>

        <section id="liability">
          <h2>九、免责声明与责任限制</h2>
          <p>在法律允许范围内，本站按“现状”和“可用”基础提供服务，不承诺服务完全无错误、不中断、无安全风险、满足所有用户特定用途或永久保存任何内容。</p>
          <p>因用户或部署者违反法律法规、本条款、第三方平台规则或他人权利而导致的投诉、索赔、处罚、损失或费用，由责任方自行承担，并应使本站部署者、开源项目作者、贡献者及相关服务提供方免受损害。</p>
          <p>任何情况下，开源项目作者不因第三方自行部署、修改、运营或使用本项目而对站点内容、用户行为、数据处理、商业活动或违法违规后果承担运营者责任。</p>
        </section>

        <section id="termination">
          <h2>十、违规处理与服务终止</h2>
          <p>若用户违反本条款或存在安全风险、侵权风险、违法违规风险，部署者可在不事先通知的情况下采取警告、限制上传、取消公开、删除图片、删除标签、禁用 Token、冻结或删除账号、保留日志和向有关机关报告等措施。</p>
          <p>用户可停止使用本站服务；注册用户如需删除账号或数据，应按照部署者提供的方式申请处理。因法律法规、争议处理、审计、安全或备份要求需要保留的信息，部署者可在必要期限内依法保留。</p>
        </section>

        <section id="changes">
          <h2>十一、条款更新与联系</h2>
          <p>部署者可根据法律法规、产品功能、运营策略和安全要求更新本条款。更新后的条款在页面公布后生效；如用户继续使用本站，即视为接受更新。</p>
          <p>本页面为开源项目默认模板，部署者应根据实际主体名称、联系方式、备案信息、服务器所在地、业务类型和合规要求补充或替换为正式法律文本。</p>
        </section>
      </article>
    </section>
  </main>
</template>

<script setup>
const toc = [
  { id: 'acceptance', title: '条款接受' },
  { id: 'service', title: '服务内容' },
  { id: 'accounts', title: '账号安全' },
  { id: 'content', title: '内容合规' },
  { id: 'public-sharing', title: '公开与 API' },
  { id: 'opensource', title: '开源边界' },
  { id: 'intellectual-property', title: '知识产权' },
  { id: 'availability', title: '服务风险' },
  { id: 'liability', title: '免责声明' },
  { id: 'termination', title: '违规处理' },
  { id: 'changes', title: '条款更新' }
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
