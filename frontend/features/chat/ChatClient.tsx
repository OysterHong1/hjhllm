"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/chat/BrandMark";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { IconButton } from "@/components/ui/IconButton";
import { SidebarIcon } from "@/components/ui/icons";
import {
  createAttachmentMessage,
  createConversation,
  createMessage,
  getErrorMessage,
  listConversations,
  listMessages,
  logoutUserSession,
  restoreCurrentUserSession,
  restoreUserSession,
} from "@/lib/api-client/client";
import {
  clearStoredUserId,
  getStoredUserId,
  setStoredUserId,
} from "@/lib/api-client/session";
import {
  ATTACHMENT_MAX_BYTES,
  formatAttachmentSize,
  type Conversation,
  type Message,
  type User,
} from "@/lib/contracts";
import { ChatComposer } from "./ChatComposer";
import { ChatSidebar } from "./ChatSidebar";
import { ThinkingBubble } from "./ThinkingBubble";
import type { SelectedImage, SelectedVideo } from "./types";

export default function ChatClient() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [composerValue, setComposerValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedImagesRef = useRef<SelectedImage[]>([]);
  const selectedVideoRef = useRef<SelectedVideo | null>(null);
  const isSendingRef = useRef(false);

  const loadMessages = useCallback(
    async (conversationId: string, userId: string) => {
      const messages = await listMessages(conversationId, userId);
      setActiveMessages(messages);
    },
    []
  );

  const loadConversations = useCallback(
    async (userId: string, preferredConversationId?: string | null) => {
      const nextConversations = await listConversations(userId);
      setConversations(nextConversations);

      const nextActiveId =
        preferredConversationId ??
        nextConversations[0]?.id ??
        null;
      setActiveConversationId(nextActiveId);

      if (nextActiveId) {
        await loadMessages(nextActiveId, userId);
      } else {
        setActiveMessages([]);
      }
    },
    [loadMessages]
  );

  useEffect(() => {
    const userId = getStoredUserId();
    const storedUserId = userId;
    let cancelled = false;

    async function restore() {
      try {
        const restoredUser = storedUserId
          ? await restoreUserSession(storedUserId)
          : await restoreCurrentUserSession();
        if (cancelled) return;
        setStoredUserId(restoredUser.id);
        setUser(restoredUser);
        await loadConversations(restoredUser.id);
      } catch (error) {
        if (!cancelled) {
          clearStoredUserId();
          setErrorMessage(getErrorMessage(error));
          router.replace("/login");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, [loadConversations, router]);

  const isThinking =
    activeMessages.length > 0 &&
    activeMessages[activeMessages.length - 1].sender === "user";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, isThinking]);

  useEffect(() => {
    if (!user || !activeConversationId) return;

    const currentUser = user;
    const currentConversationId = activeConversationId;
    let cancelled = false;

    async function refreshMessages() {
      try {
        const messages = await listMessages(
          currentConversationId,
          currentUser.id
        );
        if (!cancelled) setActiveMessages(messages);
      } catch (error) {
        if (!cancelled) setErrorMessage(getErrorMessage(error));
      }
    }

    void refreshMessages();
    const interval = window.setInterval(refreshMessages, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeConversationId, user]);

  const handleSend = async () => {
    const content = composerValue.trim();
    const imagesToSend = selectedImages;
    const videoToSend = selectedVideo;
    if (
      (!content &&
        imagesToSend.length === 0 &&
        !videoToSend) ||
      !user ||
      isSendingRef.current
    ) {
      return;
    }

    isSendingRef.current = true;
    setIsSending(true);
    setErrorMessage("");

    try {
      let convId = activeConversationId;

      if (!convId) {
        const conversation = await createConversation(user.id);
        convId = conversation.id;
        setActiveConversationId(convId);
      }

      const message =
        videoToSend
          ? await createAttachmentMessage({
              conversationId: convId,
              userId: user.id,
              files: [videoToSend.file],
              text: content,
            })
          : imagesToSend.length > 0
          ? await createAttachmentMessage({
              conversationId: convId,
              userId: user.id,
              files: imagesToSend.map((image) => image.file),
              text: content,
            })
          : await createMessage(convId, user.id, content);
      setActiveMessages((messages) => {
        if (messages.some((current) => current.id === message.id)) {
          return messages;
        }
        return [...messages, message];
      });
      setComposerValue("");
      imagesToSend.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      if (imagesToSend.length > 0) setSelectedImages([]);
      if (videoToSend) URL.revokeObjectURL(videoToSend.previewUrl);
      setSelectedVideo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      void loadConversations(user.id, convId).catch((error) => {
        setErrorMessage(getErrorMessage(error));
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setActiveMessages([]);
    setComposerValue("");
    selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setSelectedImages([]);
    if (selectedVideo) URL.revokeObjectURL(selectedVideo.previewUrl);
    setSelectedVideo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSidebarOpen(false);
  };

  const handleSelectConversation = async (id: string) => {
    if (!user) return;
    setActiveConversationId(id);
    setSidebarOpen(false);
    setErrorMessage("");
    try {
      await loadMessages(id, user.id);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUserSession();
    } catch {
      // ignore network errors, still clear local state
    }
    clearStoredUserId();
    router.replace("/login");
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    const videoFile = selectedFiles.find((file) => file.type.startsWith("video/"));
    if (videoFile) {
      if (videoFile.size > ATTACHMENT_MAX_BYTES.video) {
        setErrorMessage(
          `视频不能超过 ${formatAttachmentSize(ATTACHMENT_MAX_BYTES.video)}`
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setSelectedImages([]);
      if (selectedVideo) URL.revokeObjectURL(selectedVideo.previewUrl);

      setSelectedVideo({
        file: videoFile,
        previewUrl: URL.createObjectURL(videoFile),
      });
      setErrorMessage("");
      return;
    }

    const files = selectedFiles.filter((file) =>
      file.type.startsWith("image/")
    );

    if (files.length === 0) return;
    if (selectedVideo) {
      URL.revokeObjectURL(selectedVideo.previewUrl);
      setSelectedVideo(null);
    }
    setSelectedImages((current) => {
      const incomingImages = files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      const nextImages = [...current, ...incomingImages].slice(0, 4);
      incomingImages
        .filter((image) => !nextImages.includes(image))
        .forEach((image) => URL.revokeObjectURL(image.previewUrl));

      return nextImages;
    });
    setErrorMessage("");
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((current) => {
      const image = current[index];
      if (image) URL.revokeObjectURL(image.previewUrl);
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveVideo = () => {
    if (selectedVideo) URL.revokeObjectURL(selectedVideo.previewUrl);
    setSelectedVideo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => {
    selectedVideoRef.current = selectedVideo;
  }, [selectedVideo]);

  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl)
      );
      if (selectedVideoRef.current) {
        URL.revokeObjectURL(selectedVideoRef.current.previewUrl);
      }
    };
  }, []);

  if (isLoading || !user) return null;

  const sidebar = (
    <ChatSidebar
      user={user}
      conversations={conversations}
      activeConversationId={activeConversationId}
      onNewConversation={handleNewConversation}
      onSelectConversation={(id) => void handleSelectConversation(id)}
      onLogout={handleLogout}
    />
  );

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <div className="hidden h-full w-[280px] flex-shrink-0 md:block">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="h-full w-[280px] shadow-xl">{sidebar}</div>
          <div
            className="flex-1 bg-black/20"
            onClick={() => setSidebarOpen(false)}
          />
        </div>
      )}

      {/* Main chat area */}
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        {/* Top bar (mobile only) */}
        <div className="flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 md:hidden">
          <IconButton
            icon={<SidebarIcon />}
            label="打开侧边栏"
            onClick={() => setSidebarOpen(true)}
            className="h-9 w-9"
          />
          <BrandMark compact />
          {activeConversationId && (
            <span className="flex-1 truncate text-xs text-muted">
              {conversations.find((c) => c.id === activeConversationId)?.title}
            </span>
          )}
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-6">
            {!activeConversationId && (
              <div className="py-12 text-center text-sm text-muted">
                选择一个会话或新建会话开始聊天
              </div>
            )}

            {activeMessages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} username={user.username} />
            ))}

            {isThinking && <ThinkingBubble />}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <ChatComposer
          value={composerValue}
          errorMessage={errorMessage}
          selectedImages={selectedImages}
          selectedVideo={selectedVideo}
          isSending={isSending}
          fileInputRef={fileInputRef}
          onChangeValue={setComposerValue}
          onSend={() => void handleSend()}
          onKeyDown={handleKeyDown}
          onImageSelect={handleImageSelect}
          onRemoveImage={handleRemoveImage}
          onRemoveVideo={handleRemoveVideo}
        />
      </main>
    </div>
  );
}
