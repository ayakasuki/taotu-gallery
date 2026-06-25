# 桃图智库 (taotu-gallery)

> 自托管图床 + 智能标签管理平台，支持 AI 标签扩展、条件自动标签、参数化 API、多用户隔离。

v0.2.0 · [MIT License](LICENSE)

---

## 功能概览

| 模块 | 功能 |
|------|------|
| 图库展示 | 瀑布流 / 网格 / 静态 / 轮播四种模式，支持排序筛选 |
| 标签系统 | 人工标签、条件自动标签、AI 标签（预留接口） |
| 用户标签 | 每个用户独立私有标签系统，可设为公共共享 |
| 参数化 API | 按标签/相册/随机查询，支持 Token 认证（Header / URL `?tk=`） |
| 嵌入代码 | 源地址/HTML/BBCode/Markdown × 缩略/中等/完整 = 12 种组合 |
| 多用户 | 注册登录、用户隔离、公共/私有图片控制、用户配额 |
| 相册管理 | 创建/编辑/删除、公共相册、相册内图片管理、封面设置 |
| 条件标签 | 路径正则/排除/分辨率/横竖图/横竖比，自动扫描匹配 |
| 上传 | 文件上传、URL 上传、批量上传、新建标签、中文文件名 |
| 多选操作 | 图库页面多选图片、批量删除、批量移动到相册 |
| 备份恢复 | 数据库 + 图片 + 配置打包备份，路径相对化恢复 |
| 云同步 | WebDAV 同步标签/路径/配置文件 |
| 统计 | API 调用量、上传活跃、用户活跃、热门图片 |
| 网站外观 | 自定义背景图（支持模糊度调节）、网站 Icon 上传 |
| 前端显示域名 | 支持 CDN / 公网域名配置，嵌入代码自动使用 |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Node.js 18+ / Express / Knex.js / MySQL |
| 前端 | Nuxt 3 / Vue 3 Composition API / Fluent Design 风格 |
| 文件监听 | chokidar |
| 图片处理 | sharp（缩略图/中等图/颜色/分辨率） |
| 认证 | JWT + bcryptjs |
| 云同步 | WebDAV |
| 部署 | PM2（前后端同端口） |

---

## 快速开始

### 环境要求

- Node.js 18+
- MySQL 5.7+ / MariaDB 10.5+
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
# 编辑 .env 填入数据库信息
```

### 配置数据库

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
PORT=7067
```

### 初始化与启动

```bash
# 数据库迁移
npx knex migrate:latest

# 创建默认管理员
npx knex seed:run

# 构建前端
cd client && npx nuxt generate && cd ..

# 启动
pm2 start pm2/pm2.json
# 或
./pm2/start.sh start
```

默认管理员：`admin` / `admin123`（请登录后立即修改密码）

---

## 用户角色与权限

### 未登录用户

- 浏览公共图库
- 使用 API Token 访问公共图片 API
- 注册账号（需管理员开放注册）

### 普通用户

| 功能 | 说明 |
|------|------|
| 我的图库 | 查看自己上传的图片，支持多选批量操作 |
| 上传图片 | 文件上传 / URL 上传，支持中文文件名 |
| 图片管理 | 设置公共/私有、删除自己的图片 |
| 私有标签 | 创建和管理自己的私有标签 |
| 相册管理 | 创建相册、管理自己的相册、设为公共 |
| API Token | 生成自己的 Token 用于 API 调用 |
| 仪表盘 | 个人统计、图片管理、Token 管理、标签管理 |

### 管理员

| 功能 | 说明 |
|------|------|
| 管理后台 | 完整的系统管理面板 |
| 图片管理 | 多选批量操作、三分类筛选（全部/公共/我的/用户图库） |
| 标签管理 | 创建/编辑/删除标签、公共/私有切换、人工标签 |
| 条件标签 | 5 种条件类型、专用表单配置、手动触发扫描 |
| 用户管理 | 创建/编辑/删除用户、配额设置、彻底清理 |
| 相册管理 | 管理所有相册、设置封面 |
| 网站配置 | 注册开关、HTTPS、前端显示域名、背景图、Icon |
| 自定义路径 | 外部图库导入、指定相册和标签、批量扫描 |
| 备份恢复 | 系统级备份和恢复 |
| 统计监控 | 全站数据统计 |

---

## 标签系统

### 标签类型

| 类型 | 存储 | 说明 |
|------|------|------|
| 公共标签 | `tags` 表 + `tags.json` | 所有人可见 |
| 用户私有标签 | `user_tags` 表 | 仅创建者可见 |
| 条件标签 | `conditions` 表 + `conditions.json` | 自动匹配图片 |
| AI 标签 | 预留接口 | 暂未启用 |

### 标签权限

- 管理员可将任何标签在公共/私有之间切换（ID 不变）
- 普通用户只能在仪表盘管理自己的私有标签
- 删除标签时同步清理数据库和配置文件

### 条件标签

| 条件类型 | 说明 | 配置示例 |
|----------|------|----------|
| 路径正则 | 路径包含指定文字 | `表情包`、`壁纸` |
| 路径排除 | 路径不含指定文字 | `临时`、`test` |
| 分辨率 | 横或竖边 ≥ 指定像素 | `1080`（即 1080p+） |
| 横竖图 | 宽>高 或 高>宽 | `横图` / `竖图` |
| 横竖比 | 接近 1:1（正方形） | 固定 0.95-1.05 |

**执行时机：** 上传后立即执行 / 路径扫描后执行 / 条件创建后立即执行 / 定时扫描 / 手动触发

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

### 主要端点

| 端点 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/tags` | GET | 可选 | 标签列表（无 token 只返回公共标签） |
| `/api/images` | GET | 可选 | 图片列表（无 token 只返回公共图片） |
| `/api/images/random` | GET | 可选 | 随机图片（count=1 返回图片二进制） |
| `/api/images/:id` | GET | 可选 | 图片详情 + 嵌入代码 |
| `/api/albums` | GET | 可选 | 相册列表（无 token 只返回公共相册） |
| `/api/albums/random` | GET | 可选 | 随机相册 |
| `/api/embed/image` | GET | 可选 | 图片嵌入（HTML/BBCode/Markdown） |
| `/api/embed/album` | GET | 可选 | 相册嵌入 |
| `/api/upload` | POST | 必需 | 上传图片 |
| `/api/user-tags` | GET | 必需 | 用户私有标签 |

### 随机图片参数

| 参数 | 说明 |
|------|------|
| `count` | 返回数量，1 返回图片二进制，>1 返回 JSON |
| `tags` | 标签 ID，逗号分隔（支持 `u1` 用户标签） |
| `album` | 相册 ID |
| `pic` | `md` 返回中等尺寸图片（减少带宽） |
| `tk` | API Token（URL 参数方式） |

### API 权限隔离

| 端点 | 无 token | 有 token |
|------|---------|---------|
| 图片/相册/标签查询 | 只返回公共内容 | 自己的 + 公共的 |
| 随机图片 + 指定公共相册 | 相册内图片可见 | 相册内图片可见 |
| 上传 | 401 | 正常上传 |

---

## 相册权限逻辑

| 场景 | 图片 is_public | 相册 is_public | 入口 | 可见性 |
|------|---------------|---------------|------|--------|
| 公共图片 | ✅ | - | 图片列表 | ✅ 所有人 |
| 私有图片 | ❌ | - | 图片列表 | 仅自己 |
| 公共相册内私有图片 | ❌ | ✅ | 相册入口 | ✅ 所有人 |
| 私有相册内图片 | - | ❌ | 相册入口 | 仅相册所有者 |

---

## 用户配额

| 配置 | 说明 |
|------|------|
| 全局默认存储上限 | 管理后台 → 网站配置 → 用户配额 |
| 全局单图大小限制 | 管理后台 → 网站配置 → 用户配额 |
| 单用户存储上限 | 用户管理 → 编辑用户 |
| 单用户单图大小 | 用户管理 → 编辑用户 |

管理员不受配额限制。

---

## 数据库表（12 张 + 扩展）

| 表 | 用途 |
|----|------|
| `images` | 图片信息、路径、哈希路径、公共标记、上传者 |
| `albums` | 相册信息、公共标记、创建者、封面 |
| `tags` | 标签定义、可组合性、互斥关系、公共标记 |
| `user_tags` | 用户私有标签（user_id、is_public） |
| `image_tags` | 图片-标签关联（支持 user_tag_id） |
| `album_tags` | 相册-标签关联 |
| `models` | AI 模型记录（桩，暂未启用） |
| `conditions` | 条件标签配置 |
| `api_tokens` | API Token（关联用户） |
| `users` | 用户账号、角色、配额 |
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

---

## 自定义路径导入

管理后台 → 自定义路径，支持：

- 指定外部目录路径
- 递归/非递归扫描
- 指定相册（已有或新建）
- 批量打标签（已有标签 + 新建标签）
- 单路径扫描或全量扫描

---

## 网站外观

管理后台 → 网站配置 → 网站外观：

- 网站名称（动态显示，全站同步）
- 网站图标（上传 Favicon）
- 背景图（URL 或上传，支持 0-100% 模糊度滑块）

---

## 备份与恢复

**备份内容：** 数据库 dump + 本地图库 + 自定义路径图片 + 配置文件

**恢复核心规则：** 所有图片路径必须转为相对项目目录的路径，否则恢复后数据库图片路径不可读。

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
