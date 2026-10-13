import { afterEach, describe, expect, it, vi } from "vitest";

import { __resetTurnstileForTests, renderTurnstile } from "./turnstile";

type Opts = { sitekey: string; appearance: string; callback: (t: string) => void; "error-callback": () => void };

afterEach(() => {
  __resetTurnstileForTests();
  delete (window as { turnstile?: unknown }).turnstile;
  document.head.innerHTML = "";
});

function fakeTurnstile(run: (opts: Opts) => void) {
  const render = vi.fn((_el: HTMLElement, opts: Opts) => {
    run(opts);
    return "widget-1";
  });
  (window as unknown as { turnstile: unknown }).turnstile = { render, remove: vi.fn() };
  return render;
}

describe("renderTurnstile", () => {
  it("renders interaction-only and resolves with the token", async () => {
    const render = fakeTurnstile((o) => o.callback("tok-1"));
    await expect(renderTurnstile(document.createElement("div"), "site")).resolves.toBe("tok-1");
    expect(render.mock.calls[0][1]).toMatchObject({ sitekey: "site", appearance: "interaction-only" });
  });

  it("rejects when the check fails", async () => {
    fakeTurnstile((o) => o["error-callback"]());
    await expect(renderTurnstile(document.createElement("div"), "site")).rejects.toThrow("verification");
  });

  it("loads the script once when it isn't there yet", async () => {
    const p = renderTurnstile(document.createElement("div"), "site");
    const script = document.head.querySelector("script[src*='challenges.cloudflare.com']") as HTMLScriptElement;
    expect(script.src).toContain("render=explicit");
    fakeTurnstile((o) => o.callback("tok-2"));
    script.dispatchEvent(new Event("load"));
    await expect(p).resolves.toBe("tok-2");
  });
});
