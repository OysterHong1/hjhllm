# HJH LLM

一个有趣的"假 LLM"聊天室。用户以为自己在和 AI 对话（显示 Thinking...），实际上回复由部署者在后台手动输入。

## 如何使用

### 普通用户体验

1. 打开链接，输入任意用户名进入聊天
2. 发送消息，页面会展示 `Thinking...` 动画
3. 等待"AI"回复（实际上是部署者在后台手动输入）

### 部署者后台

1. 访问 `/admin` 查看所有用户会话
2. 待回复会话会显示橙色标记并排在最前面
3. 选择会话，在底部输入框输入回复并发送
4. 用户聊天页将显示回复，Thinking 消失
5. 点击"清空演示数据"可重置所有数据

## 技术栈

- **框架**: Next.js 16 (App Router, Turbopack)
- **语言**: TypeScript
- **样式**: Tailwind CSS v4
- **存储**: 浏览器 localStorage
- **部署**: Vercel

## 本地开发

```bash
npm install
npm run dev
```

打开 http://localhost:3000

- `/login` — 登录页
- `/chat` — 用户聊天页
- `/admin` — 管理员后台

## 项目结构

```
├── app
│   ├── login/page.tsx      # 登录页
│   ├── chat/page.tsx       # 用户聊天页
│   ├── admin/page.tsx      # 管理员后台
│   ├── not-found.tsx       # 404 页面
│   ├── layout.tsx          # 根布局
│   └── page.tsx            # 根路由 → /chat
├── components/ui           # UI 组件
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Textarea.tsx
├── lib
│   ├── store.ts            # localStorage 数据层
│   ├── chat.ts             # 聊天逻辑
│   ├── ids.ts              # ID 生成
│   └── time.ts             # 时间格式化
└── docs                    # 项目文档
```

## 设计说明

- 所有数据存储在浏览器 `localStorage`，无需后端或数据库
- 部署者只能看到自己浏览器中的会话数据（同设备演示）
- 本项目为趣味项目，第一版不做跨设备同步
