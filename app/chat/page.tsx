"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  >(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;
    return getUserConversations(currentUser.id)[0]?.id ?? null;
  });
  const [composerValue, setComposerValue] = useState("");
  const [, setRenderTick] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, isThinking]);

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

    if (!convId) {
      const conv = createConversation(user.id);
      convId = conv.id;
      setActiveConversationId(convId);
    }

    createMessage(convId, "user", content);

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
    setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    const store = getStore();
    store.currentUserId = null;
    setStore(store);
    router.replace("/login");
  };

  if (!user) return null;

  const sidebar = (
    <aside className="flex flex-col bg-sidebar border-r border-border h-full">
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
            onClick={() => handleSelectConversation(conv.id)}
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
  );

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <div className="hidden md:block w-[260px] flex-shrink-0 h-full">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/20"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="w-[280px] h-full shadow-xl">{sidebar}</div>
        </div>
      )}

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Top bar (mobile only) */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted hover:text-foreground transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
          <h1 className="text-sm font-semibold text-foreground">HJH LLM</h1>
          {activeConversationId && (
            <span className="text-xs text-muted truncate flex-1">
              {conversations.find((c) => c.id === activeConversationId)?.title}
            </span>
          )}
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
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
                <div className="max-w-[85%] md:max-w-[80%]">
                  <div
                    className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-bubble-user text-foreground"
                        : "text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <div
                    className={`text-[10px] text-muted mt-1 ${
                      msg.sender === "user" ? "text-right" : "text-left"
                    }`}
                  >
                    {formatTime(msg.createdAt)}
                  </div>
                </div>
              </div>
            ))}

            {isThinking && <ThinkingBubble />}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="flex-shrink-0 border-t border-border bg-background">
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-4">
            <div className="flex items-end gap-2 md:gap-3">
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
