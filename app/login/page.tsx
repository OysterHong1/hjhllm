"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  createUserSession,
  getErrorMessage,
  restoreUserSession,
} from "@/lib/api-client/client";
import {
  clearStoredUserId,
  getStoredUserId,
  setStoredUserId,
} from "@/lib/api-client/session";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    const userId = getStoredUserId();
    if (!userId) return;

    let cancelled = false;
    restoreUserSession(userId)
      .then(() => {
        if (!cancelled) router.replace("/chat");
      })
      .catch(() => {
        if (!cancelled) {
          clearStoredUserId();
          setErrorMessage("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogin = async () => {
    const trimmed = username.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const user = await createUserSession(trimmed);
      setStoredUserId(user.id);
      router.push("/chat");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setIsSubmitting(false);
    }
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
            disabled={!username.trim() || isSubmitting}
          >
            {isSubmitting ? "进入中..." : "进入聊天"}
          </Button>
          {errorMessage && (
            <p className="text-sm text-accent text-center">{errorMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}
