# HJH LLM Development Plan

## 1. 开发原则

本项目按趣味项目处理，第一版以“能玩、轻、快”为核心。

- 不部署数据库。
- 不设计后端 API。
- 不引入真实认证。
- 不接实时服务。
- 所有数据保存在浏览器 `localStorage`。
- 管理员回复也在同一前端应用内完成。

## 2. 技术路线

推荐技术栈：

- Framework: Next.js App Router
- Language: TypeScript
- UI: React + Tailwind CSS
- Storage: localStorage
- Hosting: Vercel

如果后续希望更轻，也可以改用 Vite + React。但考虑部署便利和未来扩展，第一版仍可使用 Next.js。

## 3. 推荐目录结构

```text
.
├── app
│   ├── login
│   │   └── page.tsx
│   ├── chat
│   │   └── page.tsx
│   ├── admin
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components
│   ├── admin
│   ├── chat
│   └── ui
├── lib
│   ├── store.ts
│   ├── ids.ts
│   ├── time.ts
│   └── chat.ts
├── docs
│   ├── hjh.md
│   ├── prd.md
│   └── development-plan.md
└── package.json
```

## 4. 本地数据设计

统一使用一个 `localStorage` key：

```text
hjhllm.store
```

核心类型：

```ts
type Store = {
  currentUserId: string | null;
  users: User[];
  conversations: Conversation[];
  messages: Message[];
};

type User = {
  id: string;
  username: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type Message = {
  id: string;
  conversationId: string;
  sender: "user" | "admin";
  content: string;
  createdAt: string;
};
```

`lib/store.ts` 负责：

- 初始化默认 store。
- 读取 store。
- 写入 store。
- 清空 store。
- 订阅同页面内的数据变化。

## 5. 核心交互规则

### 5.1 登录

- 用户输入用户名。
- 创建本地 user。
- 设置 `currentUserId`。
- 跳转 `/chat`。

### 5.2 发送消息

- 如果没有当前会话，先创建会话。
- 写入一条 `sender: "user"` 的消息。
- 更新会话标题和更新时间。
- 当前会话最后一条消息来自用户时，聊天页展示 Thinking。

### 5.3 管理员回复

- `/admin` 读取全部会话。
- 待回复会话排在前面。
- 管理员选择会话并输入回复。
- 写入一条 `sender: "admin"` 的消息。
- 更新会话更新时间。

### 5.4 Thinking 计算

```ts
function isThinking(messages: Message[]) {
  const last = messages[messages.length - 1];
  return last?.sender === "user";
}
```

Thinking 状态不入库、不写入 `localStorage`。

## 6. 阶段性开发目标

### Phase 1: 项目初始化与静态页面

目标：

- 初始化 Next.js + TypeScript + Tailwind。
- 建立 `/login`、`/chat`、`/admin` 三个页面。
- 完成基础布局。
- 确定 Claude 风格的颜色、间距和排版。

开发内容：

- 创建应用骨架。
- 创建全局样式。
- 创建基础按钮、输入框、文本域组件。
- `/chat` 先用静态假数据展示会话栏和消息区。
- `/admin` 先用静态假数据展示后台结构。

本阶段测试：

- 本地开发服务可启动。
- 三个页面都能访问。
- 桌面端布局不溢出。
- 移动端页面主体可阅读。
- 输入框、按钮样式一致。

完成标准：

- 可以看到完整静态界面。
- 视觉方向接近 Claude 的简洁聊天体验。

### Phase 2: localStorage 数据层

目标：

- 实现本地 store。
- 实现假登录。
- 支持刷新后恢复当前用户。

开发内容：

- 编写 `lib/store.ts`。
- 编写 id 生成工具。
- 编写时间格式化工具。
- `/login` 写入用户信息。
- `/chat` 读取当前用户。
- 未登录访问 `/chat` 时引导回 `/login`。

本阶段测试：

- 输入用户名后可进入聊天页。
- 刷新页面后仍保持登录状态。
- 清除浏览器 localStorage 后回到未登录状态。
- 空用户名不能登录。
- 多次登录不会破坏已有 store 结构。

完成标准：

- 假登录完整可用。
- `hjhllm.store` 中能看到结构化用户数据。

### Phase 3: 用户聊天闭环

目标：

- 用户可以新建会话。
- 用户可以发送消息。
- 会话和消息持久化到 `localStorage`。
- 用户消息后展示 Thinking。

开发内容：

- 实现会话列表。
- 实现新建会话。
- 实现消息发送。
- 实现消息列表渲染。
- 实现 Thinking 动画。
- 实现会话标题自动生成。

本阶段测试：

- 新用户可以发送第一条消息并自动创建会话。
- 空消息不能发送。
- 发送消息后输入框清空。
- 刷新后会话和消息仍存在。
- 最后一条消息来自用户时显示 Thinking。
- 新建多个会话后，左侧列表按更新时间排序。

完成标准：

- 用户端已经是一个可玩的假 LLM 聊天界面。

### Phase 4: 管理员本地后台

目标：

- 部署者可以在 `/admin` 查看本地所有会话。
- 部署者可以对会话写入回复。
- 回复后用户端 Thinking 消失。

开发内容：

- 实现管理员会话列表。
- 实现待回复状态计算。
- 实现会话详情。
- 实现管理员回复框。
- 实现回复写入 `localStorage`。
- 实现清空演示数据功能和二次确认。

本阶段测试：

- `/admin` 能看到用户在 `/chat` 创建的会话。
- 待回复会话有明显标记。
- 管理员回复后，消息出现在对应会话。
- 回到 `/chat` 后可以看到管理员回复。
- 回复后 Thinking 不再显示。
- 清空数据后 `/login`、`/chat`、`/admin` 状态合理。

完成标准：

- 用户发送、管理员回复、用户查看回复的本地闭环完成。

### Phase 5: 打磨与部署

目标：

- 完成可演示版本。
- 优化响应式体验。
- 部署到 Vercel。

开发内容：

- 优化移动端布局。
- 增加空状态。
- 增加错误和边界状态。
- 增加 README 使用说明。
- 配置 Vercel 部署。

本阶段测试：

- 首次打开应用路径正确。
- 未登录访问 `/chat` 会被引导登录。
- 已登录用户打开根路径可进入聊天。
- 移动端可完成登录、发送消息、查看回复。
- 刷新页面不会丢失数据。
- Vercel 部署后静态页面可访问。

完成标准：

- 项目可以通过链接演示。
- 不依赖数据库或额外服务。

## 7. 组件拆分

### 7.1 Chat

- `ChatLayout`
- `ConversationSidebar`
- `ConversationListItem`
- `MessageList`
- `MessageBubble`
- `ThinkingBubble`
- `MessageComposer`

### 7.2 Admin

- `AdminLayout`
- `AdminConversationList`
- `AdminConversationItem`
- `AdminMessageList`
- `AdminReplyBox`

### 7.3 UI

- `Button`
- `Input`
- `Textarea`
- `EmptyState`
- `ConfirmDialog`

## 8. 工具函数拆分

### 8.1 `lib/store.ts`

- `getStore`
- `setStore`
- `resetStore`
- `updateStore`
- `getCurrentUser`

### 8.2 `lib/chat.ts`

- `createUser`
- `createConversation`
- `createMessage`
- `getUserConversations`
- `getConversationMessages`
- `conversationNeedsReply`
- `makeConversationTitle`

### 8.3 `lib/ids.ts`

- `createId`

可以优先使用 `crypto.randomUUID()`，不兼容时降级到时间戳加随机数。

## 9. 主要风险

### 9.1 localStorage 无法跨设备共享

这是本项目第一版的明确取舍。它适合本地演示和趣味体验，不适合真实线上多人聊天。

### 9.2 部署后管理员无法看到其他设备用户数据

因为数据保存在访问者自己的浏览器中，部署者只能看到自己浏览器里的数据。若需要真实收集其他用户消息，必须引入后端存储。

第一版可以通过“同设备演示”满足趣味闭环。

### 9.3 localStorage 容量有限

纯文本聊天数据量较小，第一版可接受。后续可增加导出或清空功能。

## 10. MVP 完成定义

MVP 完成需要满足：

- `/login` 可完成假登录。
- `/chat` 可发送消息并保存本地记录。
- `/chat` 可展示历史会话。
- 用户消息后展示 `Thinking...`。
- `/admin` 可查看本地所有会话。
- `/admin` 可写入管理员回复。
- 回复后 `/chat` 展示回复且 Thinking 消失。
- 刷新页面后数据仍存在。
- 可清空演示数据。
- 可部署到 Vercel。
