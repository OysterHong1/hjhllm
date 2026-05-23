"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/chat/BrandMark";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import {
  archiveAdminConversationLocally,
  createAdminMessage,
  getAiReplyConfig,
  getAdminConversation,
  getAdminErrorMessage,
  listAdminConversations,
  resetDemoData,
  setAiReplyEnabled,
  updateAiReplyConfig,
} from "@/lib/api-client/admin";
import type { AdminConversation, AiReplyConfig, Message } from "@/lib/contracts";
import { AdminSidebar } from "./AdminSidebar";

type AiReplyDraft = {
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  reasoningEffort: string;
};

function aiConfigToDraft(config: AiReplyConfig): AiReplyDraft {
  return {
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: "",
    systemPrompt: config.systemPrompt,
    reasoningEffort: config.reasoningEffort,
  };
}

export default function AdminClient() {
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
  const [isArchiving, setIsArchiving] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiReplyConfig | null>(null);
  const [aiDraft, setAiDraft] = useState<AiReplyDraft | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [isAiSaving, setIsAiSaving] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const knownConversationIdsRef = useRef<Set<string>>(new Set());
  const hasLoadedConversationsRef = useRef(false);
  const activeConversationIdRef = useRef<string | null>(null);
  const detailRequestIdRef = useRef(0);

  const setActiveConversationIdSafe = useCallback((id: string | null) => {
    activeConversationIdRef.current = id;
    setActiveConversationId(id);
  }, []);

  const notifyNewConversations = useCallback(
    (nextConversations: AdminConversation[]) => {
      const nextIds = new Set(
        nextConversations.map((conversation) => conversation.id)
      );

      if (!hasLoadedConversationsRef.current) {
        knownConversationIdsRef.current = nextIds;
        hasLoadedConversationsRef.current = true;
        return;
      }

      const newConversations = nextConversations.filter(
        (conversation) => !knownConversationIdsRef.current.has(conversation.id)
      );
      knownConversationIdsRef.current = nextIds;

      if (
        newConversations.length === 0 ||
        typeof window === "undefined" ||
        !("Notification" in window) ||
        Notification.permission !== "granted"
      ) {
        return;
      }

      newConversations.forEach((conversation) => {
        const notification = new Notification("有新的会话", {
          body: `${conversation.user?.username ?? "未知用户"}：${
            conversation.title
          }`,
          icon: "/brand/oyster-logo.webp",
          tag: conversation.id,
        });
        notification.onclick = () => {
          window.focus();
          setActiveConversationIdSafe(conversation.id);
        };
      });
    },
    [setActiveConversationIdSafe]
  );

  const refreshConversations = useCallback(
    async (preferredId?: string | null) => {
      const nextConversations = await listAdminConversations();
      notifyNewConversations(nextConversations);
      setConversations(nextConversations);

      const requestedActiveId =
        preferredId !== undefined
          ? preferredId
          : activeConversationIdRef.current;
      const nextActiveId =
        requestedActiveId &&
        nextConversations.some(
          (conversation) => conversation.id === requestedActiveId
        )
          ? requestedActiveId
          : nextConversations[0]?.id ?? null;

      if (activeConversationIdRef.current !== nextActiveId) {
        setActiveConversationIdSafe(nextActiveId);
      }
      if (!nextActiveId) {
        setActiveConversation(null);
        setMessages([]);
      }
    },
    [notifyNewConversations, setActiveConversationIdSafe]
  );

  const refreshDetail = useCallback(
    async (conversationId: string) => {
      const requestId = ++detailRequestIdRef.current;
      const detail = await getAdminConversation(conversationId);
      if (
        requestId !== detailRequestIdRef.current ||
        activeConversationIdRef.current !== conversationId
      ) {
        return;
      }
      setActiveConversation(detail.conversation);
      setMessages(detail.messages);
    },
    []
  );

  const loadAiConfig = useCallback(async () => {
    const config = await getAiReplyConfig();
    setAiConfig(config);
    setAiDraft(aiConfigToDraft(config));
  }, []);

  useEffect(() => {
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
  }, [refreshConversations]);

  useEffect(() => {
    let cancelled = false;
    async function loadConfig() {
      try {
        const config = await getAiReplyConfig();
        if (cancelled) return;
        setAiConfig(config);
        setAiDraft(aiConfigToDraft(config));
      } catch (error) {
        if (!cancelled) setErrorMessage(getAdminErrorMessage(error));
      }
    }

    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeConversationId) return;

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
  }, [activeConversationId, refreshDetail]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const currentConversationId = activeConversationIdRef.current;
      try {
        await refreshConversations(currentConversationId);
        if (
          currentConversationId &&
          activeConversationIdRef.current === currentConversationId
        ) {
          await refreshDetail(currentConversationId);
        }
      } catch (error) {
        setErrorMessage(getAdminErrorMessage(error));
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [refreshConversations, refreshDetail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSelectConversation = (id: string) => {
    setActiveConversationIdSafe(id);
    setReplyContent("");
    setSidebarOpen(false);
    setErrorMessage("");
    setStatusMessage("");
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setStatusMessage("当前浏览器不支持系统通知");
      return;
    }

    if (Notification.permission === "granted") {
      setNotificationPermission("granted");
      setStatusMessage("系统通知已开启");
      return;
    }

    const nextPermission = await Notification.requestPermission();
    setNotificationPermission(nextPermission);
    setStatusMessage(
      nextPermission === "granted"
        ? "系统通知已开启，有新会话时会提醒"
        : "系统通知未开启，请在浏览器设置中允许通知"
    );
  };

  const handleReply = async () => {
    const content = replyContent.trim();
    if (!content || !activeConversationId || isReplying) return;

    setIsReplying(true);
    setErrorMessage("");
    try {
      const message = await createAdminMessage(
        activeConversationId,
        content
      );
      setMessages((current) => [...current, message]);
      setReplyContent("");
      void refreshConversations(activeConversationId).catch((error) => {
        setErrorMessage(getAdminErrorMessage(error));
      });
      void refreshDetail(activeConversationId).catch((error) => {
        setErrorMessage(getAdminErrorMessage(error));
      });
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error));
    } finally {
      setIsReplying(false);
    }
  };

  const handleArchive = async () => {
    if (!activeConversationId) return;

    setIsArchiving(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const archive = await archiveAdminConversationLocally(
        activeConversationId
      );
      setStatusMessage(
        `已生成下载：${archive.fileName}（媒体 ${archive.mediaCount} 个，失败 ${archive.failedMediaCount} 个）`
      );
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error));
    } finally {
      setIsArchiving(false);
    }
  };

  const handleClearData = async () => {
    setErrorMessage("");
    try {
      await resetDemoData();
      setActiveConversationIdSafe(null);
      setActiveConversation(null);
      setMessages([]);
      setShowClearConfirm(false);
      await refreshConversations(null);
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error));
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      await refreshConversations(activeConversationId);
      if (activeConversationId) await refreshDetail(activeConversationId);
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAiReply = async () => {
    if (!aiConfig || isAiSaving) return;

    setIsAiSaving(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const config = await setAiReplyEnabled(!aiConfig.enabled);
      setAiConfig(config);
      setAiDraft(aiConfigToDraft(config));
      setStatusMessage(config.enabled ? "AI 自动回复已开启" : "AI 自动回复已关闭");
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error));
    } finally {
      setIsAiSaving(false);
    }
  };

  const handleSaveAiConfig = async () => {
    if (!aiDraft || isAiSaving) return;

    setIsAiSaving(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const apiKey = aiDraft.apiKey.trim();
      const config = await updateAiReplyConfig({
        enabled: aiDraft.enabled,
        baseUrl: aiDraft.baseUrl,
        model: aiDraft.model,
        systemPrompt: aiDraft.systemPrompt,
        reasoningEffort: aiDraft.reasoningEffort,
        ...(apiKey ? { apiKey } : {}),
      });
      setAiConfig(config);
      setAiDraft(aiConfigToDraft(config));
      setStatusMessage("AI 回复配置已保存");
    } catch (error) {
      setErrorMessage(getAdminErrorMessage(error));
    } finally {
      setIsAiSaving(false);
    }
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleReply();
    }
  };

  const aiStatus = aiConfig
    ? aiConfig.enabled
      ? "AI 自动回复开启"
      : "人工回复模式"
    : "AI 配置加载中";

  const aiPanel = isAiPanelOpen && aiDraft && (
    <div className="border-b border-border bg-sidebar/80 px-4 py-4 md:px-6">
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-medium text-foreground">
              DeepSeek 回复配置
            </div>
            <div className="text-xs text-muted">
              {aiConfig?.apiKeyConfigured ? "API Key 已配置" : "尚未配置 API Key"}
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#111111]"
              checked={aiDraft.enabled}
              onChange={(event) =>
                setAiDraft((current) =>
                  current
                    ? { ...current, enabled: event.target.checked }
                    : current
                )
              }
            />
            自动回复
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-xs text-muted">
            <span>Base URL</span>
            <Input
              value={aiDraft.baseUrl}
              onChange={(event) =>
                setAiDraft((current) =>
                  current ? { ...current, baseUrl: event.target.value } : current
                )
              }
            />
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>模型</span>
            <Input
              value={aiDraft.model}
              onChange={(event) =>
                setAiDraft((current) =>
                  current ? { ...current, model: event.target.value } : current
                )
              }
            />
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>API Key</span>
            <Input
              type="password"
              value={aiDraft.apiKey}
              placeholder={
                aiConfig?.apiKeyConfigured ? "留空保持当前密钥" : "输入 DeepSeek API Key"
              }
              onChange={(event) =>
                setAiDraft((current) =>
                  current ? { ...current, apiKey: event.target.value } : current
                )
              }
            />
          </label>
          <label className="space-y-1 text-xs text-muted">
            <span>推理强度</span>
            <select
              className="w-full rounded-full border border-border bg-white px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
              value={aiDraft.reasoningEffort}
              onChange={(event) =>
                setAiDraft((current) =>
                  current
                    ? { ...current, reasoningEffort: event.target.value }
                    : current
                )
              }
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
        </div>

        <label className="block space-y-1 text-xs text-muted">
          <span>系统提示词</span>
          <Textarea
            rows={3}
            value={aiDraft.systemPrompt}
            onChange={(event) =>
              setAiDraft((current) =>
                current
                  ? { ...current, systemPrompt: event.target.value }
                  : current
              )
            }
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            className="text-xs"
            onClick={() => void handleSaveAiConfig()}
            disabled={isAiSaving}
          >
            {isAiSaving ? "保存中" : "保存配置"}
          </Button>
          <Button
            variant="secondary"
            className="text-xs"
            onClick={() => void loadAiConfig()}
            disabled={isAiSaving}
          >
            重置
          </Button>
        </div>
      </div>
    </div>
  );

  const sidebar = (
    <AdminSidebar
      conversations={conversations}
      activeConversationId={activeConversationId}
      isLoading={isLoading}
      notificationPermission={notificationPermission}
      showClearConfirm={showClearConfirm}
      onRequestNotificationPermission={() =>
        void handleRequestNotificationPermission()
      }
      onRefresh={() => void handleRefresh()}
      onSelectConversation={handleSelectConversation}
      onRequestClearData={() => setShowClearConfirm(true)}
      onCancelClearData={() => setShowClearConfirm(false)}
      onConfirmClearData={() => void handleClearData()}
    />
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
        <div className="flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 md:hidden">
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
          <BrandMark compact />
          {activeConversation && (
            <span className="flex-1 truncate text-xs text-muted">
              {activeConversation.user?.username}: {activeConversation.title}
            </span>
          )}
          <button
            onClick={() => setIsAiPanelOpen((open) => !open)}
            className="text-xs text-muted transition-colors hover:text-foreground"
          >
            AI
          </button>
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
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-full border border-border bg-white px-3 py-1 text-xs text-muted">
                {aiStatus}
              </span>
              <Button
                variant="secondary"
                className="text-xs"
                onClick={() => void handleToggleAiReply()}
                disabled={!aiConfig || isAiSaving}
              >
                {aiConfig?.enabled ? "关闭 AI" : "开启 AI"}
              </Button>
              <Button
                variant="secondary"
                className="text-xs"
                onClick={() => setIsAiPanelOpen((open) => !open)}
              >
                API 配置
              </Button>
              {activeConversation && (
                <Button
                  variant="secondary"
                  className="text-xs"
                  onClick={handleArchive}
                  disabled={isArchiving}
                >
                  {isArchiving ? "归档中" : "本地归档"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {aiPanel}

        {aiConfig && (
          <div className="border-b border-border bg-background px-4 py-2 text-xs text-muted md:hidden">
            <div className="flex items-center justify-between gap-2">
              <span>{aiStatus}</span>
              <Button
                variant="secondary"
                className="px-3 py-1 text-xs"
                onClick={() => void handleToggleAiReply()}
                disabled={isAiSaving}
              >
                {aiConfig.enabled ? "关闭" : "开启"}
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 md:px-6">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                username={activeConversation?.user?.username ?? "用户"}
                showSenderLabel
                roleLabel={
                  msg.sender === "user"
                    ? "用户"
                    : msg.sender === "assistant"
                    ? "AI助手"
                    : "管理员"
                }
              />
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
          <div className="border-t border-border px-4 py-2 md:px-6">
            <ErrorNotice message={errorMessage} className="text-xs" />
          </div>
        )}
        {statusMessage && (
          <div className="border-t border-border px-4 py-2 text-xs text-muted md:px-6">
            {statusMessage}
          </div>
        )}

        {activeConversationId && (
          <div className="flex-shrink-0 border-t border-border bg-sidebar/95">
            <div className="mx-auto max-w-3xl px-4 py-4 md:px-6">
              <div className="mb-2 text-xs text-muted">回复消息</div>
              <div className="flex items-end gap-3 rounded-[30px] border border-border bg-white p-2 shadow-lg shadow-slate-200/60">
                <Textarea
                  placeholder="输入回复..."
                  className="flex-1 border-transparent bg-transparent focus:border-transparent focus:ring-0"
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
