const SESSION_USER_ID_KEY = "hjhllm.userId";
const SESSION_USER_ID_COOKIE = "hjhllm_user_id_hint";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

function setCookieValue(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Max-Age=${SESSION_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

function clearCookieValue(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function getStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_USER_ID_KEY) ?? getCookieValue(SESSION_USER_ID_COOKIE);
}

export function setStoredUserId(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_USER_ID_KEY, userId);
  setCookieValue(SESSION_USER_ID_COOKIE, userId);
}

export function clearStoredUserId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_USER_ID_KEY);
  clearCookieValue(SESSION_USER_ID_COOKIE);
}
