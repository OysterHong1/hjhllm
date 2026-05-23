"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { IconButton } from "@/components/ui/IconButton";
import { Textarea } from "@/components/ui/Textarea";
import { PlusIcon } from "@/components/ui/icons";
import { formatAttachmentSize } from "@/lib/contracts";
import type { SelectedImage, SelectedVideo } from "./types";

type ChatComposerProps = {
  value: string;
  errorMessage: string;
  selectedImages: SelectedImage[];
  selectedVideo: SelectedVideo | null;
  isSending: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onChangeValue: (value: string) => void;
  onSend: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onImageSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  onRemoveVideo: () => void;
};

export function ChatComposer({
  value,
  errorMessage,
  selectedImages,
  selectedVideo,
  isSending,
  fileInputRef,
  onChangeValue,
  onSend,
  onKeyDown,
  onImageSelect,
  onRemoveImage,
  onRemoveVideo,
}: ChatComposerProps) {
  const hasPendingContent =
    Boolean(value.trim()) ||
    selectedImages.length > 0 ||
    Boolean(selectedVideo);

  return (
    <div className="flex-shrink-0 bg-background/95 px-3 pb-4 pt-2">
      <div className="mx-auto max-w-3xl">
        {selectedImages.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {selectedImages.map((image, index) => (
              <div
                key={image.previewUrl}
                className="relative aspect-square overflow-hidden rounded-lg border border-border bg-bubble-admin"
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

        {selectedVideo && (
          <div className="mb-3 rounded-lg border border-border bg-bubble-admin p-3 shadow-sm">
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

        <div
          className="flex min-h-[64px] items-center gap-2 rounded-[32px] border border-[#e8e8e3] bg-white px-3 py-2 shadow-[0_18px_40px_rgba(16,24,40,0.10)] transition-all duration-200 md:min-h-[70px] md:gap-3 md:px-4"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={onImageSelect}
          />
          <Textarea
            placeholder="快发消息给我..."
            value={value}
            onChange={(event) => onChangeValue(event.target.value)}
            onKeyDown={onKeyDown}
            className="min-h-[44px] flex-1 rounded-none border-transparent bg-transparent px-1 py-3 text-[17px] leading-6 shadow-none placeholder:text-[#8a8882] focus:border-transparent focus:ring-0"
            rows={2}
          />
          <div className="flex flex-shrink-0 items-center gap-1">
            <IconButton
              icon={<PlusIcon />}
              label="更多附件"
              onClick={() => fileInputRef.current?.click()}
              disabled={
                isSending ||
                selectedImages.length >= 4 ||
                Boolean(selectedVideo)
              }
            />
            {hasPendingContent && (
              <Button
                onClick={onSend}
                disabled={isSending}
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
