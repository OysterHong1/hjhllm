"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import {
  getCurrentUser,
  getStore,
  setStore,
} from "@/lib/store";
import {
  getUserConversations,
  getConversationMessages,
  createConversation,
  createMessage,
  makeConversationTitle,
} from "@/lib/chat";
import { formatTime, nowISO } from "@/lib/time";

export default function ChatPage() {
  const router = useRouter();
  const user = getCurrentUser();
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [composerValue, setComposerValue] = useState("");
  const [renderTick, setRenderTick] = useState(0);

  // Route protection
  useEffect(() => {
    if (!getCurrentUser()) {
      router.replace("/login");
    }
  }, [router]);

  const refresh = useCallback(() => setRenderTick((t) => t + 1), []);

  const conversations = user
    ? getUserConversations(user.id)
    : [];

  const activeMessages = activeConversationId
    ? getConversationMessages(activeConversationId)
    : [];

  const isThinking =
    activeMessages.length > 0 &&
    activeMessages[activeMessages.length - 1].sender === "user";

  // Auto-select first conversation on mount
  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  // Cross-tab store change listener
  useEffect(() => {
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const handleSend = () => {
    const content = composerValue.trim();
    if (!content || !user) return;

    let convId = activeConversationId;

    // Auto-create conversation if none is active
    if (!convId) {
      const conv = createConversation(user.id);
      convId = conv.id;
      setActiveConversationId(convId);
    }

    // Create the user message
    createMessage(convId, "user", content);

    // Update conversation title if this is the first message
    const store = getStore();
    const conv = store.conversations.find((c) => c.id === convId);
    if (conv && conv.title === "新的会话") {
      conv.title = makeConversationTitle(content);
      conv.updatedAt = nowISO();
    } else if (conv) {
      conv.updatedAt = nowISO();
    }
    setStore(store);

    setComposerValue("");
    refresh();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setComposerValue("");
  };

  const handleLogout = () => {
    const store = getStore();
    store.currentUserId = null;
    setStore(store);
    router.replace("/login");
  };

  if (!user) return null;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-[260px] flex-shrink-0 flex flex-col bg-sidebar border-r border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h1 className="text-sm font-semibold text-foreground">HJH LLM</h1>
          <Button
            variant="ghost"
            className="text-xs px-2 py-1"
            onClick={handleNewConversation}
          >
            新建会话
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-muted">
              暂无会话，发送消息开始
            </div>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConversationId(conv.id)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[#ebebeb] ${
                activeConversationId === conv.id ? "bg-[#e8e8e8]" : ""
              }`}
            >
              <div className="truncate text-foreground">{conv.title}</div>
              <div className="text-xs text-muted mt-0.5">
                {formatTime(conv.updatedAt)}
              </div>
            </button>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <div className="text-xs text-muted">{user.username}</div>
          <button
            onClick={handleLogout}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            退出
          </button>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {!activeConversationId && (
              <div className="text-center text-sm text-muted py-12">
                选择一个会话或新建会话开始聊天
              </div>
            )}

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
              <ThinkingBubble />
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

function ThinkingBubble() {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const text = "Thinking" + ".".repeat(dots);

  return (
    <div className="flex justify-start">
      <div className="text-sm text-muted italic px-4 py-1 select-none min-w-[100px]">
        {text}
      </div>
    </div>
  );
}
