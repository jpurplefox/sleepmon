import { afterEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  register: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: posthog }));

import {
  __setSink,
  identify,
  initAnalytics,
  MAX_QUEUED,
  registerContext,
  resetIdentity,
  startAnalytics,
  track,
} from "./analytics";
import { readTelemetryConfig } from "./config";
import { recordEvents } from "./testing";

afterEach(() => vi.clearAllMocks());

const withKey = () => readTelemetryConfig({ VITE_POSTHOG_KEY: "phc_x", VITE_RELEASE: "abc" });

type InitOptions = Record<string, unknown> & {
  before_send: (cr: { event: string } | null) => { event: string } | null;
};
const initOptions = (): InitOptions => posthog.init.mock.calls[0][1] as InitOptions;

describe("analytics", () => {
  it("does not load PostHog without a key, and track is a no-op", async () => {
    initAnalytics(readTelemetryConfig({}));
    track({ name: "compare_limit_reached", props: {} });
    await startAnalytics(null);
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("waits for the session to settle before initialising PostHog", async () => {
    initAnalytics(withKey());
    track({ name: "tool_viewed", props: { tool: "box" } });
    expect(posthog.init).not.toHaveBeenCalled();
    await startAnalytics(null);
    expect(posthog.init).toHaveBeenCalledTimes(1);
    await startAnalytics(null);
    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it("initialises PostHog cookieless, without autocapture or server-enabled extras", async () => {
    initAnalytics(withKey());
    await startAnalytics(null);
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
        capture_heatmaps: false,
        capture_dead_clicks: false,
        capture_exceptions: false,
        capture_performance: false,
        disable_external_dependency_loading: true,
        disable_conversations: true,
        disable_product_tours: true,
      }),
    );
    expect(posthog.register).toHaveBeenCalledWith({ release: "abc" });
    track({ name: "tool_viewed", props: { tool: "box" } });
    expect(posthog.capture).toHaveBeenCalledWith("tool_viewed", { tool: "box" });
  });

  it("bootstraps the internal user id when signed in", async () => {
    initAnalytics(withKey());
    await startAnalytics("u-1");
    expect(initOptions().bootstrap).toEqual({ distinctID: "u-1", isIdentifiedID: true });
  });

  it("bootstraps a per-tab anonymous id (not identified) when signed out", async () => {
    initAnalytics(withKey());
    await startAnalytics(null);
    const bootstrap = initOptions().bootstrap as { distinctID: string };
    expect(bootstrap.distinctID).toMatch(/^[0-9a-f-]{36}$/);
    expect(bootstrap).not.toHaveProperty("isIdentifiedID");
  });

  it("flushes calls made before init, in order, after the init properties", async () => {
    initAnalytics(withKey());
    const order: string[] = [];
    posthog.register.mockImplementation((p: Record<string, unknown>) => order.push(`register:${Object.keys(p)}`));
    posthog.capture.mockImplementation((name: string) => order.push(`capture:${name}`));
    posthog.identify.mockImplementation((id: string) => order.push(`identify:${id}`));
    identify("u-1");
    registerContext({ signed_in: true, language: "en" });
    track({ name: "tool_viewed", props: { tool: "compare" } });
    expect(order).toEqual([]);
    await startAnalytics("u-1");
    expect(order).toEqual([
      "register:release",
      "identify:u-1",
      "register:signed_in,language",
      "capture:tool_viewed",
    ]);
    posthog.register.mockReset();
    posthog.capture.mockReset();
    posthog.identify.mockReset();
  });

  it("queues at most MAX_QUEUED calls before init", async () => {
    initAnalytics(withKey());
    for (let i = 0; i < MAX_QUEUED + 10; i++) track({ name: "team_renamed", props: {} });
    await startAnalytics(null);
    expect(posthog.capture).toHaveBeenCalledTimes(MAX_QUEUED);
  });

  it("never throws if PostHog fails to start, and then drops events", async () => {
    initAnalytics(withKey());
    posthog.init.mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    track({ name: "signed_out", props: {} });
    await expect(startAnalytics(null)).resolves.toBeUndefined();
    expect(() => track({ name: "signed_out", props: {} })).not.toThrow();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("only lets catalogue events and identity merges through", async () => {
    initAnalytics(withKey());
    await startAnalytics(null);
    const { before_send } = initOptions();
    for (const event of ["tool_viewed", "team_saved", "compare_limit_reached", "$identify"]) {
      expect(before_send({ event })).toEqual({ event });
    }
    for (const event of ["$pageview", "$autocapture", "$exception", "$web_vitals", "$dead_click", "$$heatmap", "custom"]) {
      expect(before_send({ event })).toBeNull();
    }
    expect(before_send(null)).toBeNull();
  });

  it("re-registers the init properties right after a reset", async () => {
    initAnalytics(withKey());
    await startAnalytics(null);
    posthog.register.mockClear();
    const order: string[] = [];
    posthog.reset.mockImplementation(() => order.push("reset"));
    posthog.register.mockImplementation(() => order.push("register"));
    resetIdentity();
    expect(order).toEqual(["reset", "register"]);
    expect(posthog.register).toHaveBeenCalledWith({ release: "abc" });
    posthog.reset.mockReset();
    posthog.register.mockReset();
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
