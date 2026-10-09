// The only door to product analytics (ADR-0010). Components call `track` with an
// event from the PRD 0017 catalogue; nothing here may ever throw, await, or
// change what the user sees.
import posthog from "posthog-js";

import type { Lang } from "../i18n";
import type { TelemetryConfig } from "./config";
import type { AnalyticsEvent } from "./events";

export interface AnalyticsSink {
  capture(name: string, props: Record<string, unknown>): void;
  identify(userId: string): void;
  reset(): void;
  register(props: Record<string, unknown>): void;
}

const noopSink: AnalyticsSink = {
  capture: () => {},
  identify: () => {},
  reset: () => {},
  register: () => {},
};

let sink: AnalyticsSink = noopSink;
// Super-properties registered once at init; PostHog's reset() drops them.
let initProps: Record<string, unknown> | null = null;

function safely(run: () => void): void {
  try {
    run();
  } catch {
    // Analytics must never break the app.
  }
}

export function initAnalytics(cfg: TelemetryConfig): void {
  if (!cfg.posthogKey) {
    sink = noopSink;
    initProps = null;
    return;
  }
  const key = cfg.posthogKey;
  safely(() => {
    posthog.init(key, {
      api_host: cfg.posthogHost,
      persistence: "memory",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_feature_flags: true,
    });
    sink = {
      capture: (name, props) => void posthog.capture(name, props),
      identify: (id) => posthog.identify(id),
      reset: () => posthog.reset(),
      register: (props) => posthog.register(props),
    };
    initProps = { release: cfg.release };
    sink.register(initProps);
  });
}

export function track(event: AnalyticsEvent): void {
  safely(() => sink.capture(event.name, event.props as Record<string, unknown>));
}

export function identify(userId: string): void {
  safely(() => sink.identify(userId));
}

export function resetIdentity(): void {
  safely(() => {
    sink.reset();
    if (initProps) sink.register(initProps);
  });
}

export function registerContext(ctx: { signed_in: boolean; language: Lang }): void {
  safely(() => sink.register(ctx));
}

/** Tests only: swap the sink; returns a function restoring the previous one. */
export function __setSink(next: AnalyticsSink): () => void {
  const prev = sink;
  sink = next;
  return () => {
    sink = prev;
  };
}
