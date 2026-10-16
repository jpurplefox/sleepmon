import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { useSeedShortcut } from "./useSeedShortcut";

// The form's sub skills state plus the hook, as MemberForm wires them.
function setup(initial: string[]) {
  return renderHook(() => {
    const [subSkills, setSubSkills] = useState(initial);
    return { subSkills, seed: useSeedShortcut(subSkills, setSubSkills) };
  });
}

const BEFORE = ["Inventory Up S", "Inventory Up M", "Skill Trigger S"];
const AFTER = ["Inventory Up L", "Inventory Up M", "Skill Trigger M"];

describe("useSeedShortcut", () => {
  it("offers to apply, counting the sub skills it would raise", () => {
    const { result } = setup(BEFORE);
    expect(result.current.seed.mode).toBe("apply");
    expect(result.current.seed.seeds).toBe(2);
    expect(result.current.seed.highlight).toBeNull();
  });

  it("applies, then offers undo and highlights the changed slots", () => {
    const { result } = setup(BEFORE);
    act(() => result.current.seed.act());
    expect(result.current.subSkills).toEqual(AFTER);
    expect(result.current.seed.mode).toBe("undo");
    expect(result.current.seed.highlight).toEqual({ slots: [0, 2], key: 1 });
  });

  it("undoes back to the sub skills before seeding, highlighting them again", () => {
    const { result } = setup(BEFORE);
    act(() => result.current.seed.act());
    act(() => result.current.seed.act());
    expect(result.current.subSkills).toEqual(BEFORE);
    expect(result.current.seed.mode).toBe("apply");
    expect(result.current.seed.highlight).toEqual({ slots: [0, 2], key: 2 });
  });

  it("drops the undo and the highlight on a hand edit", () => {
    const { result } = setup(BEFORE);
    act(() => result.current.seed.act());
    act(() => result.current.seed.onManualChange(["Inventory Up L", "Inventory Up M", ""]));
    expect(result.current.subSkills).toEqual(["Inventory Up L", "Inventory Up M", ""]);
    expect(result.current.seed.mode).toBe("none");
    expect(result.current.seed.highlight).toBeNull();
  });

  it("has nothing to do when everything is at its top free tier", () => {
    const { result } = setup(AFTER);
    expect(result.current.seed.mode).toBe("none");
    act(() => result.current.seed.act());
    expect(result.current.subSkills).toEqual(AFTER);
    expect(result.current.seed.highlight).toBeNull();
  });
});
