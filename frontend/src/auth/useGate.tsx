import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

interface GateValue {
  guard: (action: () => void) => void;
  pending: boolean;
  dialogOpen: boolean;
  closeDialog: () => void;
}
const Ctx = createContext<GateValue | null>(null);

export function GateProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (status === "authenticated" && pendingRef.current) {
      const action = pendingRef.current;
      pendingRef.current = null;
      setPending(false);
      setDialogOpen(false);
      action();
    }
  }, [status]);

  const value: GateValue = {
    guard: (action) => {
      if (status === "authenticated") {
        action();
        return;
      }
      pendingRef.current = action;
      setPending(true);
      setDialogOpen(true);
    },
    pending,
    dialogOpen,
    closeDialog: () => {
      pendingRef.current = null;
      setPending(false);
      setDialogOpen(false);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGate(): GateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGate must be used within GateProvider");
  return v;
}
