import { describe, expect, it } from "vitest";

import { readTelemetryConfig } from "./config";

describe("readTelemetryConfig", () => {
  it("turns everything off with an empty env", () => {
    expect(readTelemetryConfig({})).toEqual({
      release: "dev",
      environment: "development",
      sentryDsn: null,
      tracesSampleRate: 0,
      apiUrl: "http://localhost:8000",
      posthogKey: null,
      posthogHost: "https://eu.i.posthog.com",
    });
  });

  it("reads every value", () => {
    const cfg = readTelemetryConfig({
      VITE_RELEASE: "abc",
      VITE_SENTRY_ENVIRONMENT: "production",
      VITE_SENTRY_DSN: "https://k@o.ingest.de.sentry.io/1",
      VITE_SENTRY_TRACES_SAMPLE_RATE: "0.2",
      VITE_API_URL: "https://api.example",
      VITE_POSTHOG_KEY: "phc_x",
      VITE_POSTHOG_HOST: "https://eu.i.posthog.com",
    });
    expect(cfg).toMatchObject({ release: "abc", sentryDsn: "https://k@o.ingest.de.sentry.io/1", tracesSampleRate: 0.2, apiUrl: "https://api.example", posthogKey: "phc_x" });
  });

  it.each(["", "abc", "1.5", "-1"])("falls back to 0 for sample rate %j", (raw) => {
    expect(readTelemetryConfig({ VITE_SENTRY_TRACES_SAMPLE_RATE: raw }).tracesSampleRate).toBe(0);
  });

  it("treats empty keys as absent", () => {
    const cfg = readTelemetryConfig({ VITE_SENTRY_DSN: "", VITE_POSTHOG_KEY: "" });
    expect(cfg.sentryDsn).toBeNull();
    expect(cfg.posthogKey).toBeNull();
  });
});
