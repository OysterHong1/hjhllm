"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/chat/BrandMark";
import { Button } from "@/components/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
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
    <div className="flex h-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-md mx-auto">
        <div className="mb-7 flex justify-center">
          <BrandMark />
        </div>

        <div className="rounded-[28px] border border-border bg-white p-3 shadow-xl shadow-slate-200/70">
          <Input
            placeholder="输入用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="border-transparent bg-transparent text-base focus:border-transparent focus:ring-0"
          />
        </div>
        <div className="mt-3">
          <Button
            className="w-full"
            onClick={handleLogin}
            disabled={!username.trim() || isSubmitting}
          >
            {isSubmitting ? "进入中..." : "进入聊天"}
          </Button>
          <ErrorNotice message={errorMessage} className="mt-3 text-center" />
        </div>
      </div>
    </div>
  );
}
