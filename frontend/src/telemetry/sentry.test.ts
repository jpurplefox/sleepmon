import { afterEach, describe, expect, it, vi } from "vitest";

const Sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: "BrowserTracing" })),
}));
vi.mock("@sentry/react", () => Sentry);

import { readTelemetryConfig } from "./config";
import { initSentry, reportError, setErrorUser } from "./sentry";

afterEach(() => vi.clearAllMocks());

describe("sentry", () => {
  it("stays off without a DSN", () => {
    expect(initSentry(readTelemetryConfig({}))).toBe(false);
    reportError(new Error("x"));
    setErrorUser("u");
    expect(Sentry.init).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.setUser).not.toHaveBeenCalled();
  });

  it("initialises without PII and traces only to the API", () => {
    const cfg = readTelemetryConfig({
      VITE_SENTRY_DSN: "https://k@o.ingest.de.sentry.io/1",
      VITE_SENTRY_TRACES_SAMPLE_RATE: "0.3",
      VITE_API_URL: "https://api.example",
      VITE_RELEASE: "abc",
    });
    expect(initSentry(cfg)).toBe(true);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://k@o.ingest.de.sentry.io/1",
        release: "abc",
        sendDefaultPii: false,
        tracesSampleRate: 0.3,
        tracePropagationTargets: ["https://api.example"],
      }),
    );
    reportError(new Error("boom"), { componentStack: "x" });
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), { extra: { componentStack: "x" } });
    setErrorUser("u-1");
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: "u-1" });
    setErrorUser(null);
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null);
  });
});
