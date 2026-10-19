import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { render as prerender } from "./entry-server";
import { LanguageProvider } from "./i18n";
import { UI } from "./i18n/ui";
import { mountApp } from "./mount";
import * as sentry from "./telemetry/sentry";

function stubMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

// A #root holding the build's prerendered landing.
function prerenderedRoot(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = prerender().html;
  document.body.append(root);
  return root;
}

const app = (
  <LanguageProvider>
    <App />
  </LanguageProvider>
);

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-prerender");
  document.body.innerHTML = "";
});

describe("mountApp", () => {
  it.each([false, true])("hydrates the prerendered landing without a mismatch (reduced motion: %s)", async (reduce) => {
    stubMotion(reduce);
    localStorage.setItem("sleepmon.lang", "en");
    const root = prerenderedRoot();
    const report = vi.spyOn(sentry, "reportError");
    const error = vi.spyOn(console, "error");

    await act(async () => mountApp(root, app));

    expect(report).not.toHaveBeenCalled();
    expect(error.mock.calls.flat().join(" ")).not.toMatch(/hydrat|did not match/i);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(UI.en["landing.title.lead"]);
  });

  it("discards the prerendered markup when the boot script asked to", async () => {
    stubMotion(false);
    localStorage.setItem("sleepmon.lang", "es");
    document.documentElement.setAttribute("data-prerender", "skip");
    const root = prerenderedRoot();

    await act(async () => mountApp(root, app));

    expect(document.documentElement.hasAttribute("data-prerender")).toBe(false);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(UI.es["landing.title.lead"]);
    expect(screen.queryByText(UI.en["landing.title.lead"], { exact: false })).toBeNull();
  });
});
