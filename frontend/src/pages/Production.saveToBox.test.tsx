// Regression test for the identity-vs-index race in Production.tsx's
// saveToBox: it must write the new sourceId back onto the entry that was
// actually saved, even if Comparison's drag-to-reorder changed the array
// while the create request was in flight.
//
// A full render of <Production> needs catalog/members queries, auth and gate
// context, and per-card production queries — none of which are relevant to
// this race. Instead this test reproduces the exact write-back shape used by
// Production.tsx's saveToBox (entries state + useSaveToBox's onCreated
// callback) in a minimal hook, against the real useSaveToBox with a mocked
// api, so the race is exercised at the level where entry identity matters.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

const { createMember, updateMember } = vi.hoisted(() => ({
  createMember: vi.fn(),
  updateMember: vi.fn(),
}));
vi.mock("../api/client", () => ({ api: { createMember, updateMember } }));

import { newEntry, type RosterEntry } from "../roster";
import type { MemberInput } from "../types";
import { useSaveToBox } from "../useSaveToBox";

const config: MemberInput = {
  species: "Pikachu",
  level: 30,
  nature: "Adamant",
  ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
  sub_skills: ["Helping Speed S"],
  ribbon: "",
  skill_level: 1,
};

// Mirrors Production.tsx's saveToBox exactly: match the write-back by the
// entry's own stable id, not by the index captured at click time.
function useComparisonEntries(initial: RosterEntry[]) {
  const [entries, setEntries] = useState<RosterEntry[]>(initial);
  const { save } = useSaveToBox();

  const saveToBox = (i: number) => {
    const entry = entries[i];
    save(entry, (memberId) =>
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, sourceId: memberId } : e)),
      ),
    );
  };

  return { entries, setEntries, saveToBox };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("Comparison saveToBox write-back", () => {
  it("tags the entry that was actually saved, not whichever one is now at that slot", async () => {
    let resolveCreate!: (member: { id: string }) => void;
    createMember.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
    );

    const a = newEntry(config);
    const b = newEntry(config);
    const { result } = renderHook(() => useComparisonEntries([a, b]), { wrapper });

    // Click "save" on `a`, sitting at index 0.
    act(() => result.current.saveToBox(0));

    // While the request is in flight, the user drags cards and swaps the
    // order: `b` now sits at index 0, where `a` used to be.
    act(() => result.current.setEntries((prev) => [prev[1], prev[0]]));

    // The create request resolves after the reorder.
    act(() => resolveCreate({ id: "box-9" }));

    await waitFor(() =>
      expect(result.current.entries.find((e) => e.id === a.id)?.sourceId).toBe("box-9"),
    );
    // `b` was never saved and must not inherit `a`'s new Box identity.
    expect(result.current.entries.find((e) => e.id === b.id)?.sourceId).toBeUndefined();
  });
});
