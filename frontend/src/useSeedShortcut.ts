import { useState } from "react";

import { changedSlots, seedSubSkills } from "./subskills";

export type SeedMode = "apply" | "undo" | "none";

export interface SlotHighlight {
  slots: number[];
  /** Bumped on every apply/undo so the highlight replays. */
  key: number;
}

export interface SeedShortcut {
  mode: SeedMode;
  /** Seeds the next apply would spend. */
  seeds: number;
  act: () => void;
  /** For hand edits: sets the sub skills and drops the undo. */
  onManualChange: (next: string[]) => void;
  highlight: SlotHighlight | null;
}

// The form's seed shortcut: apply, then undo until the user edits by hand (PRD 0003).
export function useSeedShortcut(
  subSkills: string[],
  setSubSkills: (next: string[]) => void,
): SeedShortcut {
  const [undo, setUndo] = useState<string[] | null>(null);
  const [highlight, setHighlight] = useState<SlotHighlight | null>(null);
  const seed = seedSubSkills(subSkills);
  const mode: SeedMode = undo ? "undo" : seed.seeds > 0 ? "apply" : "none";

  const show = (next: string[]) =>
    setHighlight((h) => ({ slots: changedSlots(subSkills, next), key: (h?.key ?? 0) + 1 }));

  const act = () => {
    if (mode === "apply") {
      setUndo(subSkills);
      setSubSkills(seed.slots);
      show(seed.slots);
    } else if (mode === "undo" && undo) {
      setSubSkills(undo);
      show(undo);
      setUndo(null);
    }
  };

  const onManualChange = (next: string[]) => {
    setSubSkills(next);
    setUndo(null);
    setHighlight(null);
  };

  return { mode, seeds: seed.seeds, act, onManualChange, highlight };
}
