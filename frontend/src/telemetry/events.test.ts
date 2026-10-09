import { describe, expect, expectTypeOf, it } from "vitest";

import { EVENT_NAMES, type AnalyticsEvent } from "./events";

describe("event catalogue", () => {
  it("lists every event name exactly once", () => {
    // Compile-time: the runtime list and the closed type stay in sync both ways.
    expectTypeOf<(typeof EVENT_NAMES)[number]>().toEqualTypeOf<AnalyticsEvent["name"]>();
    expect(new Set(EVENT_NAMES).size).toBe(EVENT_NAMES.length);
  });
});
