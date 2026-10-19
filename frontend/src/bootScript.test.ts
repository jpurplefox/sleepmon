import { afterEach, describe, expect, it, vi } from "vitest";

import indexHtml from "../index.html?raw";
import { detectLang } from "./i18n";

// The inline script in index.html's <head> repeats detectLang before the app loads (ADR-0013).
const boot = indexHtml.match(/<script>(\(function\(\)\{[\s\S]*?)<\/script>/)![1];

function skips(path: string): boolean {
  window.history.replaceState(null, "", path);
  document.documentElement.removeAttribute("data-prerender");
  new Function(boot)();
  return document.documentElement.getAttribute("data-prerender") === "skip";
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-prerender");
  window.history.replaceState(null, "", "/");
});

describe("boot script", () => {
  it.each([
    ["en", "en-US", "/"],
    ["es", "en-US", "/"],
    ["en", "es-AR", "/"],
    [null, "es-AR", "/"],
    [null, "en-US", "/"],
    [null, "fr-FR", "/"],
    ["en", "en-US", "/compare"],
  ])("saved %s, browser %s, path %s: keeps the prerender only on / in English", (saved, browser, path) => {
    if (saved) localStorage.setItem("sleepmon.lang", saved);
    vi.spyOn(navigator, "language", "get").mockReturnValue(browser);
    expect(skips(path)).toBe(!(path === "/" && detectLang() === "en"));
  });
});
