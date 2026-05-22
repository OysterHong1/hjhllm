import { BrandMark } from "@/components/chat/BrandMark";
import { Button } from "@/components/ui/Button";
import type { AdminConversation } from "@/lib/contracts";
import { formatTime } from "@/lib/time";

type AdminSidebarProps = {
  conversations: AdminConversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  notificationPermission: NotificationPermission | "unsupported";
  showClearConfirm: boolean;
  onRequestNotificationPermission: () => void;
  onRefresh: () => void;
  onSelectConversation: (id: string) => void;
  onRequestClearData: () => void;
  onCancelClearData: () => void;
  onConfirmClearData: () => void;
};

export function AdminSidebar({
  conversations,
  activeConversationId,
  isLoading,
  notificationPermission,
  showClearConfirm,
  onRequestNotificationPermission,
  onRefresh,
  onSelectConversation,
  onRequestClearData,
  onCancelClearData,
  onConfirmClearData,
}: AdminSidebarProps) {
  return (
    <aside className="flex h-full flex-col border-r border-border bg-sidebar/95">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <BrandMark label="管理后台" />
        <div className="flex items-center gap-3">
          <button
            onClick={onRequestNotificationPermission}
            disabled={
              notificationPermission === "granted" ||
              notificationPermission === "denied" ||
              notificationPermission === "unsupported"
            }
            className="text-xs text-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {notificationPermission === "granted"
              ? "通知已开"
              : notificationPermission === "denied"
              ? "通知受限"
              : notificationPermission === "unsupported"
              ? "无通知"
              : "开启通知"}
          </button>
          <button
            onClick={onRefresh}
            className="text-xs text-muted transition-colors hover:text-foreground"
          >
            刷新
          </button>
        </div>
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
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelectConversation(conversation.id)}
            className={`w-full px-4 py-3 text-left transition-colors hover:bg-white/70 ${
              activeConversationId === conversation.id
                ? "bg-white shadow-sm"
                : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">
                {conversation.user?.username ?? "未知用户"}
              </span>
              {conversation.needsReply && (
                <span className="inline-flex items-center rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  待回复
                </span>
              )}
            </div>
            <div className="mt-0.5 truncate text-sm text-foreground">
              {conversation.title}
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {formatTime(conversation.updatedAt)}
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
                onClick={onConfirmClearData}
              >
                确认
              </Button>
              <Button
                variant="secondary"
                className="flex-1 text-xs"
                onClick={onCancelClearData}
              >
                取消
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            className="w-full text-xs"
            onClick={onRequestClearData}
          >
            清空演示数据
          </Button>
        )}
      </div>
    </aside>
  );
}
