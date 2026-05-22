import { BrandMark } from "@/components/chat/BrandMark";
import { EditIcon, SidebarIcon } from "@/components/ui/icons";
import type { Conversation, User } from "@/lib/contracts";

type ChatSidebarProps = {
  user: User;
  conversations: Conversation[];
  activeConversationId: string | null;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onLogout: () => void;
};

export function ChatSidebar({
  user,
  conversations,
  activeConversationId,
  onNewConversation,
  onSelectConversation,
  onLogout,
}: ChatSidebarProps) {
  return (
    <aside className="flex h-full flex-col border-r border-[#eceff3] bg-[#fbfbfb]">
      <div className="flex items-center justify-between px-4 py-4">
        <BrandMark compact />
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted">
          <SidebarIcon />
        </span>
      </div>

      <div className="px-2 pb-3">
        <button
          onClick={onNewConversation}
          className="flex h-10 w-full items-center gap-2 rounded-lg bg-[#f0f0f0] px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-[#e9e9e9]"
        >
          <EditIcon />
          新聊天
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="px-2 pb-2 text-xs font-semibold text-foreground">
          最近
        </div>
        {conversations.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-muted">
            暂无会话，发送消息开始
          </div>
        )}
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelectConversation(conversation.id)}
            className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-[#f3f4f6] ${
              activeConversationId === conversation.id
                ? "bg-[#eeeeee]"
                : ""
            }`}
          >
            <div className="truncate text-foreground">{conversation.title}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-[#eceff3] px-4 py-3">
        <div className="text-xs text-muted">{user.username}</div>
        <button
          onClick={onLogout}
          className="text-xs text-muted transition-colors hover:text-foreground"
        >
          退出
        </button>
      </div>
    </aside>
  );
}
