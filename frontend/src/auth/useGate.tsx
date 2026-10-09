import { createContext, useContext, useEffect, useRef, useState } from "react";
import { track } from "../telemetry/analytics";
import type { SignInReason } from "../telemetry/events";
import { useAuth } from "./AuthContext";

type GuardReason = Exclude<SignInReason, "page_gate">;

interface GateValue {
  guard: (action: () => void, reason: GuardReason) => void;
  pending: boolean;
  dialogOpen: boolean;
  /** Why the dialog is open, for the sign-in it leads to. */
  reason: GuardReason | null;
  closeDialog: () => void;
}
const Ctx = createContext<GateValue | null>(null);

export function GateProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState<GuardReason | null>(null);
  const pendingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (status === "authenticated" && pendingRef.current) {
      const action = pendingRef.current;
      pendingRef.current = null;
      setPending(false);
      setReason(null);
      setDialogOpen(false);
      action();
    }
  }, [status]);

  const value: GateValue = {
    guard: (action, why) => {
      if (status === "authenticated") {
        action();
        return;
      }
      pendingRef.current = action;
      setPending(true);
      setReason(why);
      setDialogOpen(true);
      track({ name: "sign_in_prompted", props: { reason: why } });
    },
    pending,
    dialogOpen,
    reason,
    closeDialog: () => {
      if (pendingRef.current && reason) track({ name: "sign_in_abandoned", props: { reason } });
      pendingRef.current = null;
      setPending(false);
      setReason(null);
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
