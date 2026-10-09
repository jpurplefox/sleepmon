import { describe, expect, it } from "vitest";

import { SPECIALTIES, matchesSpecialty } from "./specialties";

describe("matchesSpecialty", () => {
  it("matches everything without a filter", () => {
    expect(matchesSpecialty("Berries", "")).toBe(true);
  });

  it("matches only the filtered specialty", () => {
    expect(matchesSpecialty("Skills", "Skills")).toBe(true);
    expect(matchesSpecialty("Berries", "Skills")).toBe(false);
  });

  it("counts mythicals (All) as every specialty", () => {
    for (const sp of SPECIALTIES) expect(matchesSpecialty("All", sp)).toBe(true);
  });
});
