"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

// Static mock data for Phase 1
const mockConversations = [
  { id: "1", userId: "u1", user: "小明", title: "你好，今天天气怎么样？", updatedAt: "10:30", needsReply: true },
  { id: "2", userId: "u2", user: "小红", title: "帮我写一段代码", updatedAt: "09:15", needsReply: false },
  { id: "3", userId: "u1", user: "小明", title: "什么是机器学习？", updatedAt: "昨天", needsReply: true },
];

const allMessages: Record<string, { id: string; sender: string; content: string; createdAt: string }[]> = {
  "1": [
    { id: "m1", sender: "user", content: "你好，今天天气怎么样？", createdAt: "10:30" },
  ],
  "2": [
    { id: "m3", sender: "user", content: "帮我写一段代码", createdAt: "09:15" },
    { id: "m4", sender: "admin", content: "当然，请问你需要什么语言？", createdAt: "09:16" },
    { id: "m5", sender: "user", content: "Python", createdAt: "09:17" },
    { id: "m6", sender: "admin", content: "好的，这是一个简单的 Python 函数示例：\n\ndef greet(name):\n    return f\"Hello, {name}!\"\n\nprint(greet(\"World\"))", createdAt: "09:18" },
  ],
  "3": [
    { id: "m7", sender: "user", content: "什么是机器学习？", createdAt: "昨天" },
  ],
};

export default function AdminPage() {
  const [activeConversationId, setActiveConversationId] = useState("1");

  const activeConversation = mockConversations.find(
    (c) => c.id === activeConversationId
  );

  const messages = allMessages[activeConversationId] || [];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-[280px] flex-shrink-0 flex flex-col bg-sidebar border-r border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h1 className="text-sm font-semibold text-foreground">
            管理后台
          </h1>
          <span className="text-xs text-muted">仅部署者</span>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <div className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">
            会话列表
          </div>
          {mockConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConversationId(conv.id)}
              className={`w-full text-left px-4 py-3 transition-colors hover:bg-[#ebebeb] ${
                activeConversationId === conv.id
                  ? "bg-[#e8e8e8]"
                  : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">{conv.user}</span>
                {conv.needsReply && (
                  <span className="inline-flex items-center rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                    待回复
                  </span>
                )}
              </div>
              <div className="truncate text-sm text-foreground mt-0.5">
                {conv.title}
              </div>
              <div className="text-xs text-muted mt-0.5">{conv.updatedAt}</div>
            </button>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-border">
          <Button variant="secondary" className="w-full text-xs">
            清空演示数据
          </Button>
        </div>
      </aside>

      {/* Main admin area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Conversation detail */}
        <div className="border-b border-border px-6 py-3">
          <div className="text-xs text-muted">
            用户: {activeConversation?.user}
          </div>
          <div className="text-sm font-medium text-foreground mt-0.5">
            {activeConversation?.title}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-bubble-user text-foreground"
                      : "bg-blue-50 text-foreground border border-blue-100"
                  }`}
                >
                  <div className="text-[10px] text-muted mb-1">
                    {msg.sender === "user" ? "用户" : "管理员"}
                  </div>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {messages.length === 0 && (
              <div className="text-center text-sm text-muted py-12">
                暂无消息
              </div>
            )}
          </div>
        </div>

        {/* Reply box */}
        <div className="flex-shrink-0 border-t border-border bg-sidebar">
          <div className="max-w-3xl mx-auto px-6 py-4">
            <div className="text-xs text-muted mb-2">回复消息</div>
            <div className="flex items-end gap-3">
              <Textarea
                placeholder="输入回复..."
                className="flex-1"
                rows={2}
              />
              <Button>
                回复
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
