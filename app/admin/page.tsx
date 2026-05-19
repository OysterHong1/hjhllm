"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { getStore, resetStore, type Conversation } from "@/lib/store";
import {
  getConversationMessages,
  conversationNeedsReply,
} from "@/lib/chat";
import { formatTime } from "@/lib/time";

export default function AdminPage() {
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [renderTick, setRenderTick] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const refresh = useCallback(() => setRenderTick((t) => t + 1), []);

  // Store change listener
  useEffect(() => {
    const onStorage = () => refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  // Poll for changes within same tab
  useEffect(() => {
    const interval = setInterval(refresh, 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const store = getStore();
  const allConversations = store.conversations.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  // Sort: needs reply first
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

  const handleClearData = () => {
    resetStore();
    setActiveConversationId(null);
    setShowClearConfirm(false);
    refresh();
  };

  const handleReply = () => {
    // Phase 4 will implement actual reply logic
  };

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
                onClick={() => setActiveConversationId(conv.id)}
                className={`w-full text-left px-4 py-3 transition-colors hover:bg-[#ebebeb] ${
                  activeConversationId === conv.id
                    ? "bg-[#e8e8e8]"
                    : ""
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

      {/* Main admin area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Conversation detail */}
        <div className="border-b border-border px-6 py-3">
          <div className="text-xs text-muted">
            用户: {activeUser?.username ?? "—"}
          </div>
          <div className="text-sm font-medium text-foreground mt-0.5">
            {activeConversation?.title ?? "选择一个会话"}
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
          </div>
        </div>

        {/* Reply box */}
        {activeConversationId && (
          <div className="flex-shrink-0 border-t border-border bg-sidebar">
            <div className="max-w-3xl mx-auto px-6 py-4">
              <div className="text-xs text-muted mb-2">回复消息</div>
              <div className="flex items-end gap-3">
                <Textarea
                  placeholder="输入回复..."
                  className="flex-1"
                  rows={2}
                />
                <Button onClick={handleReply}>回复</Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
