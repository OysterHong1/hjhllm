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
import type { SelectedAudio, SelectedImage, SelectedVideo } from "./types";

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
  const [selectedAudio, setSelectedAudio] = useState<SelectedAudio | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedImagesRef = useRef<SelectedImage[]>([]);
  const selectedAudioRef = useRef<SelectedAudio | null>(null);
  const selectedVideoRef = useRef<SelectedVideo | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const discardRecordingRef = useRef(false);
  const autoSendRecordingRef = useRef(false);
  const recordingStartRequestedRef = useRef(false);
  const pendingRecordingStopRef = useRef<"finish" | "cancel" | null>(null);
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

  const handleSend = async (override?: {
    audio?: SelectedAudio;
    text?: string;
  }) => {
    const content = override?.text ?? composerValue.trim();
    const audioToSend = override?.audio ?? selectedAudio;
    const imagesToSend = override?.audio ? [] : selectedImages;
    const videoToSend = override?.audio ? null : selectedVideo;
    if (
      (!content &&
        imagesToSend.length === 0 &&
        !audioToSend &&
        !videoToSend) ||
      !user ||
      isSendingRef.current ||
      (isRecording && !override?.audio)
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
        audioToSend
          ? await createAttachmentMessage({
              conversationId: convId,
              userId: user.id,
              files: [audioToSend.file],
              text: content,
              durationMs: audioToSend.durationMs,
            })
          : videoToSend
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
      if (audioToSend) URL.revokeObjectURL(audioToSend.previewUrl);
      setSelectedAudio(null);
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
    if (selectedAudio) URL.revokeObjectURL(selectedAudio.previewUrl);
    setSelectedAudio(null);
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

  const handleLogout = () => {
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
      if (selectedAudio) {
        URL.revokeObjectURL(selectedAudio.previewUrl);
        setSelectedAudio(null);
      }
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
    if (selectedAudio) {
      URL.revokeObjectURL(selectedAudio.previewUrl);
      setSelectedAudio(null);
    }
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

  const stopRecordingTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const handleStartRecording = async (options?: { autoSend?: boolean }) => {
    if (
      isSending ||
      selectedImages.length > 0 ||
      Boolean(selectedVideo) ||
      isRecording
    ) {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setErrorMessage("当前浏览器不支持录音");
      return;
    }

    try {
      recordingStartRequestedRef.current = true;
      pendingRecordingStopRef.current = null;
      autoSendRecordingRef.current = Boolean(options?.autoSend);
      if (selectedAudio) URL.revokeObjectURL(selectedAudio.previewUrl);
      setSelectedAudio(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      audioChunksRef.current = [];
      discardRecordingRef.current = false;
      recordingStartedAtRef.current = Date.now();
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        recordingStartRequestedRef.current = false;
        pendingRecordingStopRef.current = null;
        clearRecordingTimer();
        stopRecordingTracks();
        setIsRecording(false);
        setRecordingSeconds(0);

        const shouldAutoSend = autoSendRecordingRef.current;
        autoSendRecordingRef.current = false;

        if (discardRecordingRef.current || audioChunksRef.current.length === 0) {
          audioChunksRef.current = [];
          return;
        }

        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type });
        audioChunksRef.current = [];
        const durationMs = Math.max(1000, Date.now() - recordingStartedAtRef.current);
        const extension = type.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `recording-${Date.now()}.${extension}`, {
          type,
        });
        const nextAudio = {
          file,
          previewUrl: URL.createObjectURL(blob),
          durationMs,
        };

        if (shouldAutoSend) {
          void handleSend({ audio: nextAudio, text: "" });
        } else {
          setSelectedAudio(nextAudio);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(
          Math.max(1, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000))
        );
      }, 500);
      const pendingStop = pendingRecordingStopRef.current;
      if (pendingStop && recorder.state === "recording") {
        pendingRecordingStopRef.current = null;
        discardRecordingRef.current = pendingStop === "cancel";
        if (pendingStop === "cancel") autoSendRecordingRef.current = false;
        recorder.stop();
      }
      setErrorMessage("");
    } catch {
      recordingStartRequestedRef.current = false;
      pendingRecordingStopRef.current = null;
      autoSendRecordingRef.current = false;
      stopRecordingTracks();
      setIsRecording(false);
      setErrorMessage("无法开始录音，请检查麦克风权限");
    }
  };

  const handleFinishRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    autoSendRecordingRef.current = false;
    discardRecordingRef.current = false;
    mediaRecorderRef.current.stop();
  };

  const handleCancelRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    autoSendRecordingRef.current = false;
    discardRecordingRef.current = true;
    mediaRecorderRef.current.stop();
  };

  const handleHoldStartRecording = () => {
    void handleStartRecording({ autoSend: true });
  };

  const handleHoldFinishRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) {
      if (recordingStartRequestedRef.current) {
        pendingRecordingStopRef.current = "finish";
      }
      return;
    }
    autoSendRecordingRef.current = true;
    discardRecordingRef.current = false;
    mediaRecorderRef.current.stop();
  };

  const handleHoldCancelRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) {
      if (recordingStartRequestedRef.current) {
        pendingRecordingStopRef.current = "cancel";
      }
      return;
    }
    autoSendRecordingRef.current = false;
    discardRecordingRef.current = true;
    mediaRecorderRef.current.stop();
  };

  const handleRemoveAudio = () => {
    if (selectedAudio) URL.revokeObjectURL(selectedAudio.previewUrl);
    setSelectedAudio(null);
  };

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => {
    selectedAudioRef.current = selectedAudio;
  }, [selectedAudio]);

  useEffect(() => {
    selectedVideoRef.current = selectedVideo;
  }, [selectedVideo]);

  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl)
      );
      if (selectedAudioRef.current) {
        URL.revokeObjectURL(selectedAudioRef.current.previewUrl);
      }
      if (selectedVideoRef.current) {
        URL.revokeObjectURL(selectedVideoRef.current.previewUrl);
      }
      clearRecordingTimer();
      stopRecordingTracks();
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
          <div
            className="flex-1 bg-black/20"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="h-full w-[280px] shadow-xl">{sidebar}</div>
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
          selectedAudio={selectedAudio}
          selectedVideo={selectedVideo}
          isRecording={isRecording}
          isSending={isSending}
          recordingSeconds={recordingSeconds}
          fileInputRef={fileInputRef}
          onChangeValue={setComposerValue}
          onSend={() => void handleSend()}
          onKeyDown={handleKeyDown}
          onImageSelect={handleImageSelect}
          onRemoveImage={handleRemoveImage}
          onRemoveVideo={handleRemoveVideo}
          onStartRecording={() => void handleStartRecording()}
          onFinishRecording={handleFinishRecording}
          onCancelRecording={handleCancelRecording}
          onHoldStartRecording={handleHoldStartRecording}
          onHoldFinishRecording={handleHoldFinishRecording}
          onHoldCancelRecording={handleHoldCancelRecording}
          onRemoveAudio={handleRemoveAudio}
        />
      </main>
    </div>
  );
}
