"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createUser } from "@/lib/chat";
import { getCurrentUser } from "@/lib/store";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (getCurrentUser()) {
      router.replace("/chat");
    }
  }, [router]);

  const handleLogin = () => {
    const trimmed = username.trim();
    if (!trimmed) return;
    createUser(trimmed);
    router.push("/chat");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            HJH LLM
          </h1>
          <p className="text-sm text-muted">输入用户名开始对话</p>
        </div>

        <div className="space-y-4">
          <Input
            placeholder="输入用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <Button
            className="w-full"
            onClick={handleLogin}
            disabled={!username.trim()}
          >
            进入聊天
          </Button>
        </div>
      </div>
    </div>
  );
}
