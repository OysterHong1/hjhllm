export type User = {
  id: string;
  username: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  sender: "user" | "admin";
  content: string;
  createdAt: string;
};

export type Store = {
  currentUserId: string | null;
  users: User[];
  conversations: Conversation[];
  messages: Message[];
};

const STORAGE_KEY = "hjhllm.store";

function defaultStore(): Store {
  return {
    currentUserId: null,
    users: [],
    conversations: [],
    messages: [],
  };
}

export function getStore(): Store {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore();
    return JSON.parse(raw) as Store;
  } catch {
    return defaultStore();
  }
}

export function setStore(store: Store): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function resetStore(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function updateStore(patch: Partial<Store>): Store {
  const store = getStore();
  const next = { ...store, ...patch };
  setStore(next);
  return next;
}

export function getCurrentUser(): User | null {
  const store = getStore();
  if (!store.currentUserId) return null;
  return store.users.find((u) => u.id === store.currentUserId) ?? null;
}
