import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const auth = vi.hoisted(() => ({
  value: { status: "anonymous", user: null } as { status: string; user: { id: string; email: string } | null },
}));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => auth.value }));
const sentry = vi.hoisted(() => ({ setErrorUser: vi.fn() }));
vi.mock("./sentry", () => sentry);

import { LanguageProvider } from "../i18n";
import { recordEvents } from "./testing";
import { TelemetryBridge } from "./TelemetryBridge";

let rec: ReturnType<typeof recordEvents>;
beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
  auth.value = { status: "anonymous", user: null };
  rec = recordEvents();
});
afterEach(() => rec.restore());

function renderAt(path: string) {
  const loc = memoryLocation({ path, record: true });
  const ui = () => (
    <LanguageProvider>
      <Router hook={loc.hook}>
        <TelemetryBridge />
      </Router>
    </LanguageProvider>
  );
  const r = render(ui());
  return { ...r, loc, rerenderUi: () => r.rerender(ui()) };
}

describe("TelemetryBridge", () => {
  it("sends tool_viewed once per arrival on a tool", () => {
    const { loc, rerenderUi } = renderAt("/compare");
    // A re-render that changes the session must not repeat the view.
    auth.value = { status: "authenticated", user: { id: "u-1", email: "a@b.c" } };
    rerenderUi();
    act(() => loc.navigate("/box"));
    act(() => loc.navigate("/box"));
    expect(rec.events.filter((e) => e.name === "tool_viewed").map((e) => e.props)).toEqual([
      { tool: "compare" },
      { tool: "box" },
    ]);
  });

  it("identifies on sign-in with the id only, and resets on sign-out", () => {
    const { rerenderUi } = renderAt("/compare");
    expect(rec.identities).toEqual([]);
    auth.value = { status: "authenticated", user: { id: "u-1", email: "a@b.c" } };
    rerenderUi();
    expect(rec.identities).toEqual(["u-1"]);
    expect(sentry.setErrorUser).toHaveBeenLastCalledWith("u-1");
    auth.value = { status: "anonymous", user: null };
    rerenderUi();
    expect(rec.identities).toEqual(["u-1", null]);
    expect(sentry.setErrorUser).toHaveBeenLastCalledWith(null);
  });

  it("waits for the session check, then sends one tool_viewed after the context", () => {
    auth.value = { status: "checking", user: null };
    const { rerenderUi } = renderAt("/compare");
    expect(rec.events).toEqual([]);
    auth.value = { status: "anonymous", user: null };
    rerenderUi();
    expect(rec.events).toEqual([{ name: "tool_viewed", props: { tool: "compare" } }]);
    expect(rec.log.indexOf("register")).toBeGreaterThanOrEqual(0);
    expect(rec.log.indexOf("register")).toBeLessThan(rec.log.indexOf("capture"));
  });

  it("re-registers the context after sign-out", () => {
    auth.value = { status: "authenticated", user: { id: "u-1", email: "a@b.c" } };
    const { rerenderUi } = renderAt("/compare");
    auth.value = { status: "anonymous", user: null };
    rerenderUi();
    expect(rec.contexts[rec.contexts.length - 1]).toEqual({ signed_in: false, language: "en" });
  });

  it("registers signed_in and language", () => {
    renderAt("/compare");
    expect(rec.contexts[rec.contexts.length - 1]).toEqual({ signed_in: false, language: "en" });
  });

  it("never sends the email", () => {
    auth.value = { status: "authenticated", user: { id: "u-1", email: "a@b.c" } };
    renderAt("/box");
    expect(JSON.stringify([rec.events, rec.identities, rec.contexts])).not.toContain("a@b.c");
  });
});
