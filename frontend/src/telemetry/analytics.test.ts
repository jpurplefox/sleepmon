import { afterEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  register: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: posthog }));

import { __setSink, initAnalytics, registerContext, track } from "./analytics";
import { readTelemetryConfig } from "./config";
import { recordEvents } from "./testing";

afterEach(() => vi.clearAllMocks());

describe("analytics", () => {
  it("does not load PostHog without a key, and track is a no-op", () => {
    initAnalytics(readTelemetryConfig({}));
    track({ name: "compare_limit_reached", props: {} });
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("initialises PostHog cookieless, without autocapture, and sends events", () => {
    initAnalytics(readTelemetryConfig({ VITE_POSTHOG_KEY: "phc_x", VITE_RELEASE: "abc" }));
    expect(posthog.init).toHaveBeenCalledWith(
      "phc_x",
      expect.objectContaining({
        api_host: "https://eu.i.posthog.com",
        persistence: "memory",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_feature_flags: true,
      }),
    );
    expect(posthog.register).toHaveBeenCalledWith({ release: "abc" });
    track({ name: "tool_viewed", props: { tool: "box" } });
    expect(posthog.capture).toHaveBeenCalledWith("tool_viewed", { tool: "box" });
  });

  it("never throws when the sink fails", () => {
    const restore = __setSink({
      capture: () => { throw new Error("blocked"); },
      identify: () => { throw new Error("blocked"); },
      reset: () => { throw new Error("blocked"); },
      register: () => { throw new Error("blocked"); },
    });
    expect(() => track({ name: "signed_out", props: {} })).not.toThrow();
    expect(() => registerContext({ signed_in: false, language: "es" })).not.toThrow();
    restore();
  });

  it("recordEvents captures what track sends", () => {
    const rec = recordEvents();
    track({ name: "team_renamed", props: {} });
    expect(rec.events).toEqual([{ name: "team_renamed", props: {} }]);
    rec.restore();
  });
});
