# HJH LLM

一个有趣的"假 LLM"聊天室。用户以为自己在和 AI 对话（显示 Thinking...），实际上回复由部署者在后台手动输入。

## 如何使用

### 普通用户体验

1. 打开链接，输入任意用户名进入聊天
2. 发送文本消息，选择图片/视频发送多媒体消息，或录制语音消息
3. 页面会展示 `Thinking...` 动画
4. 等待"AI"回复（实际上是部署者在后台手动输入）

### 部署者后台

1. 本地配置 `ADMIN_API_TOKEN`
2. 运行 `npm run dev` 后访问 `/admin`
3. 管理后台会通过服务端代理自动附带管理 token
4. 待回复会话会显示橙色标记并排在最前面
5. 选择会话，在底部输入框输入回复并发送
6. 用户聊天页将显示回复，Thinking 消失
7. 点击“本地归档”可下载当前会话归档包，并自行选择保存位置

## 技术栈

- **前端**: Next.js 16 (App Router, Turbopack)
- **后端**: Python FastAPI
- **语言**: TypeScript + Python
- **样式**: Tailwind CSS v4
- **存储**: 本地 PostgreSQL + 本地附件文件
- **部署**: Linux/Docker Compose

## 本地开发

```bash
npm install
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm run dev
```

打开 http://localhost:3000

- `/login` — 登录页
- `/chat` — 用户聊天页
- `/admin` — 本地管理员后台（生产环境默认隐藏）

### 环境变量

复制 `.env.example` 为 `.env.local` 并填入：

```bash
DATABASE_URL=postgres://hjhllm:...@127.0.0.1:5432/hjhllm
ATTACHMENT_STORAGE_DIR=.data/attachments
BACKEND_API_BASE_URL=http://127.0.0.1:8000
ADMIN_API_TOKEN=...
```

浏览器端仍只请求同源 `/api/*`。`frontend/app/api/[...path]/route.ts` 作为统一薄代理转发到 Python 后端 `BACKEND_API_BASE_URL`；管理后台浏览器端请求 `/api/admin-panel/*`，由独立 Next 代理附带 `ADMIN_API_TOKEN` 请求后端管理 API。

### 本地 PostgreSQL 配置

1. 创建 `.env.local`，至少设置 `DATABASE_URL`、`ATTACHMENT_STORAGE_DIR` 和 `ADMIN_API_TOKEN`。
2. 启动本地 PostgreSQL：

```bash
POSTGRES_PASSWORD=replace-with-password docker compose -f docker-compose.postgres.yml up -d
```

3. 执行迁移：

```bash
psql "$DATABASE_URL" -f db/migrations/001_initial_chat_schema.sql
```

4. 确认表已创建：`users`、`conversations`、`messages`、`attachments`。

### Python 后端

本地启动：

```bash
set -a; source .env.local; set +a
backend/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Docker 启动：

```bash
docker compose -f docker-compose.backend.yml up -d --build
```

### 本地管理端

本地调试本项目数据时，先启动 Python 后端，再启动 Next：

```bash
set -a; source .env.local; set +a
backend/.venv/bin/uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
npm run dev
```

### 本地归档

管理端的“本地归档”会由 Python 后端生成 zip，并通过 Next 代理触发浏览器下载框：

```text
<归档时间_用户名_标题_会话ID>.zip
├── conversation.md
├── img/
├── voice/
└── video/
```

`conversation.md` 保存会话信息、文字消息和附件相对链接；图片、语音、视频分别打包到对应目录。归档保存位置由管理员在浏览器下载流程中选择。

### 测试流程

本阶段固定为两段验证：

```bash
npm run lint
npm run build
npm run test:smoke -- http://127.0.0.1:3000
```

Smoke 测试需要 Python 后端和 Next dev server 都已启动。测试覆盖文本消息、管理员回复、多图附件上传、音频附件上传、视频附件上传、消息读取和临时数据清理。

## 配额与备份

### 文件大小限制

- 图片：10MB
- 音频：20MB
- 视频：50MB

这些限制在前端 `frontend/lib/contracts/attachments.ts` 和后端 `backend/app/infra/storage.py` 中保持一致。

### 本地数据注意事项

- PostgreSQL 数据保存在 Docker volume `hjhllm-postgres-data`。
- 附件文件保存在 `ATTACHMENT_STORAGE_DIR`，默认是项目内 `.data/attachments`。
- 附件访问 URL 由应用内 `/api/attachments/files/*` 提供。
- `DATABASE_URL` 只能放在服务端环境变量中，不能暴露给浏览器。

### 数据备份

- Postgres 数据：使用 `pg_dump "$DATABASE_URL"`。
- 附件：定期备份 `ATTACHMENT_STORAGE_DIR`。
- 建议同时备份数据库行和附件目录；`attachments.storage_path` 是两者关联字段。

### 已知限制

- 匿名身份只依赖浏览器保存的 `userId`，不是强认证。
- 管理端使用单个 `ADMIN_API_TOKEN`，不是多管理员账号系统。
- 多模态附件只做上传、保存、展示，不做 AI 解析、转写或摘要。
- 当前实时链路仍保留轮询；WebSocket 将在 Python 后端稳定后接入。
- 本地磁盘容量不足时需要扩容云盘或迁移附件目录。

## 项目结构

```
├── frontend
│   ├── app                 # Next.js App Router 与 BFF 代理
│   ├── components          # 通用 UI 与消息展示组件
│   ├── features            # chat / admin 功能模块
│   ├── lib                 # 前端 API client、契约类型与 Next 代理工具
│   └── public              # 品牌与头像静态资源
├── backend                 # FastAPI 后端
│   ├── api                 # HTTP 路由
│   ├── config              # 环境配置
│   ├── infra               # DB / 文件存储
│   └── services            # 聊天与归档业务
├── db/migrations           # PostgreSQL schema
└── docs                    # 项目文档
```

## 设计说明

- 用户端通过 Next.js 代理访问 Python FastAPI，后端读写本地 PostgreSQL
- 浏览器只保存匿名 `userId`，不保存完整消息数据
- 管理 API 在 Python 后端使用 `Authorization: Bearer ${ADMIN_API_TOKEN}` 鉴权
- 管理 UI 通过 `/api/admin-panel/*` Next 代理访问管理 API，避免在浏览器暴露管理 token
- 线上生产环境默认不暴露 `/admin` 管理 UI
- 图片、语音和视频附件存储在本地附件目录，通过应用内文件路由展示
- 语音消息通过浏览器 `MediaRecorder` 录制，并复用附件上传链路保存
- 视频消息复用附件上传链路，前端和服务端限制单个视频最大 50MB
- UI 参考 `img/` 中的 Claude/Gemini 风格：浅蓝灰背景、白色浮层输入框、圆形头像消息
- 用户头像临时使用用户名首字符；管理员头像使用 `frontend/public/brand/admin-avatar.jpg`
- 左上角品牌标识使用 `frontend/public/brand/oyster-logo.webp`
