# HJH LLM

一个有趣的"假 LLM"聊天室。用户以为自己在和 AI 对话（显示 Thinking...），实际上回复由部署者在后台手动输入。

## 如何使用

### 普通用户体验

1. 打开链接，输入任意用户名进入聊天
2. 发送文本消息，选择图片发送图文消息，或录制语音消息
3. 页面会展示 `Thinking...` 动画
4. 等待"AI"回复（实际上是部署者在后台手动输入）

### 部署者后台

1. 本地配置 `ADMIN_API_TOKEN` 和 `NEXT_PUBLIC_API_BASE_URL`
2. 运行 `npm run dev` 后访问 `/admin`
3. 输入管理 token 查看所有用户会话
4. 待回复会话会显示橙色标记并排在最前面
5. 选择会话，在底部输入框输入回复并发送
6. 用户聊天页将显示回复，Thinking 消失

## 技术栈

- **框架**: Next.js 16 (App Router, Turbopack)
- **语言**: TypeScript
- **样式**: Tailwind CSS v4
- **存储**: Supabase Postgres + Storage
- **部署**: Vercel

## 本地开发

```bash
npm install
npm run dev
```

打开 http://localhost:3000

- `/login` — 登录页
- `/chat` — 用户聊天页
- `/admin` — 本地管理员后台（生产环境默认隐藏）

### 环境变量

复制 `.env.example` 为 `.env.local` 并填入：

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_API_TOKEN=...
NEXT_PUBLIC_API_BASE_URL=https://hjhllm.vercel.app
```

本地管理后台默认请求 `NEXT_PUBLIC_API_BASE_URL`；留空则请求同源 API。

### 测试流程

本阶段固定为两段验证：

```bash
npm run lint
npm run build
npm run test:smoke:local
npm run test:smoke:vercel
```

`test:smoke:local` 需要本地 dev server 正在运行；`test:smoke:vercel` 会请求 `https://hjhllm.vercel.app`。Smoke 测试覆盖文本消息、管理员回复、多图附件上传、音频附件上传、消息读取和临时数据清理。

## 项目结构

```
├── app
│   ├── login/page.tsx      # 登录页
│   ├── chat/page.tsx       # 用户聊天页
│   ├── admin/page.tsx      # 本地管理员后台入口
│   ├── not-found.tsx       # 404 页面
│   ├── layout.tsx          # 根布局
│   └── page.tsx            # 根路由 → /chat
├── components/ui           # UI 组件
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Textarea.tsx
├── lib
│   ├── api-client          # 浏览器端 API client
│   ├── server              # 服务端 Supabase 与 repository
│   ├── chat.ts             # 聊天逻辑
│   ├── ids.ts              # ID 生成
│   └── time.ts             # 时间格式化
└── docs                    # 项目文档
```

## 设计说明

- 用户端通过 Next.js Route Handler 读写 Supabase
- 浏览器只保存匿名 `userId`，不保存完整消息数据
- 管理 API 使用 `Authorization: Bearer ${ADMIN_API_TOKEN}` 鉴权
- 线上生产环境默认不暴露 `/admin` 管理 UI
- 图片附件存储在 Supabase private bucket，通过短期 signed URL 展示
- 语音消息通过浏览器 `MediaRecorder` 录制，并复用附件上传链路保存
