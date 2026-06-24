# 桃图智库 (taotu-gallery)

> 自托管图床 + 智能标签管理平台，支持 AI 标签扩展、条件自动标签、参数化 API、多用户隔离。

v0.1.0 · [MIT License](LICENSE)

---

## 功能概览

| 模块 | 功能 |
|------|------|
| 图库展示 | 瀑布流 / 网格 / 静态 / 轮播四种模式，支持排序筛选 |
| 标签系统 | 人工标签、条件自动标签、AI 标签（预留接口） |
| 参数化 API | 按标签/相册/随机查询，支持 Token 认证 |
| 嵌入代码 | 源地址/HTML/BBCode/Markdown × 缩略/中等/完整 = 12 种组合 |
| 多用户 | 注册登录、用户隔离、公共/私有图片控制 |
| 相册管理 | 创建/编辑/删除、公共相册、相册内图片管理 |
| 条件标签 | 路径正则/排除/分辨率/横竖图/横竖比，自动扫描匹配 |
| 上传 | 文件上传、URL 上传、批量上传、新建标签 |
| 备份恢复 | 数据库 + 图片 + 配置打包备份，路径相对化恢复 |
| 云同步 | WebDAV 同步标签/路径/配置文件 |
| 统计 | API 调用量、上传活跃、用户活跃、热门图片 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Node.js 18+ / Express / Knex.js / MySQL |
| 前端 | Nuxt 3 / Vue 3 Composition API / PrimeVue 风格 Fluent Design |
| 文件监听 | chokidar |
| 图片处理 | sharp |
| 认证 | JWT + bcryptjs |
| 云同步 | WebDAV |
| 部署 | PM2 |

---

## 快速开始

### 环境要求

- Node.js 18+
- MySQL 5.7+ / MariaDB 10.5+
- npm

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/taotu-gallery.git
cd taotu-gallery

# 安装后端依赖
npm install

# 安装前端依赖
cd client && npm install && cd ..

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库信息
```

### 配置数据库

```sql
CREATE DATABASE gallery_index CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gallery'@'localhost' IDENTIFIED BY 'your_password';
GRANT SELECT, INSERT, UPDATE, DELETE, ALTER, LOCK TABLES ON gallery_index.* TO 'gallery'@'localhost';
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
PORT=7067
```

### 初始化数据库

```bash
npx knex migrate:latest
npx knex seed:run
```

默认管理员账号：`admin` / `admin123`（请登录后立即修改密码）

### 构建前端

```bash
cd client && npx nuxt generate && cd ..
```

### 启动

```bash
# 开发模式
npm run dev

# 生产模式（PM2）
pm2 start pm2/pm2.json
# 或使用脚本
./pm2/start.sh start
```

访问 `http://localhost:7067`

### 自定义端口

编辑 `pm2/pm2.json`，修改 `apps[0].env.PORT` 即可。前后端共用同一端口，无需额外配置。

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
| 相册管理 | 创建相册、管理自己的相册 |
| API Token | 生成自己的 Token 用于 API 调用 |
| 仪表盘 | 个人统计、图片管理、Token 管理 |

**普通用户不能：**
- 访问管理后台
- 查看/编辑/删除其他用户的图片
- 选择标签上传（仅管理员可）
- 管理条件标签和系统配置

### 管理员

| 功能 | 说明 |
|------|------|
| 管理后台 | 完整的系统管理面板 |
| 图片管理 | 查看所有图片，支持三分类筛选（全部/公共/我的/用户图库） |
| 标签管理 | 创建/编辑/删除标签，人工标签 |
| 条件标签 | 创建条件自动标签规则 |
| 用户管理 | 创建/编辑/删除用户 |
| 相册管理 | 管理所有相册 |
| 网站配置 | 注册开关、HTTPS、前端显示域名 |
| 备份恢复 | 系统级备份和恢复 |
| 统计监控 | 全站数据统计 |

---

## 前端页面说明

### 公开页面

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | 图库首页 | 公共图库/我的图库/用户图库切换，标签筛选 |
| `/albums` | 相册列表 | 浏览公共相册，管理自己的相册 |
| `/image/:id` | 图片详情 | 查看图片、嵌入代码、上传者信息 |
| `/login` | 登录 | 用户登录 |
| `/register` | 注册 | 用户注册（需管理员开放） |
| `/upload` | 上传 | 文件上传、URL 上传 |
| `/api-docs` | API 接口 | 动态生成 API URL、实时预览、调用文档 |
| `/settings` | 设置 | 后端连接配置、前端显示域名 |
| `/dashboard` | 仪表盘 | 我的图片、我的 Token、统计数据 |

### 管理后台 (`/admin`)

| 路径 | 页面 | 说明 |
|------|------|------|
| `/admin` | 概览 | 统计卡片、快捷入口 |
| `/admin/images` | 图片管理 | 多选批量操作、三分类筛选 |
| `/admin/tags` | 标签设置 | 标签 CRUD、人工标签、通用配置 |
| `/admin/conditions` | 条件标签 | 条件 CRUD、手动触发扫描 |
| `/admin/models` | 模型管理 | AI 模型（桩，暂未启用） |
| `/admin/paths` | 自定义路径 | 外部图库路径管理 |
| `/admin/database` | 数据库 | 连接状态、配置信息 |
| `/admin/gallery` | 图库设置 | 展示模式、上传配置 |
| `/admin/api` | API 设置 | 全局 API Token 管理 |
| `/admin/users` | 用户管理 | 用户 CRUD |
| `/admin/site-config` | 网站配置 | 域名、注册、HTTPS |
| `/admin/stats` | 统计监控 | API 调用、上传活跃、热门图片 |
| `/admin/backup` | 备份恢复 | 创建/恢复备份 |
| `/admin/cloud-sync` | 云同步 | WebDAV 配置 |

---

## API 说明

### 认证方式（二选一）

```bash
# 方式一：Authorization Header
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://your-domain.com/api/images/random?count=1"

# 方式二：URL 参数
curl "https://your-domain.com/api/images/random?count=1&tk=YOUR_TOKEN"
```

### 主要端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/tags` | GET | 获取标签列表 |
| `/api/images` | GET | 图片列表查询 |
| `/api/images/random` | GET | 随机图片（返回图片二进制） |
| `/api/images/:id` | GET | 图片详情 + 嵌入代码 |
| `/api/albums` | GET | 相册列表 |
| `/api/albums/random` | GET | 随机相册 |
| `/api/embed/image` | GET | 图片嵌入（HTML/BBCode/Markdown） |
| `/api/embed/album` | GET | 相册嵌入 |
| `/api/upload` | POST | 上传图片（需登录） |

### 随机图片参数

| 参数 | 说明 |
|------|------|
| `count` | 返回数量，1 返回图片二进制，>1 返回 JSON |
| `tags` | 标签 ID，逗号分隔 |
| `album` | 相册 ID |
| `pic` | `md` 返回中等尺寸图片（减少带宽） |
| `tk` | API Token（URL 参数方式） |

示例：`/api/images/random?tags=1,2&pic=md` — 返回符合条件标签的中等尺寸随机图片。

---

## 条件标签

条件标签是一种自动标签机制。设置条件后，系统自动将符合条件的图片归类到对应标签。

| 条件类型 | 说明 | 配置示例 |
|----------|------|----------|
| 路径正则 | 路径包含指定文字 | `表情包`、`壁纸` |
| 路径排除 | 路径不含指定文字 | `临时`、`test` |
| 分辨率 | 横或竖边 ≥ 指定像素 | `1080`（即 1080p+） |
| 横竖图 | 宽>高 或 高>宽 | `横图` / `竖图` |
| 横竖比 | 接近 1:1（正方形） | 固定 0.95-1.05 |

**执行时机：**
- 图片上传后立即执行
- 路径扫描后自动执行
- 条件创建/编辑后立即执行
- 定时扫描（可配置间隔分钟数）
- 手动触发（条件标签页"立即扫描所有图片"按钮）

---

## 后端可配置项（data/config/）

| 文件 | 说明 |
|------|------|
| `site.json` | 站点名、注册开关、前端显示域名、标签延迟分钟数、差异阈值 |
| `tags.json` | 标签定义、可组合/不可组合、互斥关系 |
| `paths.json` | 自定义外部图库路径 |
| `conditions.json` | 条件标签配置 |

### site.json 配置项

```json
{
  "siteName": "桃图智库",
  "publicDomain": "https://your-domain.com",
  "registration": {
    "enabled": false,
    "emailVerification": false
  },
  "tagDelayMinutes": 5,
  "tagDiffThreshold": 0.5,
  "display": { "mode": "grid" },
  "upload": { "showUrlAfterUpload": true }
}
```

| 字段 | 说明 |
|------|------|
| `siteName` | 站点名称 |
| `publicDomain` | 前端显示域名（嵌入代码和 API URL 使用此域名） |
| `registration.enabled` | 是否开放注册 |
| `tagDelayMinutes` | 标签/条件变化后延迟执行分钟数 |
| `tagDiffThreshold` | 标签配置差异阈值（超过则全部重标签） |

---

## 数据库表（12 张）

| 表 | 用途 |
|----|------|
| `images` | 图片信息、路径、哈希路径、公共标记 |
| `albums` | 相册信息、公共标记、创建者 |
| `tags` | 标签定义、可组合性、互斥关系 |
| `image_tags` | 图片-标签关联（来源：manual/ai/condition） |
| `album_tags` | 相册-标签关联 |
| `models` | AI 模型记录（桩，暂未启用） |
| `conditions` | 条件标签配置 |
| `api_tokens` | API Token（关联用户） |
| `users` | 用户账号、角色 |
| `upload_logs` | 上传日志 |
| `api_logs` | API 调用日志 |
| `site_metrics` | 网站统计指标 |

---

## 图片 URL 设计

所有图片通过哈希路径对外访问，不暴露服务器真实路径：

```
原图: /image/2026-06-24/abc123def456.jpg
缩略图: /thumb/2026-06-24/abc123def456.jpg?s=thumb
中等图: /thumb/2026-06-24/abc123def456.jpg?s=medium
```

哈希路径在图片入库时自动生成，与本地文件路径无关。

---

## 备份与恢复

**备份内容：** 数据库 dump + 本地图库 + 自定义路径图片 + 配置文件

**恢复流程：**
1. 解压备份包
2. 恢复配置文件
3. 恢复数据库
4. 恢复图片文件
5. 路径相对化（绝对路径强制转相对路径）
6. 路径可读性验证

**核心规则：** 恢复时所有图片路径必须转为相对项目目录的路径，否则恢复后数据库图片路径不可读。

---

## 部署建议

### PM2 一键部署

```bash
pm2 start pm2/pm2.json
```

### 反向代理（Nginx）

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

### HTTPS / CDN

在管理后台 → 网站配置 → 前端显示域名中设置公网域名，嵌入代码和 API URL 将自动使用该域名。

---

## AI 标签（预留接口）

当前版本 AI 标签功能暂未启用，预留接口供未来接入远程多模态视觉大模型（如硅基流动）。

接口位置：`server/services/aiTagService.js`

所有 AI 相关方法返回 `{ success: false, reason: 'AI_NOT_ENABLED' }`，可按需接入外部 API。

---

## 开发

```bash
# 后端开发
npm run dev  # 端口 7067

# 前端开发
cd client && npm run dev  # 端口 3002（独立开发时）

# 数据库迁移
npx knex migrate:latest
npx knex migrate:rollback
```

---

## 许可证

[MIT License](LICENSE)
