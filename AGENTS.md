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
| 后端 | Node.js 18+ / ES6 纯 JS（不用 TS）/ Express / Knex.js / MySQL |
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
15. **启动必须先自检再加载 app** — `server/index.js` 必须先执行 `startupService.bootstrap()`，完成 env 校验、数据库检查、迁移和首个管理员初始化后再 `require('./app')`。
16. **未配置数据库禁止启动** — `DB_HOST`、`DB_USER`、`DB_NAME`、`JWT_SECRET` 缺失或 `JWT_SECRET` 仍为示例值时必须直接失败，不允许回退到 root/localhost 默认库。
17. **启动自动迁移，不自动 seed** — 服务启动会跑 `db.migrate.latest()`；不要在启动流程跑 `seed:run`，旧 seed 会清空 `users` 表。
18. **首个管理员不能使用公开固定密码** — 空用户表时自动创建首个管理员；`DEFAULT_ADMIN_PASSWORD` 为空则生成一次性随机密码并打印日志。
19. **互斥标签字段是字符串** — `tags.mutually_exclusive_with` 必须是 `varchar`，迁移 `20240115000001_change_mutual_exclusive_to_string.js` 必须执行。支持多个 ID、`.`/`,`/中文标点/空白分隔，用户标签 ID 允许 `u13`。
20. **互斥标签按组闭包保存** — 例如标签 6 设置 `3,4` 后，3/4/6 三者必须互相写入互斥关系。清空某标签互斥关系时，前端需同步从其它标签互斥列表移除该标签。
21. **标签筛选 API 必须校验互斥参数** — 对外 `/api/images*`、`/api/embed/*` 和内部图库接口使用 `server/utils/tagConflict.js`，非法组合返回 `400 JSON`，不要只返回空结果。
22. **用户私有标签不可误删** — 管理员维护图片平台标签时不能覆盖或删除图片所属用户已有私有标签；如需维护用户私有标签，走独立的用户私有标签接口。
23. **上传返回公网 URL** — 上传成功返回和嵌入代码必须使用 `imageService.getPublicBaseUrl()`，不能写死 `localhost`。
24. **横竖图条件互斥** — 横图、竖图、正方图自动判定三选一；宽高比接近 `0.9-1.1` 或 `1:1` 归为正方图。
25. **自定义路径只以数据库为准** — `custom_paths` 表是持久化来源，不回退写 JSON；刷新页面后必须从数据库恢复条目。
26. **用户私有标签互斥权限隔离** — `user_tags` 有 `combinable` 和 `mutually_exclusive_with` 字段；普通用户只能配置自己拥有的私有标签互斥，API 禁止绑定管理员或其他用户标签。
27. **验证码依赖 Redis** — 图片验证码、注册邮箱验证码、忘记密码验证码均写 Redis，TTL 120 秒；邮箱验证码必须是 2 个数字 + 3 个英文乱序。
28. **SMTP 配置在数据库** — `site_config.smtp` 存 SMTP，测试邮件/注册邮件/忘记密码邮件统一走 `mailService.js`。
29. **前台不能自定义后端地址** — 已删除 `/settings` 和 connection-check 插件；前后端连接由部署与后台维护，不再允许用户在前台写 backend_url。
30. **备案号在 site_config** — `recordNumber` 由网站配置保存，公开配置接口返回，默认布局页脚展示。
31. **条件标签定时扫描必须增量** — 定时任务、上传后、路径扫描后只处理尚未拥有对应条件标签的候选图片；只有后台“立即扫描所有图片”允许 force 全量重扫。
32. **分辨率条件档位互斥** — `below1080p` / `1080p` / `2k` / `4k` 四档覆盖全部图片；4K 档包含 4K 以上，不再细分 8K。
33. **默认网站背景** — 新部署无背景配置时公开配置返回 `/site_bg.png`；已有自定义背景刷新时不能先闪默认图再切自定义图。
34. **背景模糊与遮罩** — 首页背景模糊通过 `.taotu-shell` 的 `backdrop-filter` 实现，`.taotu-shell` 不再叠加额外背景色；背景明暗由 `site_config.background.overlayTop/overlayBottom` 控制。
35. **公告通知必须数据库驱动** — 公告存 `announcements`，已读状态存 `announcement_reads`；后台删除公告后用户通知同步消失。
36. **备份恢复必须真实可用** — 数据库备份导出整库，本地图库备份包含真实图片文件；恢复前必须读取 manifest 并让用户选择实际支持的恢复项。
37. **全局提示统一 toast** — 登录、后台配置、图片/标签/条件等普通成功失败提示统一复用导航下方胶囊 toast；不要再新增散落的行内 alert。

## 项目结构

```
├── server/              # 后端 Express
│   ├── app.js           # 应用入口（服务 API + 前端静态文件）
│   ├── index.js         # 启动（先自检/迁移，再支持 HTTP/HTTPS）
│   ├── config/          # 配置
│   ├── db/migrations/   # Knex 迁移
│   ├── middleware/       # auth / errorHandler / apiToken / apiLogger
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

## 当前实现状态（v0.3.1-pre-fix）

> v0.3.1-pre-fix 是 0.3.1 正式版发布前的稳定化提交：前台、普通用户端和主要管理后台页面已完成新版浅色玻璃拟态重构，部分图标仍允许使用占位资源，等待最终图标替换。

- 访客端和普通用户端已统一新版视觉：默认布局、导航、页脚、首页图库、相册、图片详情、上传、API 文档、登录、注册和仪表盘均已重构。
- 管理后台主要入口已重构：概览、图片管理、标签设置、条件标签、站点配置、综合配置、运维监控、用户管理、公告中心，侧边栏入口已按新信息架构合并。
- 综合配置整合原路径配置、图库管理、数据库只读状态和 API Token；运维监控整合统计、备份恢复和 WebDAV 云同步。
- 备份恢复已改为真实备份包：整库导出、本地图库真实图片目录打包、manifest 恢复项解析、恢复前弹窗选择恢复内容。
- 公告中心使用 `announcements` / `announcement_reads`，前台导航通知胶囊支持未读计数、置顶公告、详情弹窗，后台删除公告后用户通知同步消失。
- 默认网站背景为 `client/public/site_bg.png`；公开配置无自定义背景时返回 `/site_bg.png`，有自定义背景时不能刷新闪默认图。
- 站点配置背景模糊使用 `.taotu-shell` 的 `backdrop-filter`，遮罩颜色保存在 `site_config.background.overlayTop/overlayBottom`；不要给 `.taotu-shell` 再叠额外背景色。
- 首页图库只保留 `grid` / `waterfall`，公开接口 `/api/gallery/config` 决定访客默认模式；网格和瀑布流都使用最短列贴合布局。
- 普通用户仪表盘保留统计、图片管理、标签设置、账户与安全；相册管理统一回到相册页完成。
- 图片管理支持图库来源、用户/相册联动、文件名搜索、标签筛选；管理员编辑平台标签时不得覆盖图片所属用户已有私有标签。
- 标签管理支持公共/私有标签、多选批量操作、分组树和人工标签；普通用户私有标签互斥必须保持用户隔离。
- 条件标签使用 `conditions.tag_id` 稳定关联 `tags.id`；定时扫描、上传后、路径扫描后都必须增量跳过已标记图片，手动立即扫描才全量 force。
- 分辨率条件档位为 `below1080p`、`1080p`、`2k`、`4k`；横图、竖图、正方图按 `0.9-1.1` 正方容差互斥判定。
- SMTP、公开域名、备案号、注册开关、背景、WebDAV、默认展示、配额等全部写入 `site_config`。
- 服务启动会自动校验 `.env`、检查/创建数据库、执行 Knex 迁移；空用户表时创建首个管理员，密码来自 `DEFAULT_ADMIN_PASSWORD` 或启动日志随机值。
- `/api/tags` 必须返回 `mutually_exclusive_with`，图库/API 参数互斥校验统一走 `server/utils/tagConflict.js`。
- 上传成功链接卡片在 `client/pages/upload.vue`，成功文件会从待上传队列移除，继续选择文件为追加。
- 自定义路径读取/保存逻辑在 `configService.readPaths/writePaths` 与后台综合配置页，数据库表为 `custom_paths`。

## 提交前检查

```bash
node --check server/services/startupService.js
node --check server/index.js
node --check server/services/configService.js
node --check server/services/mailService.js
node --check server/services/redisService.js
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
