import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// "Unsaved" means "differs from what is saved", which only exists with a session.
// Signed in by default here; the anonymous case has its own test at the bottom.
const authState = vi.hoisted(() => ({ status: "authenticated" as "anonymous" | "authenticated" }));
vi.mock("./auth/AuthContext", () => ({ useAuth: () => authState }));

import { useSessionOverrides } from "./useSessionOverrides";
import type { PlayerProgress } from "./types";

beforeEach(() => {
  authState.status = "authenticated";
});

const saved: PlayerProgress = {
  pot_size: 33,
  recipe_levels: { "Beanburger Curry": 55 },
  favorite_recipes: {},
  area_bonuses: { "Cyan Beach": 42, "Taupe Hollow": 10 },
};

const EMPTY: PlayerProgress = {
  pot_size: 21,
  recipe_levels: {},
  favorite_recipes: {},
  area_bonuses: {},
};

describe("useSessionOverrides", () => {
  it("reads the saved pot size and the saved bonus for the selected island with no overrides", () => {
    const { result } = renderHook(() =>
      useSessionOverrides(saved, "Cyan Beach"),
    );
    expect(result.current.potSize).toBe(33);
    expect(result.current.areaBonusPct).toBe(42);
  });

  it("reads the defaults with nothing saved and no override", () => {
    const { result } = renderHook(() =>
      useSessionOverrides(EMPTY, "Cyan Beach"),
    );
    expect(result.current.potSize).toBe(21);
    expect(result.current.areaBonusPct).toBe(0);
    expect(result.current.recipeLevelFor("Beanburger Curry")).toBe(1);
  });

  it("lets a pot override win over the saved value, and clearing it falls back again", () => {
    const { result } = renderHook(() =>
      useSessionOverrides(saved, "Cyan Beach"),
    );
    act(() => result.current.setPotOverride(36));
    expect(result.current.potSize).toBe(36);
    act(() => result.current.setPotOverride(undefined));
    expect(result.current.potSize).toBe(33);
  });

  it("keys the bonus override to the currently selected island — it must not leak onto another", () => {
    const { result, rerender } = renderHook(
      ({ island }: { island: string | null }) =>
        useSessionOverrides(saved, island),
      { initialProps: { island: "Cyan Beach" } },
    );
    act(() => result.current.setAreaBonusOverride(70));
    expect(result.current.areaBonusPct).toBe(70);

    rerender({ island: "Taupe Hollow" });
    // Island B reads its OWN saved value, not the override set while A was selected.
    expect(result.current.areaBonusPct).toBe(10);

    rerender({ island: "Cyan Beach" });
    // Switching back to A shows the override is still there, untouched.
    expect(result.current.areaBonusPct).toBe(70);
  });

  it("is 0 with no island selected, regardless of what is saved or overridden", () => {
    const { result, rerender } = renderHook(
      ({ island }: { island: string | null }) =>
        useSessionOverrides(saved, island),
      { initialProps: { island: "Cyan Beach" as string | null } },
    );
    act(() => result.current.setAreaBonusOverride(70));
    rerender({ island: null });
    expect(result.current.areaBonusPct).toBe(0);
  });

  it("does not set an override when no island is selected", () => {
    const { result, rerender } = renderHook(
      ({ island }: { island: string | null }) =>
        useSessionOverrides(saved, island),
      { initialProps: { island: null as string | null } },
    );
    act(() => result.current.setAreaBonusOverride(70));
    rerender({ island: "Cyan Beach" });
    // The call with no island selected was a no-op — Cyan Beach still reads its saved value.
    expect(result.current.areaBonusPct).toBe(42);
  });

  it("lets a recipe level override win, leaving an untouched recipe at the default", () => {
    const { result } = renderHook(() =>
      useSessionOverrides(saved, "Cyan Beach"),
    );
    act(() => result.current.setRecipeLevelOverride("Beanburger Curry", 60));
    expect(result.current.recipeLevelFor("Beanburger Curry")).toBe(60);
    expect(result.current.recipeLevelFor("Fancy Apple Curry")).toBe(1);
  });

  it("marks the pot unsaved once overridden, and clears the mark when put back to what is saved", () => {
    const { result } = renderHook(() =>
      useSessionOverrides(saved, "Cyan Beach"),
    );
    expect(result.current.potUnsaved).toBe(false);
    act(() => result.current.setPotOverride(36));
    expect(result.current.potUnsaved).toBe(true);
    act(() => result.current.setPotOverride(33));
    expect(result.current.potUnsaved).toBe(false);
  });

  it("marks the area bonus unsaved once overridden, and clears the mark when put back to what is saved", () => {
    const { result } = renderHook(() =>
      useSessionOverrides(saved, "Cyan Beach"),
    );
    expect(result.current.areaBonusUnsaved).toBe(false);
    act(() => result.current.setAreaBonusOverride(70));
    expect(result.current.areaBonusUnsaved).toBe(true);
    act(() => result.current.setAreaBonusOverride(42));
    expect(result.current.areaBonusUnsaved).toBe(false);
  });

  it("is never unsaved for the area bonus with no island selected, regardless of overrides", () => {
    const { result, rerender } = renderHook(
      ({ island }: { island: string | null }) =>
        useSessionOverrides(saved, island),
      { initialProps: { island: "Cyan Beach" as string | null } },
    );
    act(() => result.current.setAreaBonusOverride(70));
    rerender({ island: null });
    expect(result.current.areaBonusUnsaved).toBe(false);
  });

  it("marks a recipe level unsaved once overridden, and clears the mark when put back to what is saved", () => {
    const { result } = renderHook(() =>
      useSessionOverrides(saved, "Cyan Beach"),
    );
    expect(result.current.recipeLevelUnsaved("Beanburger Curry")).toBe(false);
    act(() => result.current.setRecipeLevelOverride("Beanburger Curry", 60));
    expect(result.current.recipeLevelUnsaved("Beanburger Curry")).toBe(true);
    act(() => result.current.setRecipeLevelOverride("Beanburger Curry", 55));
    expect(result.current.recipeLevelUnsaved("Beanburger Curry")).toBe(false);
    // An untouched recipe is never marked.
    expect(result.current.recipeLevelUnsaved("Fancy Apple Curry")).toBe(false);
  });



  it("reflects a changed saved progress for un-overridden values, but not for overridden ones", () => {
    const { result, rerender } = renderHook(
      ({ progress }: { progress: PlayerProgress }) =>
        useSessionOverrides(progress, "Cyan Beach"),
      { initialProps: { progress: EMPTY } },
    );
    act(() => result.current.setPotOverride(50));
    expect(result.current.potSize).toBe(50);
    expect(result.current.areaBonusPct).toBe(0);

    // The query resolves mid-session with real saved data.
    rerender({ progress: saved });
    expect(result.current.potSize).toBe(50); // overridden — untouched
    expect(result.current.areaBonusPct).toBe(42); // un-overridden — now reflects the saved value
  });
  it("marks nothing as unsaved with no session, but still serves the values", () => {
    // Team Analysis is open to anonymous users, and Player progress is reserved.
    // Offering "Guardar" there would send a request that can only 401.
    authState.status = "anonymous";
    const { result } = renderHook(() => useSessionOverrides(EMPTY, "Cyan Beach"));

    act(() => result.current.setPotOverride(50));
    act(() => result.current.setAreaBonusOverride(53));
    act(() => result.current.setRecipeLevelOverride("Beanburger Curry", 30));

    // The values are session inputs and keep working.
    expect(result.current.potSize).toBe(50);
    expect(result.current.areaBonusPct).toBe(53);
    expect(result.current.recipeLevelFor("Beanburger Curry")).toBe(30);

    // But none of them offers to save.
    expect(result.current.potUnsaved).toBe(false);
    expect(result.current.areaBonusUnsaved).toBe(false);
    expect(result.current.recipeLevelUnsaved("Beanburger Curry")).toBe(false);
  });
});
