"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { getStore, setStore, resetStore } from "@/lib/store";
import {
  getConversationMessages,
  conversationNeedsReply,
  createMessage,
} from "@/lib/chat";
import { formatTime, nowISO } from "@/lib/time";

export default function AdminPage() {
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [renderTick, setRenderTick] = useState(0);
  const [replyContent, setReplyContent] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => setRenderTick((t) => t + 1), []);

  useEffect(() => {
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const store = getStore();
  const allConversations = store.conversations.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const sortedConversations = [...allConversations].sort((a, b) => {
    const aNeeds = conversationNeedsReply(a.id) ? 0 : 1;
    const bNeeds = conversationNeedsReply(b.id) ? 0 : 1;
    if (aNeeds !== bNeeds) return aNeeds - bNeeds;
    return (
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  });

  const activeConversation = allConversations.find(
    (c) => c.id === activeConversationId
  );

  const messages = activeConversationId
    ? getConversationMessages(activeConversationId)
    : [];

  const activeUser = activeConversation
    ? store.users.find((u) => u.id === activeConversation.userId)
    : null;

  // Auto-select first conversation
  useEffect(() => {
    if (sortedConversations.length > 0 && !activeConversationId) {
      setActiveConversationId(sortedConversations[0].id);
    }
  }, [sortedConversations, activeConversationId]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleClearData = () => {
    resetStore();
    setActiveConversationId(null);
    setReplyContent("");
    setShowClearConfirm(false);
    refresh();
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setReplyContent("");
    setSidebarOpen(false);
  };

  const handleReply = () => {
    const content = replyContent.trim();
    if (!content || !activeConversationId) return;

    createMessage(activeConversationId, "admin", content);

    const store = getStore();
    const conv = store.conversations.find(
      (c) => c.id === activeConversationId
    );
    if (conv) {
      conv.updatedAt = nowISO();
    }
    setStore(store);

    setReplyContent("");
    refresh();
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleReply();
    }
  };

  const sidebar = (
    <aside className="flex flex-col bg-sidebar border-r border-border h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="text-sm font-semibold text-foreground">管理后台</h1>
        <span className="text-xs text-muted">仅部署者</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">
          会话列表
        </div>
        {sortedConversations.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-muted">
            暂无会话
          </div>
        )}
        {sortedConversations.map((conv) => {
          const needsReply = conversationNeedsReply(conv.id);
          const convUser = store.users.find((u) => u.id === conv.userId);
          return (
            <button
              key={conv.id}
              onClick={() => handleSelectConversation(conv.id)}
              className={`w-full text-left px-4 py-3 transition-colors hover:bg-[#ebebeb] ${
                activeConversationId === conv.id ? "bg-[#e8e8e8]" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">
                  {convUser?.username ?? "未知用户"}
                </span>
                {needsReply && (
                  <span className="inline-flex items-center rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                    待回复
                  </span>
                )}
              </div>
              <div className="truncate text-sm text-foreground mt-0.5">
                {conv.title}
              </div>
              <div className="text-xs text-muted mt-0.5">
                {formatTime(conv.updatedAt)}
              </div>
            </button>
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-border">
        {showClearConfirm ? (
          <div className="space-y-2">
            <p className="text-xs text-muted">确定清空所有数据？</p>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1 text-xs"
                onClick={handleClearData}
              >
                确认
              </Button>
              <Button
                variant="secondary"
                className="flex-1 text-xs"
                onClick={() => setShowClearConfirm(false)}
              >
                取消
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            className="w-full text-xs"
            onClick={() => setShowClearConfirm(true)}
          >
            清空演示数据
          </Button>
        )}
      </div>
    </aside>
  );

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <div className="hidden md:block w-[280px] flex-shrink-0 h-full">
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

      {/* Main admin area */}
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
          <h1 className="text-sm font-semibold text-foreground">管理后台</h1>
          {activeConversation && (
            <span className="text-xs text-muted truncate flex-1">
              {activeUser?.username}: {activeConversation.title}
            </span>
          )}
        </div>

        {/* Conversation detail */}
        <div className="hidden md:block border-b border-border px-6 py-3">
          <div className="text-xs text-muted">
            用户: {activeUser?.username ?? "—"}
          </div>
          <div className="text-sm font-medium text-foreground mt-0.5">
            {activeConversation?.title ?? "选择一个会话"}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[90%] md:max-w-[80%]">
                  <div
                    className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-bubble-user text-foreground"
                        : "bg-blue-50 text-foreground border border-blue-100"
                    }`}
                  >
                    <div className="text-[10px] text-muted mb-1">
                      {msg.sender === "user" ? "用户" : "管理员"}
                      {" · "}
                      {formatTime(msg.createdAt)}
                    </div>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}

            {activeConversationId && messages.length === 0 && (
              <div className="text-center text-sm text-muted py-12">
                暂无消息
              </div>
            )}

            {!activeConversationId && (
              <div className="text-center text-sm text-muted py-12">
                选择左侧会话查看详情
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Reply box */}
        {activeConversationId && (
          <div className="flex-shrink-0 border-t border-border bg-sidebar">
            <div className="max-w-3xl mx-auto px-4 md:px-6 py-4">
              <div className="text-xs text-muted mb-2">回复消息</div>
              <div className="flex items-end gap-3">
                <Textarea
                  placeholder="输入回复..."
                  className="flex-1"
                  rows={2}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onKeyDown={handleReplyKeyDown}
                />
                <Button
                  onClick={handleReply}
                  disabled={!replyContent.trim()}
                >
                  回复
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
