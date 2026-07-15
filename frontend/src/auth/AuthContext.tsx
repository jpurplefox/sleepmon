import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { __setRefreshHandler } from "../api/client";
import { postGoogle, postLogout, postRefresh, type AuthUser } from "./authApi";
import { tokenStore } from "./tokenStore";

type Status = "anonymous" | "authenticated";
interface AuthValue {
  user: AuthUser | null;
  status: Status;
  login: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Silent-renewal handler used by the api client on 401.
    __setRefreshHandler(async () => {
      try {
        const r = await postRefresh();
        tokenStore.set(r.access_token);
        setUser(r.user);
        return true;
      } catch {
        tokenStore.clear();
        setUser(null);
        return false;
      }
    });
    // Try to restore a session on load (cookie may still be valid even if access is gone).
    if (!user) {
      postRefresh().then((r) => { tokenStore.set(r.access_token); setUser(r.user); }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user,
    status: user ? "authenticated" : "anonymous",
    login: async (credential) => {
      const r = await postGoogle(credential);
      tokenStore.set(r.access_token);
      setUser(r.user);
    },
    logout: async () => {
      try { await postLogout(); } finally { tokenStore.clear(); setUser(null); }
    },
  }), [user]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
