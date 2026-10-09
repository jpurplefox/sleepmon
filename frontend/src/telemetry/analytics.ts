// The only door to product analytics (ADR-0010). Components call `track` with an
// event from the PRD 0017 catalogue; nothing here may ever throw, await, or
// change what the user sees.
//
// Lifecycle: `initAnalytics` (at startup) only records the config. PostHog is
// loaded lazily, as its own chunk, by `startAnalytics` once the session check
// settles, so a signed-in user's internal id can be bootstrapped as the
// distinct id (no fresh anonymous id merged into the person on every load).
// Calls made before PostHog is up are queued in memory, at most MAX_QUEUED;
// later ones are dropped. Without a key nothing is loaded or queued.
import type { PostHog } from "posthog-js";

import type { Lang } from "../i18n";
import type { TelemetryConfig } from "./config";
import { EVENT_NAMES, type AnalyticsEvent } from "./events";

export interface AnalyticsSink {
  capture(name: string, props: Record<string, unknown>): void;
  identify(userId: string): void;
  reset(): void;
  register(props: Record<string, unknown>): void;
}

type SinkCall = (sink: AnalyticsSink) => void;

/** Calls kept while PostHog loads; the rest are dropped. */
export const MAX_QUEUED = 50;

// PostHog's own event needed to merge an anonymous tab into the signed-in person.
const ALLOWED_EVENTS: ReadonlySet<string> = new Set<string>([...EVENT_NAMES, "$identify"]);

let config: TelemetryConfig | null = null;
let started = false;
// The live sink once PostHog is up (or a test sink).
let sink: AnalyticsSink | null = null;
// Calls waiting for PostHog; null when nothing is waiting (off, ready or failed).
let queue: SinkCall[] | null = null;
// Super-properties registered once at init; PostHog's reset() drops them.
let initProps: Record<string, unknown> | null = null;

function safely(run: () => void): void {
  try {
    run();
  } catch {
    // Analytics must never break the app.
  }
}

function send(call: SinkCall): void {
  safely(() => {
    if (sink) call(sink);
    else if (queue && queue.length < MAX_QUEUED) queue.push(call);
  });
}

function sinkFor(posthog: PostHog): AnalyticsSink {
  return {
    capture: (name, props) => void posthog.capture(name, props),
    identify: (id) => posthog.identify(id),
    reset: () => posthog.reset(),
    register: (props) => posthog.register(props),
  };
}

/** Records the config at startup; loads nothing. */
export function initAnalytics(cfg: TelemetryConfig): void {
  started = false;
  sink = null;
  config = cfg.posthogKey ? cfg : null;
  queue = config ? [] : null;
  initProps = config ? { release: cfg.release } : null;
}

/**
 * Loads and starts PostHog once the session check has settled: with the
 * internal user id as an identified distinct id when signed in, anonymous
 * otherwise. Only the first call does anything. The returned promise never
 * rejects; callers do not wait for it.
 */
export function startAnalytics(userId: string | null): Promise<void> {
  if (!config?.posthogKey || started) return Promise.resolve();
  started = true;
  const cfg = config;
  const key = config.posthogKey;
  return import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: cfg.posthogHost,
        persistence: "memory",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_feature_flags: true,
        // Pinned off so project settings on the server cannot switch them on.
        capture_heatmaps: false,
        capture_dead_clicks: false,
        capture_exceptions: false,
        capture_performance: false,
        disable_external_dependency_loading: true,
        disable_conversations: true,
        disable_product_tours: true,
        before_send: (cr) => (cr && ALLOWED_EVENTS.has(cr.event) ? cr : null),
        ...(userId !== null ? { bootstrap: { distinctID: userId, isIdentifiedID: true } } : {}),
      });
      const live = sinkFor(posthog);
      if (initProps) live.register(initProps);
      sink = live;
      const waiting = queue ?? [];
      queue = null;
      for (const call of waiting) safely(() => call(live));
    })
    .catch(() => {
      // Blocked or failed to load: stop queueing; every later call is a no-op.
      queue = null;
    });
}

export function track(event: AnalyticsEvent): void {
  send((s) => s.capture(event.name, event.props as Record<string, unknown>));
}

export function identify(userId: string): void {
  send((s) => s.identify(userId));
}

export function resetIdentity(): void {
  send((s) => {
    s.reset();
    if (initProps) s.register(initProps);
  });
}

export function registerContext(ctx: { signed_in: boolean; language: Lang }): void {
  send((s) => s.register(ctx));
}

/** Tests only: swap the sink; returns a function restoring the previous one. */
export function __setSink(next: AnalyticsSink): () => void {
  const prev = sink;
  sink = next;
  return () => {
    sink = prev;
  };
}
