// Keeps analytics and Sentry in step with the session: who is signed in (by
// internal id only), the language, and which tool the user arrived on.
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import { identify, registerContext, resetIdentity, startAnalytics, track } from "./analytics";
import { setErrorUser } from "./sentry";
import { toolOf } from "./toolOf";
import type { Tool } from "./events";

export function TelemetryBridge(): null {
  const { status, user } = useAuth();
  const { lang } = useI18n();
  const [location] = useLocation();
  const userId = status === "authenticated" ? (user?.id ?? null) : null;
  const identified = useRef<string | null>(null);
  const lastTool = useRef<Tool | null>(null);

  useEffect(() => {
    if (status === "checking") return;
    // First settle only (later calls are ignored): bootstraps the signed-in id.
    void startAnalytics(userId);
    if (userId !== null && identified.current !== userId) {
      identify(userId);
      setErrorUser(userId);
      identified.current = userId;
    } else if (userId === null && identified.current !== null) {
      resetIdentity();
      setErrorUser(null);
      identified.current = null;
    }
  }, [status, userId]);

  useEffect(() => {
    if (status === "checking") return;
    registerContext({ signed_in: status === "authenticated", language: lang });
  }, [status, lang]);

  // Declared after the context effect so registerContext runs first: every
  // tool_viewed must carry signed_in and language.
  useEffect(() => {
    if (status === "checking") return;
    const tool = toolOf(location);
    if (tool !== null && tool !== lastTool.current) track({ name: "tool_viewed", props: { tool } });
    lastTool.current = tool;
  }, [location, status]);

  return null;
}
