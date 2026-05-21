"use client";

import { useRef, useState } from "react";
import { MicrophoneIcon } from "@/components/ui/icons";

type AudioBubbleProps = {
  src: string;
  durationMs: number | null;
};

export function AudioBubble({ src, durationMs }: AudioBubbleProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void togglePlayback()}
      className="flex min-w-36 items-center gap-3 rounded-full bg-white px-3 py-2 text-left text-sm text-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-[#f8fafc]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef6ff] text-accent">
        <MicrophoneIcon className="h-4 w-4" />
      </span>
      <span className="flex flex-1 items-center gap-1">
        <span className="font-medium">{isPlaying ? "播放中" : "语音"}</span>
        <span className="text-xs text-muted">{formatDuration(durationMs)}</span>
      </span>
      <span className="flex items-end gap-0.5 text-accent" aria-hidden="true">
        <span className="h-2 w-0.5 rounded-full bg-current" />
        <span className="h-4 w-0.5 rounded-full bg-current" />
        <span className="h-3 w-0.5 rounded-full bg-current" />
      </span>
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        className="hidden"
      />
    </button>
  );
}

function formatDuration(durationMs: number | null): string {
  if (!durationMs) return "";
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
