const KEY = "sleepmon.access";

export const tokenStore = {
  get: (): string | null => localStorage.getItem(KEY),
  set: (t: string) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
};
