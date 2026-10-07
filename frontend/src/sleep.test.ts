import { describe, expect, it } from "vitest";

import {
  DEFAULT_SLEEP,
  asleepMinutes,
  awakeMinutes,
  formatHm,
  formatHours,
  napBounds,
  nightBounds,
  sameSleep,
  setNap,
  stepNap,
  stepNight,
} from "./sleep";

const s = (night: number, nap: number | null = null) => ({
  night_minutes: night,
  nap_minutes: nap,
});

describe("sleep schedule", () => {
  it("defaults to 8:30 with no nap", () => {
    expect(DEFAULT_SLEEP).toEqual(s(510));
    expect(asleepMinutes(DEFAULT_SLEEP)).toBe(510);
    expect(awakeMinutes(DEFAULT_SLEEP)).toBe(930);
  });

  it("steps the night by 15 minutes within 1:30–12:00", () => {
    expect(stepNight(s(510), 1)).toEqual(s(525));
    expect(stepNight(s(90), -1)).toEqual(s(90));
    expect(stepNight(s(720), 1)).toEqual(s(720));
    expect(nightBounds(s(90))).toEqual({ atMin: true, atMax: false });
    expect(nightBounds(s(720))).toEqual({ atMin: false, atMax: true });
  });

  it("keeps night + nap within 14:00", () => {
    expect(napBounds(s(660, 180)).atMax).toBe(true); // 11:00 -> nap up to 3:00
    expect(stepNap(s(660, 180), 1)).toEqual(s(660, 180));
    expect(nightBounds(s(600, 240)).atMax).toBe(true); // nap 4:00 -> night up to 10:00
    expect(stepNight(s(600, 240), 1)).toEqual(s(600, 240));
  });

  it("steps the nap within 1:30–4:00 and does nothing without a nap", () => {
    expect(stepNap(s(390, 120), 1)).toEqual(s(390, 135));
    expect(stepNap(s(390, 90), -1)).toEqual(s(390, 90));
    expect(stepNap(s(390), 1)).toEqual(s(390));
    expect(napBounds(s(390))).toEqual({ atMin: true, atMax: true });
  });

  it("turns the nap on at 2:00 and off to null", () => {
    expect(setNap(s(390), true)).toEqual(s(390, 120));
    expect(setNap(s(720), true)).toEqual(s(720, 120)); // 14:00 total, still fits
    expect(setNap(s(390, 180), true)).toEqual(s(390, 180)); // already on: untouched
    expect(setNap(s(390, 120), false)).toEqual(s(390));
  });

  it("formats minutes and hours as h:mm", () => {
    expect(formatHm(390)).toBe("6:30");
    expect(formatHm(90)).toBe("1:30");
    expect(formatHours(1.4306)).toBe("1:26");
  });

  it("compares schedules by value", () => {
    expect(sameSleep(s(390, 120), s(390, 120))).toBe(true);
    expect(sameSleep(s(390, 120), s(390))).toBe(false);
  });
});
