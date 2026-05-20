# HJH LLM 开发日志

## 概述

| 日期 | Phase | 主题 | 提交 |
|------|-------|------|------|
| 2026-05-19 | P1 | 项目初始化与静态页面 | `83fc4eb` |
| 2026-05-19 | P2 | localStorage 数据层 | `a8f1fd4` |
| 2026-05-19 | P3 | 用户聊天闭环 | `7d8b15d` |
| 2026-05-20 | P5 | 打磨与部署 | `7120a5b` |

仓库: `git@github.com:OysterHong1/hjhllm.git`  
线上地址: https://hjhllm.vercel.app

---

## Phase 1: 项目初始化与静态页面

**目标**: 搭建 Next.js 骨架，创建三个页面的静态布局，确立 Claude 风格视觉方向。

**完成内容**:
- 初始化 Next.js 16 + TypeScript + Tailwind CSS v4（App Router, Turbopack）
- 全局样式: Claude 风格浅色主题（`#fafafa` 背景, Geist 字体, 低饱和度灰色系）
- 根路由 `/` → 307 重定向至 `/chat`
- `/login` — 居中卡片，用户名输入 + "进入聊天"按钮
- `/chat` — 左侧会话栏(260px) + 右侧消息区 + 底部输入框，静态 mock 数据，已修复会话隔离问题
- `/admin` — 左侧会话列表(280px, 待回复徽章) + 右侧会话详情 + 回复框
- 基础 UI 组件: `Button`(primary/secondary/ghost)、`Input`、`Textarea`

**修复记录**:
- 修复了 mock 消息未按 conversationId 过滤导致所有会话消息混合展示的问题，将扁平数组改为 `Record<conversationId, Message[]>`

**验证**: TypeScript 零错误，三条页面全部返回 200，根路径重定向正常。

---

## Phase 2: localStorage 数据层

**目标**: 实现本地持久化存储，假登录流程，路由守卫。

**新增文件**:

| 文件 | 职责 |
|------|------|
| `lib/store.ts` | `Store`/`User`/`Conversation`/`Message` 类型定义, `getStore`/`setStore`/`resetStore`/`updateStore`/`getCurrentUser` |
| `lib/ids.ts` | `createId()` — `crypto.randomUUID()` 优先，降级 `Date.now() + Math.random()` |
| `lib/time.ts` | `formatTime()` 相对时间（刚刚 → X分钟前 → X小时前 → X天前 → X月X日），`nowISO()` |
| `lib/chat.ts` | `createUser` / `createConversation` / `createMessage` / `getUserConversations` / `getConversationMessages` / `conversationNeedsReply` / `makeConversationTitle` |

**页面改动**:

- `/login`: `createUser(username)` → 写入 store → 跳转 `/chat`；已登录用户自动跳转
- `/chat`: `getCurrentUser()` 读取当前用户，未登录重定向 `/login`；显示用户名 + 退出按钮
- `/admin`: 从 store 读取全部会话和消息，待回复排序 + 橙黄色徽章，清空数据二次确认

**设计决策**:
- 所有数据存储在单一 key `hjhllm.store`，结构统一
- 登出仅清除 `currentUserId`，不删除用户和会话数据
- 多次登录（同名或不同名）用户追加到 users 数组，不破坏已有数据

**验证**: TypeScript 零错误，路由守卫生效，localStorage 持久化正常。

---

## Phase 3: 用户聊天闭环

**目标**: 用户可新建会话、发送消息，消息持久化，用户消息后展示 Thinking 动画。

**核心改动** (`app/chat/page.tsx`):

- `handleSend`: 
  1. 无活跃会话时自动 `createConversation` → 设置 `activeConversationId`
  2. `createMessage(convId, "user", content)` 写入 store
  3. 首条消息 → `makeConversationTitle(content)` 更新标题
  4. 更新 `conversation.updatedAt`
  5. 清空输入框 → `refresh()` 触发 UI 重渲染
- `handleNewConversation`: 置空 `activeConversationId`，下次发消息自动创建新会话
- `handleLogout`: 清除 `currentUserId` → 跳转 `/login`
- `ThinkingBubble` 组件: `setInterval` 每 500ms 循环 dots (0→1→2→3→0)，渲染 `Thinking` → `Thinking.` → `Thinking..` → `Thinking...`
- 同标签页刷新: `renderTick` state + `refresh()` 函数
- 跨标签页刷新: `window.addEventListener("storage", ...)`

**Thinking 展示规则**: 只由当前会话最后一条消息推导（不入库）
```ts
const isThinking = lastMsg?.sender === "user";
```

**验证**: TypeScript 零错误，消息发送 → 会话自动创建 → Thinking 动画 → 标题自动生成全流程通过。

---

## Phase 4: 管理员本地后台

**目标**: 部署者可在 `/admin` 查看所有会话并写入回复，回复后用户端 Thinking 消失。

**核心改动** (`app/admin/page.tsx`):

- `handleReply`:
  1. `createMessage(convId, "admin", content)` 写入 store
  2. 更新 `conv.updatedAt`
  3. 清空 `replyContent` → `refresh()`
- 回复输入框: `replyContent` state 控制，Enter 发送 / Shift+Enter 换行，空内容 disabled
- `handleSelectConversation`: 切换会话时清空回复输入框
- `handleClearData`: `resetStore()` + 复位所有 UI 状态
- 刷新机制: 1 秒轮询 + `storage` 事件监听双重保障

**已有功能（P2 已实现）**:
- 会话按待回复排序（待回复置顶），橙黄色 "待回复" 徽章
- 管理员消息以蓝底区分（`bg-blue-50`），标注 "管理员" 标签
- 清空数据二次确认（确认/取消按钮）

**完整闭环**:

```
用户发消息 → /chat 展示 Thinking...
          → /admin 显示 "待回复" 徽章
管理员回复  → /admin "待回复" 消失
          → /chat Thinking 消失，显示回复
```

**验证**: TypeScript 零错误，回复写入 → UI 刷新 → Thinking 消失全链路通过。

---

## 当前状态

- **5 个 Phase 完成 4 个**，MVP 核心闭环已可用
- 待 P5: 响应式打磨、空状态/错误边界、README、Vercel 部署
- 所有数据存储在浏览器 `localStorage`，无后端依赖
- 项目在同设备上可完成完整演示：登录 → 聊天 → 管理回复 → 查看回复

---

## Phase 5: 打磨与部署

**日期**: 2026-05-20  
**提交**: `7120a5b`

**目标**: 移动端适配、UI 打磨、部署上线。

**完成内容**:

- 移动端响应式: 侧边栏改为 overlay 模式（`<768px`），顶部汉堡菜单切换；选择会话后自动关闭侧边栏
- 消息时间戳: chat 和 admin 页面消息气泡下方显示相对时间
- 自动滚动: 新消息/Thinking 状态变化后自动 `scrollIntoView`
- 404 页面: 简洁的 404 页面，包含"返回聊天"链接
- README: 项目介绍、使用说明、技术栈、项目结构、本地开发命令
- Vercel 部署: 通过 Vercel CLI 部署到 production，域名 https://hjhllm.vercel.app
- 关联 GitHub 仓库，后续推送自动触发部署

**移动端布局策略**:
- 桌面端 (`>=768px`): 侧边栏固定显示，260px/280px 宽
- 移动端 (`<768px`): 全屏主区域 + 顶部导航栏 + 汉堡按钮，侧边栏 overlay 滑出
- 点击遮罩层或选择会话后自动关闭侧边栏
- 输入区、消息气泡、内边距均做了移动端适配

**线上验证**:
| 检查项 | 状态 |
|--------|------|
| `/` → `/chat` 重定向 | ✅ 307 |
| `/login`, `/chat`, `/admin` | ✅ 全部 200 |
| 404 页面 | ✅ 404 |
| 静态生成 | ✅ 7/7 页面 |

---

## 最终状态

- **5 个 Phase 全部完成**，MVP 已上线
- 线上地址: https://hjhllm.vercel.app
- 完整闭环: 登录 → 聊天(Thinking...) → 管理回复 → 查看回复
- 纯前端项目，零后端依赖，localStorage 存储
