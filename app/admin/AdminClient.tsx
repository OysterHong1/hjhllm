"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  archiveAdminConversation,
  clearStoredAdminToken,
  createAdminMessage,
  getAdminConversation,
  getAdminErrorMessage,
  getStoredAdminToken,
  listAdminConversations,
  resetDemoData,
  setStoredAdminToken,
} from "@/lib/api-client/admin";
import type { AdminConversation, Message } from "@/lib/contracts";
import { formatTime } from "@/lib/time";

export default function AdminClient() {
  const [adminToken, setAdminToken] = useState(() => getStoredAdminToken());
  const [tokenInput, setTokenInput] = useState(() => getStoredAdminToken());
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [activeConversation, setActiveConversation] =
    useState<AdminConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const refreshConversations = useCallback(
    async (preferredId?: string | null) => {
      if (!adminToken) return;
      const nextConversations = await listAdminConversations(adminToken);
      setConversations(nextConversations);

      const nextActiveId =
        preferredId ??
        activeConversationId ??
        nextConversations[0]?.id ??
        null;
      setActiveConversationId(nextActiveId);
      if (!nextActiveId) {
        setActiveConversation(null);
        setMessages([]);
      }
    },
    [activeConversationId, adminToken]
  );

  const refreshDetail = useCallback(
    async (conversationId: string) => {
      if (!adminToken) return;
      const detail = await getAdminConversation(adminToken, conversationId);
      setActiveConversation(detail.conversation);
      setMessages(detail.messages);
    },
    [adminToken]
  );

  useEffect(() => {
    if (!adminToken) return;

    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        await refreshConversations();
      } catch (error) {
        if (!cancelled) setErrorMessage(getAdminErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [adminToken, refreshConversations]);

  useEffect(() => {
    if (!adminToken || !activeConversationId) return;

    const currentConversationId = activeConversationId;
    let cancelled = false;
    async function loadDetail() {
      try {
        await refreshDetail(currentConversationId);
      } catch (error) {
        if (!cancelled) setErrorMessage(getAdminErrorMessage(error));
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [activeConversationId, adminToken, refreshDetail]);

  useEffect(() => {
    if (!adminToken) return;

    const interval = window.setInterval(async () => {
      try {
        await refreshConversations(activeConversationId);
        if (activeConversationId) await refreshDetail(activeConversationId);
      } catch (error) {
        setErrorMessage(getAdminErrorMessage(error));
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [
    activeConversationId,
    adminToken,
    refreshConversations,
    refreshDetail,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleTokenSubmit = async () => {
    const nextToken = tokenInput.trim();
    if (!nextToken) return;
    setStoredAdminToken(nextToken);
    setAdminToken(nextToken);
  };

  const handleTokenLogout = () => {
    clearStoredAdminToken();
    setAdminToken("");
    setTokenInput("");
    setConversations([]);
    setActiveConversationId(null);
    setActiveConversation(null);
    setMessages([]);
    setErrorMessage("");
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setReplyContent("");
    setSidebarOpen(false);
    setErrorMessage("");
  };

  const handleReply = async () => {
    const content = replyContent.trim();
    if (!content || !activeConversationId || !adminToken || isReplying) return;

    setIsReplying(true);
    setErrorMessage("");
    try {
      const message = await createAdminMessage(
        adminToken,
        activeConversationId,
        content
      );
      setMessages((current) => [...current, message]);
      setReplyContent("");
      await refreshConversations(activeConversationId);
      await refreshDetail(activeConversationId);
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error));
    } finally {
      setIsReplying(false);
    }
  };

  const handleArchive = async () => {
    if (!adminToken || !activeConversationId) return;

    setErrorMessage("");
    try {
      await archiveAdminConversation(adminToken, activeConversationId);
      setActiveConversationId(null);
      setActiveConversation(null);
      setMessages([]);
      await refreshConversations(null);
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error));
    }
  };

  const handleClearData = async () => {
    if (!adminToken) return;

    setErrorMessage("");
    try {
      await resetDemoData(adminToken);
      setActiveConversationId(null);
      setActiveConversation(null);
      setMessages([]);
      setShowClearConfirm(false);
      await refreshConversations(null);
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error));
    }
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleReply();
    }
  };

  if (!adminToken) {
    return (
      <main className="flex h-full items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-sidebar p-5">
          <h1 className="text-base font-semibold text-foreground">
            管理后台
          </h1>
          <div className="mt-4 space-y-3">
            <Input
              type="password"
              placeholder="ADMIN_API_TOKEN"
              value={tokenInput}
              onChange={(event) => setTokenInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleTokenSubmit();
              }}
            />
            <Button
              className="w-full"
              disabled={!tokenInput.trim()}
              onClick={handleTokenSubmit}
            >
              进入
            </Button>
            {errorMessage && (
              <p className="text-xs text-accent">{errorMessage}</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  const sidebar = (
    <aside className="flex h-full flex-col border-r border-border bg-sidebar">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold text-foreground">管理后台</h1>
        <button
          onClick={handleTokenLogout}
          className="text-xs text-muted transition-colors hover:text-foreground"
        >
          退出
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted">
          会话列表
        </div>
        {isLoading && (
          <div className="px-4 py-8 text-center text-xs text-muted">
            加载中
          </div>
        )}
        {!isLoading && conversations.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-muted">
            暂无会话
          </div>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => handleSelectConversation(conv.id)}
            className={`w-full px-4 py-3 text-left transition-colors hover:bg-[#ebebeb] ${
              activeConversationId === conv.id ? "bg-[#e8e8e8]" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">
                {conv.user?.username ?? "未知用户"}
              </span>
              {conv.needsReply && (
                <span className="inline-flex items-center rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  待回复
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-sm text-foreground">
              {conv.title}
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {formatTime(conv.updatedAt)}
            </div>
          </button>
        ))}
      </div>

      <div className="border-t border-border px-4 py-3">
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
      <div className="hidden h-full w-[280px] flex-shrink-0 md:block">
        {sidebar}
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="flex-1 bg-black/20"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="h-full w-[280px] shadow-xl">{sidebar}</div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-muted transition-colors hover:text-foreground"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
          <h1 className="text-sm font-semibold text-foreground">管理后台</h1>
          {activeConversation && (
            <span className="flex-1 truncate text-xs text-muted">
              {activeConversation.user?.username}: {activeConversation.title}
            </span>
          )}
        </div>

        <div className="hidden border-b border-border px-6 py-3 md:block">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-muted">
                用户: {activeConversation?.user?.username ?? "—"}
              </div>
              <div className="mt-0.5 text-sm font-medium text-foreground">
                {activeConversation?.title ?? "选择一个会话"}
              </div>
            </div>
            {activeConversation && (
              <Button
                variant="secondary"
                className="text-xs"
                onClick={handleArchive}
              >
                归档
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 md:px-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div className="max-w-[90%] md:max-w-[80%]">
                  <div
                    className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-bubble-user text-foreground"
                        : "border border-blue-100 bg-blue-50 text-foreground"
                    }`}
                  >
                    <div className="mb-1 text-[10px] text-muted">
                      {msg.sender === "user" ? "用户" : "管理员"}
                      {" · "}
                      {formatTime(msg.createdAt)}
                    </div>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              </div>
            ))}

            {activeConversationId && messages.length === 0 && (
              <div className="py-12 text-center text-sm text-muted">
                暂无消息
              </div>
            )}

            {!activeConversationId && (
              <div className="py-12 text-center text-sm text-muted">
                选择左侧会话查看详情
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {errorMessage && (
          <div className="border-t border-border px-4 py-2 text-xs text-accent md:px-6">
            {errorMessage}
          </div>
        )}

        {activeConversationId && (
          <div className="flex-shrink-0 border-t border-border bg-sidebar">
            <div className="mx-auto max-w-3xl px-4 py-4 md:px-6">
              <div className="mb-2 text-xs text-muted">回复消息</div>
              <div className="flex items-end gap-3">
                <Textarea
                  placeholder="输入回复..."
                  className="flex-1"
                  rows={2}
                  value={replyContent}
                  onChange={(event) => setReplyContent(event.target.value)}
                  onKeyDown={handleReplyKeyDown}
                />
                <Button
                  onClick={handleReply}
                  disabled={!replyContent.trim() || isReplying}
                >
                  {isReplying ? "回复中" : "回复"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
