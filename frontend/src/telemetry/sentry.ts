// The only door to Sentry in the browser (ADR-0010). Off without a DSN.
import * as Sentry from "@sentry/react";

import type { TelemetryConfig } from "./config";

let enabled = false;

export function initSentry(cfg: TelemetryConfig): boolean {
  if (!cfg.sentryDsn) return false;
  Sentry.init({
    dsn: cfg.sentryDsn,
    release: cfg.release,
    environment: cfg.environment,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: cfg.tracesSampleRate,
    // Continue browser traces into the API only (sentry-trace / baggage headers).
    tracePropagationTargets: [cfg.apiUrl],
  });
  enabled = true;
  return true;
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** The internal user id only — never the email or name. */
export function setErrorUser(userId: string | null): void {
  if (!enabled) return;
  Sentry.setUser(userId === null ? null : { id: userId });
}
