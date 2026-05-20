const SESSION_USER_ID_KEY = "hjhllm.userId";

export function getStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_USER_ID_KEY);
}

export function setStoredUserId(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_USER_ID_KEY, userId);
}

export function clearStoredUserId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_USER_ID_KEY);
}
