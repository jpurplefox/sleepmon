const KEY = "sleepmon.access";
const HINT = "sleepmon.session";

export const tokenStore = {
  get: (): string | null => localStorage.getItem(KEY),
  set: (t: string) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
};

// Non-sensitive hint that this browser has had a session, so the app only
// attempts a silent restore (POST /auth/refresh) when it plausibly can. The
// httpOnly refresh cookie is the real source of truth and unreadable by JS;
// this just avoids a guaranteed-401 request (and its red console line) for
// users who never signed in or have signed out.
export const sessionHint = {
  mark: () => localStorage.setItem(HINT, "1"),
  clear: () => localStorage.removeItem(HINT),
  present: (): boolean => localStorage.getItem(HINT) === "1",
};
