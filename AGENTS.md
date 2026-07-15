# AGENTS.md — 桃图智库 (taotu-gallery)

## 项目概述

全栈图床 + 智能标签管理平台，支持 AI 标签扩展、条件自动标签、标签分组、参数化 API、多用户隔离。

**AI 状态：** 自标签（YOLOv8）暂不启用。`aiTagService.js` 和 `modelService.js` 为桩实现，预留接口供未来接入远程多模态视觉大模型。`models` 表 `is_enabled` 默认 FALSE。

## 需求来源

- 需求文档：`tmp/图库与智能索引集成系统-开发需求文档.md`（979 行，思维导图导出）
- 开发计划：`tmp/开发计划.md`

## 技术栈

| 层 | 选型 |
|---|---|
| 后端 | Node.js 18+ / 原生 ES Module 纯 JS（不用 TS）/ Express / Knex.js / MySQL |
| 前端 | Nuxt 3 / Vue 3 Composition API / PrimeVue 风格 Fluent Design |
| 文件监听 | chokidar |
| 图片处理 | sharp（缩略图/颜色/分辨率） |
| 认证 | JWT + bcryptjs + Redis 验证码 |
| 邮件 | nodemailer（SMTP 测试、注册验证码、忘记密码验证码） |
| 缓存/验证码 | redis（图片验证码、邮箱验证码 TTL） |
| 云同步 | WebDAV |
| 备份 | archiver / unzipper |

## 关键约束（容易遗漏）

1. **路径必须相对化** — `images.path` 存相对路径（基准：项目根目录）。备份恢复时绝对路径强制转相对。
2. **标签来源必须记录** — `image_tags.source` 必须为 `manual` / `ai` / `condition`，用于选择性重标签。
3. **不可组合标签双端校验** — 前端 UI 层阻止互斥选择，后端 API 返回 `400`。
4. **覆盖式 vs 非覆盖式** — 严格区分，覆盖式会删除目标 source 的旧标签。
5. **所有配置存储在数据库** — 标签/条件/路径/网站配置全部存储在数据库，不使用 JSON 文件。
6. **图片 URL 哈希化** — 对外路径为 `image/日期/16位hash.ext`，不暴露真实路径。
7. **API 内外分离** — `/api/internal/*` 前端内部用，`/api/*` 对外 API，不暴露本地路径。
8. **标签 ID 全局唯一** — `tags` 表自增 ID，`user_tags` 表自增 ID（加 `u` 前缀区分），`tag_groups` 子分组 `sid` 全局唯一。
9. **条件标签写入 image_tags 时** — `tag_id` 引用 `tags` 表的 ID，不是 `conditions` 表的 ID；优先使用 `conditions.tag_id`，旧数据才回退 `cond_type_name` 查找。
10. **嵌入代码 12 种组合** — 4 格式（源/HTML/BBCode/Markdown）× 3 尺寸（缩略/中等/完整）。
11. **首页展示只保留网格/瀑布流** — 禁止恢复静态/轮播入口；后台图库展示配置、`SortFilter`、`useGallery` 都必须只接受 `grid` / `waterfall`。
12. **网格也是贴合式图片墙** — 网格模式不是 CSS Grid 行布局，必须使用最短列定位；横图按 1:1，竖图同宽按比例增高，避免行高空洞。
13. **瀑布流 hover 只影响当前卡片** — CSS 选择器必须限定 `.image-card.mode-waterfall:hover`，不要让父级 hover 触发所有图片信息层。
14. **首页默认展示走公开配置** — 首页读取 `/api/gallery/config` 的 `display.mode`；后台保存瀑布流后，未登录访客也应默认瀑布流。
15. **首页图片必须渐进加载** — 网格和瀑布流都先显示按原比例计算好的平均色块占位，首页卡片定稿为优先请求 `medium_url` 保证清晰度，图片请求由前端队列逐张执行，不要恢复一次性并发加载或改回过糊的缩略图。
16. **首页卡片禁止位移动画** — 新增图片只能在已计算好的画框位置原地淡入，不允许通过 `transform` 过渡从页面上方或中间移动到目标位置。
17. **网格滚动要保持轻量** — 网格模式的标题、上传者、标签等额外信息层按需渲染；避免在大量图片常态滚动时使用 `backdrop-filter`、重滤镜和全量常驻浮层。
18. **启动必须先自检再加载 app** — `server/index.js` 必须先执行 `startupService.bootstrap()`，完成 env 校验、数据库检查、迁移和首个管理员初始化后再 `require('./app')`。
19. **未配置数据库禁止启动** — `DB_HOST`、`DB_USER`、`DB_NAME`、`JWT_SECRET` 缺失或 `JWT_SECRET` 仍为示例值时必须直接失败，不允许回退到 root/localhost 默认库。
20. **启动自动迁移，不自动 seed** — 服务启动会跑 `db.migrate.latest()`；不要在启动流程跑 `seed:run`，旧 seed 会清空 `users` 表。
21. **首个管理员不能使用公开固定密码** — 空用户表时自动创建首个管理员；`DEFAULT_ADMIN_PASSWORD` 为空则生成一次性随机密码并打印日志。
22. **互斥标签字段是字符串** — `tags.mutually_exclusive_with` 必须是 `varchar`，迁移 `20240115000001_change_mutual_exclusive_to_string.js` 必须执行。支持多个 ID、`.`/`,`/中文标点/空白分隔，用户标签 ID 允许 `u13`。
23. **互斥标签按组闭包保存** — 例如标签 6 设置 `3,4` 后，3/4/6 三者必须互相写入互斥关系。清空某标签互斥关系时，前端需同步从其它标签互斥列表移除该标签。
24. **标签筛选 API 必须校验互斥参数** — 对外 `/api/images*`、`/api/embed/*` 和内部图库接口使用 `server/utils/tagConflict.js`，非法组合返回 `400 JSON`，不要只返回空结果。
25. **用户私有标签不可误删** — 管理员维护图片平台标签时不能覆盖或删除图片所属用户已有私有标签；如需维护用户私有标签，走独立的用户私有标签接口。
26. **上传返回公网 URL** — 上传成功返回和嵌入代码必须使用 `imageService.getPublicBaseUrl()`，不能写死 `localhost`。
27. **横竖图条件互斥** — 横图、竖图、正方图自动判定三选一；宽高比接近 `0.9-1.1` 或 `1:1` 归为正方图。
28. **自定义路径只以数据库为准** — `custom_paths` 表是持久化来源，不回退写 JSON；刷新页面后必须从数据库恢复条目。
29. **用户私有标签权限隔离** — `user_tags` 有 `is_public`、`combinable` 和 `mutually_exclusive_with` 字段；普通用户只能配置自己拥有的私有标签名称、可组合和互斥，仪表盘与普通用户 API 禁止设置 `is_public`，也禁止绑定管理员或其他用户标签；管理员后台可以把自己拥有的 `uXX` 用户私有标签当作系统标签一样切换公共状态，并且必须持久化到 `user_tags.is_public`。
30. **普通用户绝不能越权后台和私有媒体** — `/admin` 页面、后台导航、后台数据和所有站点级编辑能力只允许 `role=admin`；普通用户即使用 curl、手改 URL、复用 JWT/session，也不能访问或看到综合配置、条件标签、数据库、备份、云同步、用户管理、站点配置、平台标签等任何后台页面/API/数据。普通用户功能只能放在仪表盘或普通用户专属 API，后端必须同时做角色鉴权和资源所有权校验，不能只靠前端隐藏按钮；`/image/*` 与 `/thumb/*` 这类 hash 媒体直链也必须校验公开状态、公共相册、所有者或管理员，不能把 hash 当成权限。
31. **验证码依赖 Redis** — 图片验证码、注册邮箱验证码、忘记密码验证码均写 Redis，TTL 120 秒；邮箱验证码必须是 2 个数字 + 3 个英文乱序。
32. **SMTP 配置在数据库** — `site_config.smtp` 存 SMTP，测试邮件/注册邮件/忘记密码邮件统一走 `mailService.js`。
33. **前台不能自定义后端地址** — 已删除 `/settings` 和 connection-check 插件；前后端连接由部署与后台维护，不再允许用户在前台写 backend_url。
34. **备案号在 site_config** — `recordNumber` 由网站配置保存，公开配置接口返回，默认布局页脚展示。
35. **条件标签定时扫描必须增量** — 定时任务、上传后、路径扫描后只处理尚未拥有对应条件标签的候选图片；只有后台“立即扫描所有图片”允许 force 全量重扫。
36. **分辨率条件档位互斥** — `below1080p` / `1080p` / `2k` / `4k` 四档覆盖全部图片；4K 档包含 4K 以上，不再细分 8K。
37. **默认网站背景** — 新部署无背景配置时公开配置返回 `/site_bg.png`；已有自定义背景刷新时不能先闪默认图再切自定义图。
38. **背景模糊与遮罩** — 首页背景模糊通过 `.taotu-shell` 的 `backdrop-filter` 实现，`.taotu-shell` 不再叠加额外背景色；背景明暗由 `site_config.background.overlayTop/overlayBottom` 控制。
39. **页面转场必须分层** — 子页面 Q 弹动画只能作用在内容层，不能直接动画带背景图、`::before` 粉蓝底图、`backdrop-filter` 或固定模糊背景的页面根；图片详情需等 `.detail-bg img` 完成或缓存确认后立即触发 `.detail-shell` 动画，后台子页由 `admin-main` 监听路由切换后只动画页面根下一级内容；新增面板遇到背景模糊延迟时优先拆“背景静态层 + 内容 motion 层”。
40. **公告通知必须数据库驱动** — 公告存 `announcements`，已读状态存 `announcement_reads`；后台删除公告后用户通知同步消失。
41. **备份恢复必须真实可用** — 数据库备份导出整库，本地图库备份包含真实图片文件；恢复前必须读取 manifest 并让用户选择实际支持的恢复项。
42. **全局提示统一 toast** — 登录、后台配置、图片/标签/条件等普通成功失败提示统一复用导航下方胶囊 toast；不要再新增散落的行内 alert。
43. **前台主导航保持简洁** — 默认布局主导航按钮只保留文字，不再显示栏目图标；登录、通知、用户胶囊等独立控件可以保留自己的图标。
44. **图库首页透明导航只在顶部生效** — 仅 `/` 页面滚动到顶部时隐藏导航背景/模糊/分隔线并让主导航文字变白；离开顶部或进入其它页面必须恢复常规玻璃导航。默认布局导航使用自定义 `currentPath` 和精确 active，不依赖 Nuxt 默认 `router-link-active`，避免 `/` 路由影响相册/API/上传/仪表盘。
45. **导航左右端跟随页面容器** — `brand-link` 和通知/用户区应通过默认布局内的 `nav-frame` 对齐图库、相册、API 文档、上传、仪表盘等页面主体左右边界，宽屏不要贴浏览器边缘。
46. **前端图标统一走 TaotuIcon** — 控制类图标必须使用 `client/components/TaotuIcon.vue` + `@boxicons/vue`，不要新增 PNG/SVG 文件路径、emoji、字符伪图标或 CSS 画圆点图标；旧 PNG 占位只允许作为真实图片/动图/品牌资产，不允许回到按钮图标。
47. **图标状态必须线性/填充分层** — 普通状态默认 basic/regular 线性图标，选中、hover、active、fill 状态才显示 filled 图标；图标颜色必须继承当前按钮/文字颜色。侧边栏渐变选中态可白色，粉色文字选中态图标必须跟随粉色，不要一律强制白色。
48. **插画图标不套按钮染色规则** — 管理后台概览、运维监控、仪表盘统计、帮助中心等大号插画图标可以保持自身色彩或使用对应卡片淡色主题；不要套用按钮 fill 白色规则。统计卡片图标通常为 32px/48px，快捷操作小图标通常为 20px。
49. **下拉框统一使用 TaotuSelect** — 禁止新增原生 `<select>`；全站选择器必须使用 `client/components/TaotuSelect.vue`，支持副描述、选中勾、hover title、展开/收起动画、最多 4 项无滚动、超出后内部滚动，以及根据视口空间自动向上/向下弹出。
50. **下拉样式不能回退粗糙版** — 下拉菜单宽度必须等于触发框，边框 `2px`、圆角 `8px`、内部上下留白一致；选项是小字号粗体精致胶囊，字号可自适应缩小，不能比触发框更粗更大，也不能出现菜单比触发框宽一截。
51. **导航右上角弹窗对齐新版下拉语言** — 通知和用户胶囊 hover 菜单必须使用精致小卡片：`2px` 边框、`8px` 圆角、小字号粗体；用户菜单宽度跟随用户胶囊，通知菜单宽度约等于通知按钮 + 用户胶囊组合宽度；菜单内图标最大边等于当前字体高度。
52. **toast 胶囊图标统一** — 登录、注册、后台保存、错误、警告、成功等 toast 使用 `AdminToast` 和 `TaotuIcon`，成功/警告/错误分别使用圆形勾、警告、叉/禁止类图标，图标颜色跟随 toast 主题色；不要新增散落行内 alert 或无图标 toast。
53. **密码输入眼睛一致** — 登录页、注册页、忘记密码、用户中心、云同步等密码框必须使用内嵌右侧 eye/eye-off 图标按钮；不要使用独立圆形按钮或文字“显示密码”破坏排版。
54. **复选框统一走 Boxicons** — 图库首页、仪表盘、后台图片管理、后台标签管理等复选框必须使用 `checkbox` / `checkbox-checked` 图标，主尺寸当前为 `20px`；不要恢复原生伪勾、CSS 手画勾或过小 14px 外壳。
55. **确认弹窗关闭按钮主题化** — 删除/高风险确认统一使用 `ConfirmDeleteDialog`；关闭按钮默认主题粉底白色 X，hover 时 X 变深色，不要恢复绿色底或其它不符合粉色主题的关闭按钮。
56. **人工标签 hover 预览可复用** — 管理员人工标签和仪表盘人工标签使用 `client/components/ManualImageHoverPreview.vue`；预览固定宽 320px，优先 `medium_url`，自动判断上/下方和左右边界。后续新增人工打标入口必须复用该组件，不要重复写浮层。
57. **前端会话采用被动验证** — 页面切换和普通 `onMounted` 不要主动调用 `/api/admin/auth/me` 造成“需要登录/正在验证管理员权限”闪烁；默认布局、上传页、仪表盘和后台布局先用本地有效 JWT/缓存恢复状态，真正会话有效性由后端 API 返回 `401` 或会话失效类 `403` 后通过 `useApi` 统一 `clearAuthSession()`、广播 `taotu:auth-invalid` 并要求重新登录。
58. **WebDAV 必须动态导入** — `webdav` 当前为 ESM 包，CommonJS 后端服务不能在顶层 `require('webdav')`；必须通过 `import('webdav')` 按需加载并缓存 Promise，否则 PM2 启动会直接失败。
59. **数字胶囊必须自适应宽度** — 图片数量、浏览数、标签数量、分页/标签 tab 等胶囊或按钮出现数字时必须 `width:max-content` / `white-space:nowrap` / `font-variant-numeric:tabular-nums`，不能按两三位数字写死宽度导致四位数溢出。
60. **相册详情网格分页按列数计算** — `/albums/:id` 网格模式每页数量必须根据实际容器列数计算，保证第一页尽量填满；不要恢复固定 24 张导致宽屏尾部空出多个图片位。
61. **后端必须保持原生 ESM** — 根包启用 `"type":"module"`，`server/**/*.js`、迁移、seed、`knexfile.js` 必须使用 `import/export`；禁止新增 `require()` / `module.exports` / `exports.*`。相对导入必须写完整 `.js` 或 `/index.js`，目录导入不可依赖 CommonJS 解析。
62. **启动顺序不能被静态导入破坏** — `server/index.js` 必须先 `await startupService.bootstrap()`，再动态 `import('./app.js')`；不要把 `app` 静态 import 到入口顶部，否则会绕过启动自检、迁移和首个管理员初始化顺序。
63. **ESM 路径写法固定** — 需要 `__dirname` 的文件使用 `fileURLToPath(import.meta.url)` + `path.dirname()`；读取 `package.json` 优先用 `fs.readFileSync` + `JSON.parse`，兼容 Node 18/24，不使用 JSON import assertion/attribute。
64. **Knex CLI 不加旧 --esm** — 当前 Knex 可原生读取 ESM `knexfile.js`，`npm run migrate` 保持 `knex migrate:latest`；不要加 `--esm`，旧 `esm` loader 在 Node 24 会报错。
65. **移动端重适配后置** — 当前 `0.3.2-pre` 系列以桌面端主要流程稳定为准；移动端主副标题拆分、面板收纳和窄屏重排属于后续 `0.4.x` 迭代，再稳定进入 `1.0.0`。
66. **相册隐藏主页图库只影响首页** — `albums.hide_from_gallery` 是 `0.3.2-pre` 的相册级主页可见性开关；开启后该相册图片必须从首页公共图库、我的图库和管理员用户图库列表/统计里排除，但不能影响相册详情、图片详情、随机图 API、图片公开属性和已有外链访问逻辑。
67. **上传与图片处理迁移到用户组** — `0.3.2-pre` 起最大文件大小、并发上传、周期上传限额、路径命名、文件命名、中等图尺寸、图片质量和允许格式都归 `user_groups` 管理；不要再把这些能力恢复为站点配置里的全局“上传与图片处理”卡片。新用户注册和首个管理员初始化必须自动进入默认用户组。
68. **存储策略只允许管理员配置** — `storage_strategies` 是管理员后台能力，普通用户 API 必须 403；默认本地策略自动创建且不可删除，挂载类型创建后不可修改。当前本地策略已真实参与上传路径，COS/OSS/FTP/SFTP 先保留配置入口，未接入上传流时必须明确拒绝而不是静默落回错误位置。
69. **NSFW 状态必须参与公开展示门禁** — `images.nsfw_status=true` 的图片对非管理员公开图库、相册、随机图 API 和 `/image`/`/thumb` 直链都不能公开展示；所有者/管理员的管理视图可以看到记录。审核服务在 `server/services/nsfwService.js`，上传后同步尝试标记，定时任务只补扫 `NULL` 状态，不要把未审核/不健康内容当普通公开图外泄。
70. **自定义路径删原图必须显式授权** — `custom_paths.allow_delete` 默认 `false`；删除自定义路径扫描入库图片时，默认只删数据库记录、`image_tags` 和 `data/gallery/.derived` 派生缩略图，不删外部原图。只有后台路径配置开启“管理图片删减”后，图片管理/用户删除等删除操作才允许同步删除该路径原始文件。已配置路径可编辑绑定相册、绑定标签、批量公开和删减开关，但路径字符串本身必须锁定不可改。
71. **上传页目标相册必须双端隔离** — `client/pages/upload.vue` 管理员上传使用“目标图库 / 用户图库 / 目标相册”三联 `TaotuSelect`，默认“我的图库”；“全部”显示全部用户相册，“用户图库”先选用户再选该用户相册。普通用户只显示自己的目标相册。后端 `/api/upload` 必须校验普通用户只能上传到自己相册，管理员才可上传到任意相册。新标签输入按 Enter 必须加入 `uploadConfig.newTags` 暂存；上传结果必须显示每张图实际 `storage_strategy_name`。

## 项目结构

```
├── server/              # 后端 Express
│   ├── app.js           # 应用入口（服务 API + 前端静态文件）
│   ├── index.js         # 启动（先自检/迁移，再支持 HTTP/HTTPS）
│   ├── config/          # 配置
│   ├── db/migrations/   # Knex 迁移
│   ├── middleware/       # auth / requireAdmin / errorHandler / apiToken / apiLogger
│   ├── routes/api/      # 对外 API（images/albums/tags/embed/upload）
│   ├── routes/internal/ # 前端内部 API（images/albums）
│   ├── routes/admin/    # 管理 API（18+ 端点）
│   ├── services/        # 业务逻辑（startupService 负责首启自检/迁移）
│   ├── utils/           # pathUtils / imageProcessor / tagDiff
│   └── validators/      # 请求校验
├── client/              # 前端 Nuxt 3
│   ├── pages/           # 文件路由
│   ├── components/      # gallery / tags / embed / upload / admin
│   ├── composables/     # useApi / useAuth / useTags / useGallery
│   ├── stores/          # Pinia
│   └── assets/css/      # Fluent Design 变量
├── data/                # 运行时数据（gitignore）
│   ├── gallery/         # 本地图库
│   ├── uploads/         # 上传存储
│   ├── backups/         # 备份输出
│   └── config/          # 已迁移到数据库，此目录保留为空
├── pm2/                 # PM2 部署配置
│   ├── pm2.json         # PM2 进程配置（可自定义端口）
│   └── start.sh         # 一键启动脚本
└── tmp/                 # 文档
```

## 数据库（18+ 张表）

| 表 | 用途 |
|---|------|
| `images` | 图片信息、路径、哈希路径、公共标记、上传者 |
| `albums` | 相册信息、公共标记、创建者、封面 |
| `tags` | 标签定义、可组合性、互斥关系、公共标记 |
| `user_tags` | 用户私有标签（user_id、is_public、combinable、mutually_exclusive_with） |
| `user_groups` | 用户组上传限制、图片处理规则、命名规则和 NSFW 审核配置 |
| `storage_strategies` | 用户组关联的本地/COS/OSS/FTP/SFTP 存储策略配置 |
| `image_tags` | 图片-标签关联（支持 user_tag_id） |
| `album_tags` | 相册-标签关联 |
| `models` | AI 模型记录（桩，暂未启用） |
| `conditions` | 条件标签配置 |
| `tag_groups` | 标签分组（subgroups JSON 含全局唯一 sid） |
| `custom_paths` | 自定义外部图库路径 |
| `site_config` | 网站配置（key-value 存储） |
| `api_tokens` | API Token（关联用户） |
| `users` | 用户账号、角色、配额 |
| `upload_logs` | 上传日志 |
| `api_logs` | API 调用日志 |
| `site_metrics` | 网站统计指标 |
| `announcements` | 公告中心内容、草稿、置顶 |
| `announcement_reads` | 用户公告已读状态 |

## 开发命令

```bash
# 后端
npm install
npm run dev                  # 启动开发服务器；启动时自动检查数据库并执行迁移

# 前端
cd client && npm install
npx nuxt generate            # 构建静态文件

# PM2 一键启动（推荐生产环境）
pm2 start pm2/pm2.json       # 启动
pm2 stop pm2/pm2.json        # 停止
pm2 restart pm2/pm2.json     # 重启
pm2 logs                     # 查看日志
```

## 开发阶段

Phase 1-5 后端 → Phase 6-8 前端 → Phase 9 集成测试。详见 `tmp/开发计划.md`。

## 当前实现状态（v0.3.2-pre）

> v0.3.2-pre 是 0.3.1 正式版后的预备功能线：大框架和业务接口保持稳定，在后端 ES Module、无感会话、权限隔离、私有媒体门禁、页面 Q 弹转场、人工标签预览、WebDAV 启动兼容、Boxicons 图标体系与精致下拉/弹窗 UI 规范基础上，继续追加相册级主页可见性、用户组、存储策略、NSFW 审核骨架、自定义路径删减开关和上传页管理员目标图库选择。

- 访客端和普通用户端已统一新版视觉：默认布局、导航、页脚、首页图库、相册、图片详情、上传、API 文档、登录、注册和仪表盘均已重构。
- 默认布局主导航已去掉栏目图标；图库首页顶部透明导航只在 `/` 且滚动位于顶端时启用，离开顶部或进入相册/API/上传/仪表盘后立即恢复玻璃导航。主导航 active 使用自定义精确匹配和点击即时同步，避免首次点击路由后按钮不亮或 `/` 默认匹配串路由。
- 控制类图标统一通过 `TaotuIcon` 渲染 `@boxicons/vue`，默认线性、状态填充、颜色继承；按钮、侧边栏、toast、复选框、信息提示和下拉项不要再使用 PNG 占位或字符伪图标。旧 PNG/SVG 占位资源已清理，除详情加载 GIF、站点背景等真实资产外，不应新增控制类图标文件。
- `TaotuSelect` 已替换全站原生下拉框，统一支持副描述、选中勾、自动上下弹出和小卡片动画；菜单宽度等于触发框，边框 `2px`，圆角 `8px`，选项最多 4 项无滚动，超出后内部滚动。
- 右上角通知/用户胶囊弹窗已统一成精致下拉样式：用户菜单跟随用户胶囊宽度，通知菜单按通知按钮与用户胶囊组合宽度计算，图标最大边等于文字高度。
- 登录、注册和忘记密码密码框已补齐内嵌 eye/eye-off 图标；后续新增密码框也必须沿用该排版。复选框统一为 Boxicons `checkbox` / `checkbox-checked`，主尺寸为 `20px`。
- 管理后台主要入口已重构：概览、图片管理、标签设置、条件标签、站点配置、综合配置、运维监控、用户管理、公告中心，侧边栏入口已按新信息架构合并。
- 综合配置整合原路径配置、图库管理、数据库只读状态和 API Token；运维监控整合统计、备份恢复和 WebDAV 云同步。
- 备份恢复已改为真实备份包：整库导出、本地图库真实图片目录打包、manifest 恢复项解析、恢复前弹窗选择恢复内容。
- 公告中心使用 `announcements` / `announcement_reads`，前台导航通知胶囊支持未读计数、置顶公告、详情弹窗，后台删除公告后用户通知同步消失。
- 默认网站背景为 `client/public/site_bg.png`；公开配置无自定义背景时返回 `/site_bg.png`，有自定义背景时不能刷新闪默认图。
- 站点配置背景模糊使用 `.taotu-shell` 的 `backdrop-filter`，遮罩颜色保存在 `site_config.background.overlayTop/overlayBottom`；不要给 `.taotu-shell` 再叠额外背景色。
- 页面切换 Q 弹转场已分层并增强力度：图片详情固定模糊背景先渲染，背景图完成或缓存确认后立即弹出内容层；后台子页保留页面根的粉蓝背景和伪元素静态，只对页面根下一级内容做 Q 弹动画；详情加载态使用 `/icons/image/detail-loading-placeholder.gif` 占位，后续可替换为动图资源。
- 登录态已改为无感切换与被动验证：页面切换不再主动调用 `/api/admin/auth/me`，默认布局、上传页、仪表盘和后台布局先用本地有效 JWT/用户缓存恢复状态；只有实际请求后端 API 返回 `401` 或未审核/禁用等会话失效类 `403` 时，`useApi` 才触发 `clearAuthSession()`，统一清理 Token、用户缓存和 `taotu_token` Cookie，并广播 `taotu:auth-invalid` 要求重新登录。
- 后端已完成原生 ES Module 等价迁移：根包使用 `"type":"module"`，入口在 `bootstrap()` 后动态导入 app，所有后端 JS 不再使用 CommonJS；Knex 迁移、PM2 Node 18.19 启动和主要接口 smoke test 已验证。
- 权限隔离必须前后端同时执行：后台页面可用本地有效管理员 JWT 先恢复界面以避免闪屏，但所有站点级后台 API 必须由后端 `server/middleware/requireAdmin.js` 统一保护；普通用户即使用 curl 或手改 URL 也只能访问自己的仪表盘、相册、图片、Token 和私有标签等自有资源。私有图片的 `/image` 与 `/thumb` hash 直链也必须经过媒体门禁，前端通过同站 `taotu_token` Cookie 让 `<img>` 请求继承登录态。
- 首页图库只保留 `grid` / `waterfall`，公开接口 `/api/gallery/config` 决定访客默认模式；网格和瀑布流都使用最短列贴合布局，并采用平均色块占位、中等图优先、前端逐张队列请求和原地淡入，避免一次性加载大量图片造成卡顿。
- 首页新图片必须在已计算好的画框位置显示，不允许恢复从页面上方或中间移动到目标位置的位移动画；首次硬刷新后触底加载由布局完成后的可视检查兜底触发。
- 网格模式已做多图滚动优化：屏外卡片允许浏览器跳过绘制，已加载图片释放可见性监听，卡片额外信息层按需渲染，避免大量标签/模糊滤镜常驻影响滚动。
- 普通用户仪表盘概览的最近上传最多显示 25 张（5 列 5 行）；右侧存储使用与账号摘要组合高度需和最近上传面板对齐。
- 普通用户仪表盘保留统计、图片管理、标签设置、账户与安全；相册管理统一回到相册页完成。
- 管理员人工标签和普通用户仪表盘人工标签的小图 hover 会通过 `ManualImageHoverPreview` 显示 320px 宽中等图预览；提示文案在选择行右侧，浮层自动避免上方/左右出屏。
- 相册详情网格模式每页数量按实际容器列数动态计算，避免宽屏第一页未填满但第二页仍有图片；图片数量、浏览数、标签数量等胶囊宽度必须随数字自动撑开。
- 自定义路径扫描导入必须生成派生缩略图：外部原图目录不写 `.thumbs` 时，缩略图/中等图落在 `data/gallery/.derived/<源图路径hash>/`；`/thumb` 先找原图同目录 `.thumbs`，再找 `.derived`，缺失时按需补生成，最后才回退原图。
- 图片详情嵌入代码必须按当前尺寸切换 12 种组合，缩略图和中等图需要带对应 `s=thumb` / `s=medium` 参数，不能始终返回完整图地址。
- 相册“公开所有图片”使用 `albums.all_picture_public` 持久化按钮状态；开启和关闭都要覆盖相册内所有图片的 `is_public`，不要仅按当前图片是否全公开临时推断。
- 相册“隐藏于主页图库”使用 `albums.hide_from_gallery` 持久化按钮状态；只过滤首页图库和首页来源统计，不改变图片公开状态，不影响相册详情、图片详情、随机图 API 或已有外链。
- 用户组与存储策略是 `0.3.2-pre` 管理员功能：`user_groups` 负责上传限制、命名规则、图片处理参数和 NSFW 审核配置，`storage_strategies` 负责用户组关联的挂载配置。默认用户组与默认本地策略由迁移自动创建；当前只有本地策略真实参与上传，第三方 COS/OSS/FTP/SFTP 先提供配置入口并在上传时显式拒绝。
- NSFW 审核状态写入 `images.nsfw_status/nsfw_detail`；上传后会同步尝试审核，后台定时补扫未审核图片。非管理员公开展示、随机图和媒体直链必须过滤 `nsfw_status=true`，管理视图可以保留记录用于删除或处置。
- 上传页支持管理员按目标图库上传：默认“我的图库”，可切换“全部”或“用户图库”筛选相册，三个下拉保持同一排和同一 `TaotuSelect` 视觉语言。新公共/私有标签输入框按 Enter 会进入暂存新标签列表，上传成功时由后端创建并绑定。上传结果表的“存储策略”列必须展示图片实际写入的策略名称，不能只显示用户组默认值或前端猜测值。
- 删除/高风险确认统一使用 `client/components/ConfirmDeleteDialog.vue`，组件通过 `Teleport` 固定在浏览器视口中央；关闭按钮默认主题粉底白色 X、hover 时 X 变深色；不要新增浏览器原生 `confirm()` 或绿色关闭按钮。
- 图片管理支持图库来源、用户/相册联动、文件名搜索、标签筛选和多选批量操作；批量操作入口在搜索按钮右侧，支持批量删除与批量公开/不公开。管理员编辑平台标签时不得覆盖图片所属用户已有私有标签。
- 标签管理支持公共/私有标签、多选批量操作、分组树和人工标签；管理员后台编辑自己拥有的 `uXX` 用户私有标签时可以切换 `is_public` 并持久化，普通用户仪表盘和普通用户 API 仍不能设置公共状态，私有标签互斥也必须保持用户隔离。
- 条件标签使用 `conditions.tag_id` 稳定关联 `tags.id`；定时扫描、上传后、路径扫描后都必须增量跳过已标记图片，手动立即扫描才全量 force。
- 分辨率条件档位为 `below1080p`、`1080p`、`2k`、`4k`；横图、竖图、正方图按 `0.9-1.1` 正方容差互斥判定。
- SMTP、公开域名、备案号、注册开关、背景、WebDAV、默认展示、配额等全部写入 `site_config`。
- 隐私政策、服务条款和帮助中心应读取公开配置返回的站点名与 `appVersion` / `legalVersion`，不要写死协议版本或固定“桃图智库”。
- WebDAV 云同步在 `server/services/cloudSyncService.js` 中按需动态 `import('webdav')`，不要恢复顶层 `require('webdav')`。
- 服务启动会自动校验 `.env`、检查/创建数据库、执行 Knex 迁移；空用户表时创建首个管理员，密码来自 `DEFAULT_ADMIN_PASSWORD` 或启动日志随机值。
- `/api/tags` 必须返回 `mutually_exclusive_with`，图库/API 参数互斥校验统一走 `server/utils/tagConflict.js`。
- 上传成功链接卡片在 `client/pages/upload.vue`，成功文件会从待上传队列移除，继续选择文件为追加。
- 自定义路径读取/保存逻辑在 `configService.readPaths/writePaths` 与后台综合配置页，数据库表为 `custom_paths`；`make_public` 持久化路径扫描“批量公开”开关，`allow_delete` 持久化“管理图片删减”开关。删除自定义路径本身时仍只清理该路径扫描入库的图片记录、`image_tags` 关联和 `data/gallery/.derived` 下对应派生缩略图，不删除外部原始图片；但图片管理/用户删除等删除单张图片时，如果该图片来自自定义路径且对应路径开启 `allow_delete`，才可以同步删除外部原图。
- 发布路线：当前为 `0.3.2-pre` 预备功能线；本轮完成相册主页隐藏、用户组上传规则、存储策略管理、NSFW 审核骨架、自定义路径删减开关和上传页管理员目标图库选择。移动端重新适配、主副标题拆分和面板内容收纳进入后续 `0.4.0` / `0.4.x`，稳定后再进入 `1.0.0`。

## 提交前检查

```bash
node --check server/services/startupService.js
node --check server/index.js
node --check server/services/configService.js
node --check server/services/mailService.js
node --check server/services/redisService.js
node --check server/services/cloudSyncService.js
node --check server/middleware/requireAdmin.js
node --check server/routes/admin/auth.js
node --check server/routes/admin/tagConvert.js
node --check server/routes/admin/announcements.js
node --check server/routes/admin/conditions.js
node --check server/routes/api/announcements.js
node --check server/routes/api/images.js
node --check server/routes/api/embed.js
node --check server/services/conditionTagService.js
node --check server/db/migrations/20240120000001_add_conditions_tag_id.js
node --check server/routes/internal/dashboard.js
node --check server/routes/internal/images.js
node --check server/utils/tagConflict.js
cd client && npx nuxt generate
```
