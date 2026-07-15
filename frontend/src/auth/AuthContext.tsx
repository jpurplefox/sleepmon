import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { __setRefreshHandler } from "../api/client";
import { postGoogle, postLogout, postRefresh, type AuthUser } from "./authApi";
import { tokenStore } from "./tokenStore";

type Status = "checking" | "anonymous" | "authenticated";
interface AuthValue {
  user: AuthUser | null;
  status: Status;
  login: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Explicit state machine (kept separate from `user`, not derived from it) so
  // the UI can tell "haven't checked yet" (checking) apart from "checked, no
  // session" (anonymous) — avoids a flash of signed-out UI on load while the
  // initial postRefresh() below is still in flight.
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    // Silent-renewal handler used by the api client on 401.
    __setRefreshHandler(async () => {
      try {
        const r = await postRefresh();
        tokenStore.set(r.access_token);
        setUser(r.user);
        setStatus("authenticated");
        return true;
      } catch {
        tokenStore.clear();
        setUser(null);
        setStatus("anonymous");
        return false;
      }
    });
    // Try to restore a session on load (cookie may still be valid even if access is gone).
    postRefresh()
      .then((r) => {
        tokenStore.set(r.access_token);
        setUser(r.user);
        setStatus("authenticated");
      })
      .catch(() => {
        setStatus("anonymous");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user,
    status,
    login: async (credential) => {
      const r = await postGoogle(credential);
      tokenStore.set(r.access_token);
      setUser(r.user);
      setStatus("authenticated");
    },
    logout: async () => {
      try { await postLogout(); } finally { tokenStore.clear(); setUser(null); setStatus("anonymous"); }
    },
  }), [user, status]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
