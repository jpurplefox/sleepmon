import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// vi.hoisted keeps these safely reachable from the vi.mock factory below,
// which Vitest hoists above this file's own const declarations.
const { createMember, updateMember } = vi.hoisted(() => ({
  createMember: vi.fn(),
  updateMember: vi.fn(),
}));
vi.mock("./api/client", () => ({ api: { createMember, updateMember } }));

import { newEntry } from "./roster";
import type { MemberInput } from "./types";
import { useSaveToBox } from "./useSaveToBox";

const config: MemberInput = {
  species: "Pikachu",
  level: 30,
  nature: "Adamant",
  ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
  sub_skills: ["Helping Speed S"],
  ribbon: "",
  skill_level: 1,
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("useSaveToBox", () => {
  it("creates a new Box member and reports the id it got", async () => {
    createMember.mockResolvedValue({ id: "box-7" });
    const entry = newEntry(config);
    const onCreated = vi.fn();
    const { result } = renderHook(() => useSaveToBox(), { wrapper });

    act(() => result.current.save(entry, onCreated));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("box-7"));
    expect(createMember).toHaveBeenCalledWith(config);
    expect(result.current.statusOf(entry.id).state).toBe("saved");
  });

  it("updates the origin when the entry came from the Box", async () => {
    updateMember.mockResolvedValue({ id: "box-1" });
    const entry = newEntry(config, "box-1");
    const onCreated = vi.fn();
    const { result } = renderHook(() => useSaveToBox(), { wrapper });

    act(() => result.current.save(entry, onCreated));

    await waitFor(() => expect(result.current.statusOf(entry.id).state).toBe("saved"));
    expect(updateMember).toHaveBeenCalledWith("box-1", config);
    // Nothing was created, so there is no new origin to record.
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("exposes the failure message on the entry that failed", async () => {
    createMember.mockRejectedValue(new Error("La caja está llena"));
    const entry = newEntry(config);
    const { result } = renderHook(() => useSaveToBox(), { wrapper });

    act(() => result.current.save(entry));

    await waitFor(() => expect(result.current.statusOf(entry.id).state).toBe("error"));
    expect(result.current.statusOf(entry.id).error).toBe("La caja está llena");
  });

  it("reports idle for an entry that was never saved", () => {
    const { result } = renderHook(() => useSaveToBox(), { wrapper });
    expect(result.current.statusOf("never-touched").state).toBe("idle");
  });

  it("reset returns a failed entry to idle without disturbing another entry", async () => {
    createMember.mockRejectedValue(new Error("La caja está llena"));
    const failed = newEntry(config);
    const other = newEntry(config);
    const { result } = renderHook(() => useSaveToBox(), { wrapper });

    act(() => result.current.save(failed));
    await waitFor(() => expect(result.current.statusOf(failed.id).state).toBe("error"));
    act(() => result.current.save(other));
    await waitFor(() => expect(result.current.statusOf(other.id).state).toBe("error"));

    act(() => result.current.reset(failed.id));

    expect(result.current.statusOf(failed.id).state).toBe("idle");
    expect(result.current.statusOf(other.id).state).toBe("error");
  });
});
