import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const authState = { status: "anonymous" as "anonymous" | "authenticated" };
vi.mock("./AuthContext", () => ({ useAuth: () => authState }));

import { GateProvider, useGate } from "./useGate"; // GateProvider re-exported for tests

const wrapper = ({ children }: { children: React.ReactNode }) => <GateProvider>{children}</GateProvider>;

describe("useGate", () => {
  it("runs the action immediately when authenticated", () => {
    authState.status = "authenticated";
    const { result } = renderHook(() => useGate(), { wrapper });
    const action = vi.fn();
    act(() => result.current.guard(action));
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.dialogOpen).toBe(false);
  });

  it("defers the action and opens the dialog when anonymous, then resumes on auth", () => {
    authState.status = "anonymous";
    const { result, rerender } = renderHook(() => useGate(), { wrapper });
    const action = vi.fn();
    act(() => result.current.guard(action));
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
