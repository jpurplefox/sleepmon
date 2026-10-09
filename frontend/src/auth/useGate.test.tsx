import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = { status: "anonymous" as "anonymous" | "authenticated" };
vi.mock("./AuthContext", () => ({ useAuth: () => authState }));

import { recordEvents } from "../telemetry/testing";
import { GateProvider, useGate } from "./useGate"; // GateProvider re-exported for tests

const wrapper = ({ children }: { children: React.ReactNode }) => <GateProvider>{children}</GateProvider>;

describe("useGate", () => {
  it("runs the action immediately when authenticated", () => {
    authState.status = "authenticated";
    const { result } = renderHook(() => useGate(), { wrapper });
    const action = vi.fn();
    act(() => result.current.guard(action, "my_pokemon"));
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.dialogOpen).toBe(false);
  });

  it("defers the action and opens the dialog when anonymous, then resumes on auth", () => {
    authState.status = "anonymous";
    const { result, rerender } = renderHook(() => useGate(), { wrapper });
    const action = vi.fn();
    act(() => result.current.guard(action, "my_pokemon"));
    expect(action).not.toHaveBeenCalled();
    expect(result.current.dialogOpen).toBe(true);
    act(() => {
      authState.status = "authenticated";
      rerender();
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.dialogOpen).toBe(false);
  });
});

describe("useGate analytics", () => {
  let rec: ReturnType<typeof recordEvents>;
  beforeEach(() => { rec = recordEvents(); });
  afterEach(() => rec.restore());

  it("records the prompt and its abandonment with the reason", () => {
    authState.status = "anonymous";
    const { result } = renderHook(() => useGate(), { wrapper });
    act(() => result.current.guard(vi.fn(), "save_to_box"));
    expect(result.current.reason).toBe("save_to_box");
    act(() => result.current.closeDialog());
    expect(rec.events).toEqual([
      { name: "sign_in_prompted", props: { reason: "save_to_box" } },
      { name: "sign_in_abandoned", props: { reason: "save_to_box" } },
    ]);
  });

  it("does not record abandonment when sign-in resumes the action", () => {
    authState.status = "anonymous";
    const { result, rerender } = renderHook(() => useGate(), { wrapper });
    act(() => result.current.guard(vi.fn(), "my_pokemon"));
    act(() => { authState.status = "authenticated"; rerender(); });
    expect(rec.events.map((e) => e.name)).toEqual(["sign_in_prompted"]);
  });

  it("records nothing when already signed in", () => {
    authState.status = "authenticated";
    const { result } = renderHook(() => useGate(), { wrapper });
    act(() => result.current.guard(vi.fn(), "my_pokemon"));
    expect(rec.events).toEqual([]);
  });
});
