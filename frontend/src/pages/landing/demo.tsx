// Shared pieces of the landing's animated demos: the capture marks, a pointer, and placement.
import { useSyncExternalStore, type CSSProperties } from "react";

import type { Lang } from "../../i18n";
import shotMarks from "./shotMarks.json";

/** A box as % of its capture (written by scripts/landing-shots.mjs). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** A Box entry's level-up cell, and each gain row in the card it opens. */
export interface LevelupMark {
  cell: Rect;
  rows: Rect[];
}
export interface Marks {
  evolve: Rect;
  pick: Rect;
  maps: { options: Rect[]; target: number };
  baseStrength: Rect;
  rivalStrength: Rect;
  shareCopy: Rect;
  levelup: LevelupMark[];
  planMaps: { options: Rect[]; target: number };
  planCooking: { recipes: Rect[]; strength: Rect; missing: Rect };
  planWeek: { berries: Rect; cooking: Rect; grand: Rect; weekly: Rect; rating: Rect };
}
export const MARKS = shotMarks as Record<Lang, Marks>;

const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia?.(REDUCE);
  mq?.addEventListener?.("change", onChange);
  return () => mq?.removeEventListener?.("change", onChange);
}
/** Reduced-motion preference; false on the server and during hydration, so both render the same first frame. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia?.(REDUCE).matches ?? false, () => false);
}

export const box = (r: Rect): CSSProperties => ({ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` });
// Where a pointer rests on a box: right of center, like a hand reaching for a label.
export const aim = (r: Rect): CSSProperties => ({ left: `${r.x + r.w * 0.7}%`, top: `${r.y + r.h * 0.6}%` });

export function Pointer({ style, clicking, gone }: { style: CSSProperties; clicking: boolean; gone?: boolean }) {
  return (
    <span className={"landing-pointer" + (clicking ? " is-clicking" : "") + (gone ? " is-gone" : "")} style={style} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M5 3l14 8-6.5 1.5L10 19z" />
      </svg>
    </span>
  );
}
