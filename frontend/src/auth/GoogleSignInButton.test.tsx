import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";


let rec: { events: unknown[]; restore: () => void };
const auth = { login: vi.fn() };
vi.mock("./AuthContext", () => ({ useAuth: () => auth }));

// The module reads CLIENT_ID and keeps a `gsiInitialized` flag at load time, so
// each test gets a fresh module with the env stubbed.
// The telemetry sink lives in the same graph, so the recorder is imported after the reset.
async function mountButton(login: () => Promise<void>) {
  vi.resetModules();
  const { recordEvents } = await import("../telemetry/testing");
  rec = recordEvents();
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "test-client");
  auth.login = vi.fn(login);
  let callback: (r: { credential: string }) => void = () => {};
  window.google = {
    accounts: {
      id: {
        initialize: (config) => { callback = config.callback; },
        renderButton: () => {},
        disableAutoSelect: () => {},
      },
    },
  };
  // Same fresh module graph as the button, so the i18n context matches.
  const { LanguageProvider } = await import("../i18n");
  const { GoogleSignInButton } = await import("./GoogleSignInButton");
  render(<LanguageProvider><GoogleSignInButton reason="save_to_box" /></LanguageProvider>);
  return () => callback({ credential: "cred" });
}

describe("GoogleSignInButton analytics", () => {
  afterEach(() => {
    rec.restore();
    vi.unstubAllEnvs();
    delete window.google;
  });

  it("records sign_in_completed with the reason when login succeeds", async () => {
    const fire = await mountButton(() => Promise.resolve());
    await act(async () => { fire(); });
    expect(rec.events).toEqual([{ name: "sign_in_completed", props: { reason: "save_to_box" } }]);
  });

  it("records sign_in_failed and no completion when login rejects", async () => {
    const fire = await mountButton(() => Promise.reject(new Error("nope")));
    await act(async () => { fire(); });
    expect(rec.events).toEqual([{ name: "sign_in_failed", props: {} }]);
  });
});
