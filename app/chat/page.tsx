"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

// Static mock data for Phase 1
const mockConversations = [
  { id: "1", title: "你好，今天天气怎么样？", updatedAt: "10:30" },
  { id: "2", title: "帮我写一段代码", updatedAt: "09:15" },
  { id: "3", title: "什么是机器学习？", updatedAt: "昨天" },
];

const mockMessages: Record<string, { id: string; sender: string; content: string }[]> = {
  "1": [
    { id: "m1", sender: "user", content: "你好，今天天气怎么样？" },
    { id: "m2", sender: "admin", content: "你好！今天天气不错，阳光明媚。" },
  ],
  "2": [
    { id: "m3", sender: "user", content: "帮我写一段代码" },
    { id: "m4", sender: "admin", content: "当然，请问你需要什么语言？" },
    { id: "m5", sender: "user", content: "Python" },
    { id: "m6", sender: "admin", content: "好的，这是一个简单的 Python 函数示例：\n\ndef greet(name):\n    return f\"Hello, {name}!\"\n\nprint(greet(\"World\"))" },
  ],
  "3": [
    { id: "m7", sender: "user", content: "什么是机器学习？" },
    { id: "m8", sender: "admin", content: "机器学习是人工智能的一个分支，它使计算机能够从数据中学习和改进，而无需进行明确的编程。常见的应用包括图像识别、自然语言处理和推荐系统等。" },
  ],
};

export default function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState("1");
  const [composerValue, setComposerValue] = useState("");

  const activeConversation = mockConversations.find(
    (c) => c.id === activeConversationId
  );

  const activeMessages = mockMessages[activeConversationId] || [];

  const isThinking =
    activeMessages.length > 0 &&
    activeMessages[activeMessages.length - 1].sender === "user";

  const handleSend = () => {
    // Phase 3 will implement actual message sending
    setComposerValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-[260px] flex-shrink-0 flex flex-col bg-sidebar border-r border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h1 className="text-sm font-semibold text-foreground">HJH LLM</h1>
          <Button variant="ghost" className="text-xs px-2 py-1">
            新建会话
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {mockConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConversationId(conv.id)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[#ebebeb] ${
                activeConversationId === conv.id
                  ? "bg-[#e8e8e8]"
                  : ""
              }`}
            >
              <div className="truncate text-foreground">{conv.title}</div>
              <div className="text-xs text-muted mt-0.5">{conv.updatedAt}</div>
            </button>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-border">
          <div className="text-xs text-muted">当前用户: 游客</div>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {activeMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-bubble-user text-foreground"
                      : "text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Thinking indicator */}
            {isThinking && (
              <div className="flex justify-start">
                <div className="text-sm text-muted italic px-4 py-1">
                  Thinking...
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="flex-shrink-0 border-t border-border bg-background">
          <div className="max-w-3xl mx-auto px-6 py-4">
            <div className="flex items-end gap-3">
              <Textarea
                placeholder="输入消息..."
                value={composerValue}
                onChange={(e) => setComposerValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
                rows={2}
              />
              <Button
                onClick={handleSend}
                disabled={!composerValue.trim()}
              >
                发送
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
