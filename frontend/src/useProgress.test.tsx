import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getProgress = vi.hoisted(() => vi.fn());
const patchProgress = vi.hoisted(() => vi.fn());
vi.mock("./api/client", () => ({ api: { getProgress, patchProgress } }));

const authState = vi.hoisted(() => ({ status: "anonymous" as "anonymous" | "authenticated" }));
vi.mock("./auth/AuthContext", () => ({ useAuth: () => authState }));

import { EMPTY_PROGRESS } from "./progress";
import { useProgress } from "./useProgress";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("useProgress", () => {
  it("does not read the Box-backed progress while anonymous", async () => {
    // /progress is reserved. Team Analysis mounts this hook without a session, so a
    // read here would be a guaranteed 401 on a page whose whole point is needing no
    // account.
    authState.status = "anonymous";
    getProgress.mockResolvedValue({ ...EMPTY_PROGRESS, pot_size: 36 });

    const { result } = renderHook(() => useProgress(), { wrapper });

    expect(getProgress).not.toHaveBeenCalled();
    // With nothing fetched it reads as a brand-new account would.
    expect(result.current.progress).toEqual(EMPTY_PROGRESS);
  });

  it("reads it once signed in", async () => {
    authState.status = "authenticated";
    getProgress.mockResolvedValue({ ...EMPTY_PROGRESS, pot_size: 36 });

    const { result } = renderHook(() => useProgress(), { wrapper });

    await waitFor(() => expect(result.current.progress.pot_size).toBe(36));
    expect(getProgress).toHaveBeenCalled();
  });

  it("calls onSaved once the save succeeds", async () => {
    authState.status = "anonymous";
    patchProgress.mockResolvedValue({ ...EMPTY_PROGRESS, pot_size: 40 });
    const onSaved = vi.fn();
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => result.current.save({ pot_size: 40 }, onSaved));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("does not call onSaved when the save fails", async () => {
    authState.status = "anonymous";
    patchProgress.mockRejectedValue(new Error("boom"));
    const onSaved = vi.fn();
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => result.current.save({ pot_size: 40 }, onSaved));

    await waitFor(() => expect(result.current.saveError).not.toBeNull());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("calls each save's onSaved, not only the latest one's", async () => {
    authState.status = "anonymous";
    patchProgress.mockResolvedValue({ ...EMPTY_PROGRESS, pot_size: 40 });
    const first = vi.fn();
    const second = vi.fn();
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.save({ pot_size: 40 }, first);
      result.current.save({ area_bonuses: { Greengrass: 10 } }, second);
    });

    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
    expect(first).toHaveBeenCalledTimes(1);
  });
});
