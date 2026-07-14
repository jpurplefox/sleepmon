import { describe, expect, it } from "vitest";

import { resolveRating } from "./snorlaxRating";
import type { Rating } from "./types";

const ratings: Rating[] = [
  { tier: "basic", level: 1, required_strength: 0 },
  { tier: "basic", level: 2, required_strength: 100 },
  { tier: "great", level: 1, required_strength: 500 },
];

describe("resolveRating", () => {
  it("returns null when there are no ratings", () => {
    expect(resolveRating(1000, [])).toBeNull();
  });

  it("reports the reached tier, the next one and the strength remaining", () => {
    const result = resolveRating(50, ratings);
    expect(result).toEqual({
      reached: ratings[0],
      next: ratings[1],
      remaining: 50,
    });
  });

  it("treats meeting a threshold exactly as reached", () => {
    const result = resolveRating(100, ratings);
    expect(result?.reached).toBe(ratings[1]);
    expect(result?.next).toBe(ratings[2]);
    expect(result?.remaining).toBe(400);
  });

  it("has no next and zero remaining at the top", () => {
    const result = resolveRating(600, ratings);
    expect(result?.reached).toBe(ratings[2]);
    expect(result?.next).toBeNull();
    expect(result?.remaining).toBe(0);
  });
});
