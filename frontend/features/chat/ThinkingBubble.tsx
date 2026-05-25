"use client";

import { useEffect, useState } from "react";
import { AdminAvatar } from "@/components/chat/ChatMessage";

export function ThinkingBubble() {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDots((current) => (current + 1) % 4);
    }, 500);
    return () => window.clearInterval(interval);
  }, []);

  const text = "Thinking" + ".".repeat(dots);

  return (
    <div className="flex justify-start gap-3 px-1">
      <AdminAvatar />
      <div className="min-w-[96px] select-none rounded-[18px] border border-border bg-bubble-admin px-4 py-3 text-sm italic text-muted shadow-sm">
        {text}
      </div>
    </div>
  );
}
