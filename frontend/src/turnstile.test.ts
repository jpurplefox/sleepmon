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
  const remove = vi.fn();
  (window as unknown as { turnstile: unknown }).turnstile = { render, remove };
  return Object.assign(render, { remove });
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

  it("removes the widget once a token arrives", async () => {
    const render = fakeTurnstile((o) => o.callback("tok-3"));
    await renderTurnstile(document.createElement("div"), "site");
    expect(render.remove).toHaveBeenCalledWith("widget-1");
  });

  it("clears the container before rendering", async () => {
    fakeTurnstile((o) => o.callback("t"));
    const el = document.createElement("div");
    el.appendChild(document.createElement("span"));
    await renderTurnstile(el, "site");
    expect(el.children).toHaveLength(0);
  });

  it("allows a retry after the script loaded without defining the global", async () => {
    const first = renderTurnstile(document.createElement("div"), "site");
    const script1 = document.head.querySelector("script") as HTMLScriptElement;
    script1.dispatchEvent(new Event("load"));
    await expect(first).rejects.toThrow("verification");
    expect(document.head.querySelectorAll("script")).toHaveLength(0);

    const second = renderTurnstile(document.createElement("div"), "site");
    const script2 = document.head.querySelector("script") as HTMLScriptElement;
    expect(script2).not.toBe(script1);
    fakeTurnstile((o) => o.callback("tok-4"));
    script2.dispatchEvent(new Event("load"));
    await expect(second).resolves.toBe("tok-4");
  });

  it("times out with 'verification' and removes the widget", async () => {
    vi.useFakeTimers();
    try {
      const render = fakeTurnstile(() => {});
      const p = renderTurnstile(document.createElement("div"), "site", 1000);
      const assertion = expect(p).rejects.toThrow("verification");
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
      expect(render.remove).toHaveBeenCalledWith("widget-1");
    } finally {
      vi.useRealTimers();
    }
  });
});
