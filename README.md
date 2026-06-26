# 桃图智库 (taotu-gallery)

> 自托管图床 + 智能标签管理平台，支持 AI 标签扩展、条件自动标签、标签分组、参数化 API、多用户隔离。

v0.3.0 · [MIT License](LICENSE)

---

## 功能概览

| 模块 | 功能 |
|------|------|
| 图库展示 | 瀑布流 / 网格两种模式，公共图库 / 我的图库 / 用户图库筛选 |
| 标签系统 | 人工标签、条件自动标签、系统标签、互斥标签、AI 标签（预留接口） |
| 标签分组 | 二级分组结构，支持分组/子分组/标签多选叠加筛选 |
| 用户标签 | 每个用户独立私有标签系统，普通用户不可公共化，管理员可维护图片所属用户的私有标签 |
| 参数化 API | 按标签/分组/相册/随机查询，支持 Token 认证和互斥标签参数校验 |
| 嵌入代码 | 源地址/HTML/BBCode/Markdown × 缩略/中等/完整 = 12 种组合 |
| 多用户 | 注册登录、邮箱验证码、人机验证码、忘记密码、用户隔离、公共/私有图片控制、用户配额 |
| 相册管理 | 创建/编辑/删除、公共相册、封面设置、相册内图片管理 |
| 条件标签 | 路径正则/排除/分辨率/横图/竖图/正方图，专用表单配置 |
| 上传 | 文件上传、URL 上传、批量上传、新建私有标签、上传成功图床链接批量复制 |
| 多选操作 | 图库页面多选图片、批量删除、批量移动到相册 |
| 备份恢复 | 数据库 + 图片 + 配置打包备份，路径相对化恢复 |
| 云同步 | WebDAV 同步标签/路径/配置文件 |
| 统计 | API 调用量、上传活跃、用户活跃、热门图片 |
| 网站外观 | 自定义背景图（支持模糊度调节）、网站 Icon 上传、备案号页脚 |
| 前端显示域名 | 支持 CDN / 公网域名配置，嵌入代码自动使用 |
| 自定义路径 | 外部图库路径导入，支持指定相册和批量打标签 |
| 邮件服务 | SMTP 配置、测试邮件、注册/忘记密码验证码，Redis 2 分钟过期 |

---

## 本轮更新摘要

- 首页图库展示重构为“网格 / 瀑布流”两种模式，移除静态和轮播入口；后台图库展示配置也只保留这两项。
- 网格模式改为贴合式图片墙：横图按正方形展示，竖图同宽按比例增高，后续图片自动顶到最短列底部，避免 CSS Grid 行高造成大空白。
- 瀑布流参考 `tmp/瀑布流参考代码` 的最短列布局方式实现，图片信息只在鼠标悬停当前图片时显示，不再影响其它图片。
- 图片卡片优先使用中等图地址，网格模式在图片内部显示标签、标题和左上角浏览数；瀑布流模式隐藏浏览数，保持更干净的浏览效果。
- 首页启动会读取公开图库配置 `/api/gallery/config`，后台保存默认展示为瀑布流后，所有访客首页默认进入瀑布流。
- 首次部署启动链路补齐：启动前严格校验数据库和 JWT 环境变量，数据库不存在时尝试创建，随后自动执行 Knex 迁移建表。
- 空用户表首次启动会自动创建首个管理员；若未设置 `DEFAULT_ADMIN_PASSWORD`，系统生成一次性随机密码并打印到启动日志，避免公开固定默认密码。
- `.env.example` 和部署文档已更新，不再要求手动执行 `seed:run`，避免误清空用户表。

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Node.js 18+ / Express / Knex.js / MySQL |
| 前端 | Nuxt 3 / Vue 3 Composition API / Fluent Design 风格 |
| 文件监听 | chokidar |
| 图片处理 | sharp（缩略图/中等图/颜色/分辨率） |
| 认证 | JWT + bcryptjs |
| 缓存/验证码 | Redis（图片验证码、邮箱验证码、找回密码验证码 TTL） |
| 云同步 | WebDAV |
| 部署 | PM2（前后端同端口） |

---

## 快速开始

### 环境要求

- Node.js 18+
- MySQL 5.7+ / MariaDB 10.5+
- Redis 6+（注册验证码、图片人机验证码、忘记密码验证码必需）
- npm

### 安装

```bash
git clone https://github.com/ayakasuki/taotu-gallery.git
cd taotu-gallery

# 安装后端依赖
npm install

# 安装前端依赖
cd client && npm install && cd ..

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库、Redis、JWT 等信息
```

### 配置数据库

如果 MySQL 用户有建库权限，可以只在 `.env` 配置 `DB_NAME`，启动时会自动创建数据库；如果没有建库权限，请先手动建库：

```sql
CREATE DATABASE gallery_index CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gallery'@'localhost' IDENTIFIED BY 'your_password';
GRANT SELECT, INSERT, UPDATE, DELETE, ALTER, LOCK TABLES, CREATE ON gallery_index.* TO 'gallery'@'localhost';
FLUSH PRIVILEGES;
```

编辑 `.env`：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=gallery
DB_PASSWORD=your_password
DB_NAME=gallery_index
JWT_SECRET=your_random_secret_string

# 首次空库启动会自动创建首个管理员
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=your_initial_admin_password
DEFAULT_ADMIN_EMAIL=admin@example.com

PORT=7067

# Redis 用于注册验证码/图片验证码/忘记密码验证码
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0
```

### 配置 Redis

Redis 用于图片人机验证码、注册邮箱验证码和忘记密码邮箱验证码。验证码 TTL 默认为 120 秒，重发会覆盖旧验证码。

```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DB=0
```

如果开启“注册需邮箱验证”或使用忘记密码功能，还需要在后台网站配置中填写 SMTP 并通过测试邮件。

### 初始化与启动

```bash
# 构建前端
cd client && npx nuxt generate && cd ..

# 启动
pm2 start pm2/pm2.json
```

启动时会自动检查数据库、执行迁移并创建缺失的表。首次空库会自动创建首个管理员，默认用户名为 `admin`；如果 `.env` 未设置 `DEFAULT_ADMIN_PASSWORD`，系统会生成一次性随机密码并打印到启动日志。

---

## 架构特点

### 统一部署

前后端共用同一端口，Express 同时服务 API 和 Nuxt 静态文件。通过 PM2 一键部署。

### 所有配置存储在数据库

标签、条件标签、标签分组、自定义路径、网站配置全部存储在数据库，不使用 JSON 配置文件。避免了 JSON 与数据库不一致的问题。

### 图片 URL 哈希化

所有图片通过哈希路径对外访问，不暴露服务器真实路径：
```
原图: /image/2026-06-24/abc123def456.jpg
缩略图: /thumb/2026-06-24/abc123def456.jpg?s=thumb
中等图: /thumb/2026-06-24/abc123def456.jpg?s=medium
```

### API 内外分离

- `/api/internal/*` — 前端内部使用，返回完整数据
- `/api/*` — 对外 API，不暴露本地路径
- `/api/admin/*` — 管理后台 API

### 权限隔离

| 场景 | 未登录 | 普通用户 | 管理员 |
|------|--------|---------|--------|
| 公共图库 | ✅ 可看 | ✅ 可看 | ✅ 可看 |
| 自己的图片 | — | ✅ 可管理 | ✅ 可管理 |
| 别人的图片 | ❌ | ❌ | ✅ 可看 |
| 管理后台 | ❌ | ❌ | ✅ 可访问 |

---

## 标签系统

### 标签类型

| 类型 | 存储 | 说明 |
|------|------|------|
| 公共系统标签 | `tags` 表，`is_public=true` | 所有人可见 |
| 私有系统标签 | `tags` 表，`is_public=false` | 仅管理员可见 |
| 用户私有标签 | `user_tags` 表 | 仅创建者可见，ID 以 `u` 前缀区分，支持私有互斥关系 |
| 虚拟系统标签 | 后端 API 自动筛选 | `__untagged` 未标签、`__tagged` 已标签，不可删除 |
| 条件标签 | `conditions` 表 + `tags` 表 | 自动匹配图片 |

### 互斥标签

不可组合标签可以填写多个互斥 ID，例如 `3,4` 或 `3.4`。保存后系统会自动补齐互斥组关系：如果标签 6 互斥 3 和 4，则 3、4、6 三者都会互相排斥。

图库和 API 接口页会禁用互斥标签；直接拼接 API URL 时，后端会对非法互斥组合返回 `400` JSON。用户私有标签互斥必须使用 `u` 前缀 ID，普通用户只能配置自己拥有的私有标签之间互斥。

### 标签分组

支持二级分组结构，用于大量标签的分类管理：

```
游戏 (主分组)
  ├── 原神 (子分组, sid=1)
  │   ├── 角色A
  │   └── 角色B
  └── 星铁 (子分组, sid=2)
      ├── 角色C
      └── 角色D
规格 (主分组)
  └── 横竖图 (子分组, sid=3)
```

### 条件标签

| 条件类型 | 说明 |
|----------|------|
| 路径正则 | 路径包含指定文字 |
| 路径排除 | 路径不含指定文字 |
| 分辨率 | 横或竖边 ≥ 指定像素 |
| 横图/竖图/正方图 | 三者自动互斥判定，接近 1:1 的图片归为正方图 |
| 横竖比 | 可配置比例范围，默认 `0.9-1.1` 视为正方图 |

**执行时机：** 上传后立即执行 / 路径扫描后执行 / 条件创建后立即执行 / 定时扫描 / 手动触发

---

## 账号与邮件验证

### 注册与找回密码

- 管理员在网站配置中开启开放注册后，注册页通过公开配置接口显示注册表单。
- 开启“注册需邮箱验证”后，注册必须先通过图片人机验证码，再发送邮箱验证码。
- 邮箱验证码固定为 5 位：2 个数字 + 3 个英文乱序组合，Redis TTL 为 120 秒。
- 忘记密码使用账号绑定邮箱发送验证码，重置密码时需要邮箱验证码和新的图片人机验证码。
- SMTP 配置、备案号、公开域名等均保存到 `site_config` 表。

---

## API 说明

### 认证方式（二选一）

```bash
# 方式一：Authorization Header
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://your-domain.com/api/images/random?count=1&pic=md"

# 方式二：URL 参数
curl "https://your-domain.com/api/images/random?count=1&pic=md&tk=YOUR_TOKEN"
```

### 随机图片参数

| 参数 | 说明 |
|------|------|
| `count` | 返回数量，1 返回图片二进制，>1 返回 JSON |
| `tags` | 标签 ID，逗号分隔 |
| `tag_g` | 分组 ID，逗号分隔（返回分组内所有标签的图片） |
| `sid` | 子分组 sid，逗号分隔（返回子分组内标签的图片） |
| `album` | 相册 ID |
| `pic` | `md` 返回中等尺寸图片（减少带宽） |
| `tk` | API Token（URL 参数方式） |

**叠加筛选示例：**
- `?tag_g=1&sid=3&tags=4,5` — 分组1 + 子分组3 + 标签4、5 叠加
- `?tags=1,2,3` — 多个标签叠加
- `?count=1&pic=md` — 返回一张中等尺寸随机图片

若 `tags` 或分组展开后的标签包含互斥组合，API 返回 `400`，例如：

```json
{ "error": "非法互斥标签参数：test14 与 test15 不可同时筛选" }
```

---

## 用户角色与权限

### 未登录用户

- 浏览公共图库
- 使用 API Token 访问公共图片 API
- 注册账号（需管理员开放注册）

### 普通用户

| 功能 | 说明 |
|------|------|
| 我的图库 | 查看自己上传的图片 |
| 上传图片 | 文件上传 / URL 上传 |
| 图片管理 | 设置公共/私有、删除自己的图片 |
| 私有标签 | 创建和管理自己的私有标签 |
| 相册管理 | 创建相册、管理自己的相册 |
| API Token | 生成自己的 Token |
| 仪表盘 | 个人统计、图片管理、Token 管理、标签管理 |

### 管理员

| 功能 | 说明 |
|------|------|
| 管理后台 | 完整的系统管理面板 |
| 图片管理 | 多选批量操作、三分类筛选（全部/公共/我的/用户图库） |
| 标签管理 | 创建/编辑/删除标签、公共/私有切换、人工标签 |
| 标签分组 | 二级分组管理、子分组管理 |
| 条件标签 | 5 种条件类型、专用表单配置 |
| 用户管理 | 创建/编辑/删除用户、配额设置 |
| 自定义路径 | 外部图库导入、指定相册和标签 |
| 网站配置 | 域名、注册、HTTPS、背景图、Icon、配额 |

---

## 后端可配置项（数据库 site_config 表）

| 字段 | 说明 |
|------|------|
| `siteName` | 站点名称 |
| `publicDomain` | 前端显示域名（嵌入代码和 API URL 使用此域名） |
| `registration.enabled` | 是否开放注册 |
| `tagDelayMinutes` | 标签/条件变化后延迟执行分钟数 |
| `tagDiffThreshold` | 标签配置差异阈值 |
| `mediumSize` | 中等图最大宽高 |
| `background` | 背景图 URL + 模糊度 |
| `icon` | 网站图标路径 |
| `defaultQuota` | 默认用户配额（存储上限 + 单图大小） |
| `https` | HTTPS/SSL 配置 |

---

## 部署

### PM2 一键部署

```bash
# 编辑端口（默认 7067）
vim pm2/pm2.json

# 启动
pm2 start pm2/pm2.json

# 停止/重启/日志
pm2 stop pm2/pm2.json
pm2 restart pm2/pm2.json
pm2 logs
```

### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:7067;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 100m;
    }
}
```

### HTTPS

管理后台 → 网站配置 → HTTPS/SSL，填入证书路径和密钥路径，重启服务生效。

---

## AI 标签（预留接口）

当前版本 AI 标签功能暂未启用，预留接口供未来接入远程多模态视觉大模型（如硅基流动）。

接口位置：`server/services/aiTagService.js`

---

## 开发

```bash
# 后端开发
npm run dev  # 端口 7067

# 前端开发（独立端口调试）
cd client && npm run dev  # 端口 3002

# 数据库迁移
npx knex migrate:latest
npx knex migrate:rollback
```

---

## 许可证

[MIT License](LICENSE)
