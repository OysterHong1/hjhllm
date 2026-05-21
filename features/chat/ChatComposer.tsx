import Image from "next/image";
import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { IconButton } from "@/components/ui/IconButton";
import { Textarea } from "@/components/ui/Textarea";
import {
  CameraIcon,
  MicrophoneIcon,
  PlusIcon,
  VideoIcon,
} from "@/components/ui/icons";
import { formatAttachmentSize } from "@/lib/contracts";
import type { SelectedAudio, SelectedImage, SelectedVideo } from "./types";
import { formatAudioDuration } from "./utils";

type ChatComposerProps = {
  value: string;
  errorMessage: string;
  selectedImages: SelectedImage[];
  selectedAudio: SelectedAudio | null;
  selectedVideo: SelectedVideo | null;
  isRecording: boolean;
  isSending: boolean;
  recordingSeconds: number;
  fileInputRef: RefObject<HTMLInputElement | null>;
  videoInputRef: RefObject<HTMLInputElement | null>;
  onChangeValue: (value: string) => void;
  onSend: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onImageSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  onVideoSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveVideo: () => void;
  onStartRecording: () => void;
  onFinishRecording: () => void;
  onCancelRecording: () => void;
  onRemoveAudio: () => void;
};

export function ChatComposer({
  value,
  errorMessage,
  selectedImages,
  selectedAudio,
  selectedVideo,
  isRecording,
  isSending,
  recordingSeconds,
  fileInputRef,
  videoInputRef,
  onChangeValue,
  onSend,
  onKeyDown,
  onImageSelect,
  onRemoveImage,
  onVideoSelect,
  onRemoveVideo,
  onStartRecording,
  onFinishRecording,
  onCancelRecording,
  onRemoveAudio,
}: ChatComposerProps) {
  const hasPendingContent =
    Boolean(value.trim()) ||
    selectedImages.length > 0 ||
    Boolean(selectedAudio) ||
    Boolean(selectedVideo);

  return (
    <div className="flex-shrink-0 bg-background/95 px-3 pb-4 pt-2">
      <div className="mx-auto max-w-3xl">
        {selectedImages.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {selectedImages.map((image, index) => (
              <div
                key={image.previewUrl}
                className="relative aspect-square overflow-hidden rounded-lg border border-border bg-white"
              >
                <Image
                  src={image.previewUrl}
                  alt="待发送图片"
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 45vw, 180px"
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemoveImage(index)}
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
                onClick={onRemoveAudio}
                className="text-xs text-muted transition-colors hover:text-foreground"
              >
                移除
              </button>
            </div>
            <audio controls src={selectedAudio.previewUrl} className="h-9 w-full" />
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
                onClick={onRemoveVideo}
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
                onClick={onCancelRecording}
              >
                取消
              </Button>
              <Button className="px-3 py-1 text-xs" onClick={onFinishRecording}>
                完成
              </Button>
            </div>
          </div>
        )}

        <div className="flex min-h-[64px] items-center gap-2 rounded-[32px] border border-white/80 bg-white px-3 py-2 shadow-[0_18px_40px_rgba(31,41,55,0.14)] md:min-h-[70px] md:gap-3 md:px-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onImageSelect}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={onVideoSelect}
          />
          <IconButton
            icon={<CameraIcon />}
            label="选择图片"
            onClick={() => fileInputRef.current?.click()}
            disabled={
              isSending ||
              isRecording ||
              selectedImages.length >= 4 ||
              Boolean(selectedAudio) ||
              Boolean(selectedVideo)
            }
          />
          <Textarea
            placeholder="发消息或按住说话..."
            value={value}
            onChange={(event) => onChangeValue(event.target.value)}
            onKeyDown={onKeyDown}
            className="min-h-[44px] flex-1 rounded-none border-transparent bg-transparent px-1 py-3 text-[17px] leading-6 shadow-none placeholder:text-[#a1a1aa] focus:border-transparent focus:ring-0"
            rows={2}
          />
          <div className="flex flex-shrink-0 items-center gap-1">
            <IconButton
              icon={<MicrophoneIcon />}
              label="录音"
              onClick={onStartRecording}
              disabled={
                isSending ||
                isRecording ||
                selectedImages.length > 0 ||
                Boolean(selectedAudio) ||
                Boolean(selectedVideo)
              }
            />
            <IconButton
              icon={<VideoIcon />}
              label="选择视频"
              onClick={() => videoInputRef.current?.click()}
              disabled={
                isSending ||
                isRecording ||
                selectedImages.length > 0 ||
                Boolean(selectedAudio) ||
                Boolean(selectedVideo)
              }
              className="hidden sm:inline-flex"
            />
            <IconButton
              icon={<PlusIcon />}
              label="更多附件"
              onClick={() => videoInputRef.current?.click()}
              disabled={
                isSending ||
                isRecording ||
                selectedImages.length > 0 ||
                Boolean(selectedAudio) ||
                Boolean(selectedVideo)
              }
            />
            {hasPendingContent && (
              <Button
                onClick={onSend}
                disabled={isRecording || isSending}
                className="ml-1 h-10 px-4"
              >
                {isSending ? "发送中" : "发送"}
              </Button>
            )}
          </div>
        </div>
        <ErrorNotice message={errorMessage} className="mt-3 text-xs" />
      </div>
    </div>
  );
}
