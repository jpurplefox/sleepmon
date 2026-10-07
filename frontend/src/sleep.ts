// Sleep schedule helpers (PRD 0015). The backend validates the same limits.
import type { SleepSchedule } from "./types";

export const SLEEP = {
  step: 15,
  min: 90,
  maxNight: 720,
  maxNap: 240,
  maxTotal: 840,
  defaultNight: 510,
  defaultNap: 120,
} as const;

export const DEFAULT_SLEEP: SleepSchedule = {
  night_minutes: SLEEP.defaultNight,
  nap_minutes: null,
};

const napOf = (s: SleepSchedule): number => s.nap_minutes ?? 0;
const nightMax = (s: SleepSchedule): number => Math.min(SLEEP.maxNight, SLEEP.maxTotal - napOf(s));
const napMax = (s: SleepSchedule): number => Math.min(SLEEP.maxNap, SLEEP.maxTotal - s.night_minutes);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function nightBounds(s: SleepSchedule): { atMin: boolean; atMax: boolean } {
  return { atMin: s.night_minutes <= SLEEP.min, atMax: s.night_minutes >= nightMax(s) };
}

/** With no nap there is nothing to step: both ends read as reached. */
export function napBounds(s: SleepSchedule): { atMin: boolean; atMax: boolean } {
  if (s.nap_minutes === null) return { atMin: true, atMax: true };
  return { atMin: s.nap_minutes <= SLEEP.min, atMax: s.nap_minutes >= napMax(s) };
}

export function stepNight(s: SleepSchedule, dir: 1 | -1): SleepSchedule {
  const next = clamp(s.night_minutes + dir * SLEEP.step, SLEEP.min, nightMax(s));
  return { ...s, night_minutes: next };
}

export function stepNap(s: SleepSchedule, dir: 1 | -1): SleepSchedule {
  if (s.nap_minutes === null) return s;
  return { ...s, nap_minutes: clamp(s.nap_minutes + dir * SLEEP.step, SLEEP.min, napMax(s)) };
}

/** On starts at 2:00 (or the room left under 14:00); off drops the nap entirely. */
export function setNap(s: SleepSchedule, on: boolean): SleepSchedule {
  if (!on) return { ...s, nap_minutes: null };
  if (s.nap_minutes !== null) return s;
  return { ...s, nap_minutes: Math.min(SLEEP.defaultNap, napMax(s)) };
}

export const asleepMinutes = (s: SleepSchedule): number => s.night_minutes + napOf(s);
export const awakeMinutes = (s: SleepSchedule): number => 24 * 60 - asleepMinutes(s);

export function formatHm(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Hours as h:mm, rounded to the minute. */
export const formatHours = (hours: number): string => formatHm(Math.round(hours * 60));

export const sameSleep = (a: SleepSchedule, b: SleepSchedule): boolean =>
  a.night_minutes === b.night_minutes && a.nap_minutes === b.nap_minutes;
