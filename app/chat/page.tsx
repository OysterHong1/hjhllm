"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { MessageAttachments } from "@/components/chat/MessageAttachments";
import {
  createAttachmentMessage,
  createConversation,
  createMessage,
  getErrorMessage,
  listConversations,
  listMessages,
  restoreUserSession,
} from "@/lib/api-client/client";
import { clearStoredUserId, getStoredUserId } from "@/lib/api-client/session";
import {
  ATTACHMENT_MAX_BYTES,
  formatAttachmentSize,
  type Conversation,
  type Message,
  type User,
} from "@/lib/contracts";
import { formatTime } from "@/lib/time";

type SelectedImage = {
  file: File;
  previewUrl: string;
};

type SelectedAudio = {
  file: File;
  previewUrl: string;
  durationMs: number;
};

type SelectedVideo = {
  file: File;
  previewUrl: string;
};

export default function ChatPage() {
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
  const videoInputRef = useRef<HTMLInputElement>(null);
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
    if (!userId) {
      router.replace("/login");
      return;
    }

    const storedUserId = userId;
    let cancelled = false;

    async function restore() {
      try {
        const restoredUser = await restoreUserSession(storedUserId);
        if (cancelled) return;
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
    if (
      (!content &&
        selectedImages.length === 0 &&
        !selectedAudio &&
        !selectedVideo) ||
      !user ||
      isSending ||
      isRecording
    ) {
      return;
    }

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
        selectedAudio
          ? await createAttachmentMessage({
              conversationId: convId,
              userId: user.id,
              files: [selectedAudio.file],
              text: content,
              durationMs: selectedAudio.durationMs,
            })
          : selectedVideo
          ? await createAttachmentMessage({
              conversationId: convId,
              userId: user.id,
              files: [selectedVideo.file],
              text: content,
            })
          : selectedImages.length > 0
          ? await createAttachmentMessage({
              conversationId: convId,
              userId: user.id,
              files: selectedImages.map((image) => image.file),
              text: content,
            })
          : await createMessage(convId, user.id, content);
      setActiveMessages((messages) => [...messages, message]);
      setComposerValue("");
      selectedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setSelectedImages([]);
      if (selectedAudio) URL.revokeObjectURL(selectedAudio.previewUrl);
      setSelectedAudio(null);
      if (selectedVideo) URL.revokeObjectURL(selectedVideo.previewUrl);
      setSelectedVideo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
      await loadConversations(user.id, convId);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
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
    if (videoInputRef.current) videoInputRef.current.value = "";
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
    const files = Array.from(event.target.files ?? []).filter((file) =>
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

  const handleVideoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = Array.from(event.target.files ?? []).find((item) =>
      item.type.startsWith("video/")
    );

    if (!file) return;
    if (file.size > ATTACHMENT_MAX_BYTES.video) {
      setErrorMessage(
        `视频不能超过 ${formatAttachmentSize(ATTACHMENT_MAX_BYTES.video)}`
      );
      if (videoInputRef.current) videoInputRef.current.value = "";
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
      file,
      previewUrl: URL.createObjectURL(file),
    });
    setErrorMessage("");
  };

  const handleRemoveVideo = () => {
    if (selectedVideo) URL.revokeObjectURL(selectedVideo.previewUrl);
    setSelectedVideo(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
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

  const handleStartRecording = async () => {
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
        clearRecordingTimer();
        stopRecordingTracks();
        setIsRecording(false);
        setRecordingSeconds(0);

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
        setSelectedAudio({
          file,
          previewUrl: URL.createObjectURL(blob),
          durationMs,
        });
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(
          Math.max(1, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000))
        );
      }, 500);
      setErrorMessage("");
    } catch {
      stopRecordingTracks();
      setIsRecording(false);
      setErrorMessage("无法开始录音，请检查麦克风权限");
    }
  };

  const handleFinishRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    discardRecordingRef.current = false;
    mediaRecorderRef.current.stop();
  };

  const handleCancelRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
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
                    <div className="space-y-2">
                      <MessageAttachments attachments={msg.attachments} />
                      {msg.text && (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      )}
                    </div>
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
            {selectedImages.length > 0 && (
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {selectedImages.map((image, index) => (
                  <div
                    key={image.previewUrl}
                    className="relative aspect-square overflow-hidden rounded-lg border border-border bg-white"
                  >
                    <img
                      src={image.previewUrl}
                      alt="待发送图片"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(index)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white"
                      aria-label="移除图片"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
            {selectedAudio && (
              <div className="mb-3 rounded-lg border border-border bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">
                    语音 {formatAudioDuration(selectedAudio.durationMs)}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveAudio}
                    className="text-xs text-muted transition-colors hover:text-foreground"
                  >
                    移除
                  </button>
                </div>
                <audio
                  controls
                  src={selectedAudio.previewUrl}
                  className="h-9 w-full"
                />
              </div>
            )}
            {selectedVideo && (
              <div className="mb-3 rounded-lg border border-border bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted">
                    视频 · {formatAttachmentSize(selectedVideo.file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveVideo}
                    className="text-xs text-muted transition-colors hover:text-foreground"
                  >
                    移除
                  </button>
                </div>
                <video
                  controls
                  src={selectedVideo.previewUrl}
                  className="max-h-72 w-full rounded-md bg-black"
                />
              </div>
            )}
            {isRecording && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
                <span className="text-xs text-accent">
                  录音中 {formatAudioDuration(recordingSeconds * 1000)}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="px-3 py-1 text-xs"
                    onClick={handleCancelRecording}
                  >
                    取消
                  </Button>
                  <Button
                    className="px-3 py-1 text-xs"
                    onClick={handleFinishRecording}
                  >
                    完成
                  </Button>
                </div>
              </div>
            )}
            <div className="flex items-end gap-2 md:gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoSelect}
              />
              <Button
                variant="secondary"
                className="h-[42px] w-[42px] flex-shrink-0 px-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={
                  isSending ||
                  isRecording ||
                  selectedImages.length >= 4 ||
                  Boolean(selectedAudio) ||
                  Boolean(selectedVideo)
                }
                aria-label="选择图片"
              >
                +
              </Button>
              <Button
                variant="secondary"
                className="h-[42px] flex-shrink-0 px-3"
                onClick={() => videoInputRef.current?.click()}
                disabled={
                  isSending ||
                  isRecording ||
                  selectedImages.length > 0 ||
                  Boolean(selectedAudio) ||
                  Boolean(selectedVideo)
                }
              >
                视频
              </Button>
              <Button
                variant="secondary"
                className="h-[42px] flex-shrink-0 px-3"
                onClick={handleStartRecording}
                disabled={
                  isSending ||
                  isRecording ||
                  selectedImages.length > 0 ||
                  Boolean(selectedAudio) ||
                  Boolean(selectedVideo)
                }
              >
                录音
              </Button>
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
                disabled={
                  (!composerValue.trim() &&
                    selectedImages.length === 0 &&
                    !selectedAudio &&
                    !selectedVideo) ||
                  isRecording ||
                  isSending
                }
              >
                {isSending ? "发送中" : "发送"}
              </Button>
            </div>
            {errorMessage && (
              <p className="mt-2 text-xs text-accent">{errorMessage}</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function formatAudioDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
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
