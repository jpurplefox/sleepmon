import { describe, expect, it } from "vitest";

import { TYPE_IDS, typeIcon } from "./typeIcons";

describe("typeIcon", () => {
  it("maps all 18 types to PokeAPI ids", () => {
    expect(Object.keys(TYPE_IDS)).toHaveLength(18);
    expect(new Set(Object.values(TYPE_IDS)).size).toBe(18);
  });
  it("builds the Scarlet/Violet small icon URL", () => {
    expect(typeIcon("Psychic")).toBe(
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-ix/scarlet-violet/small/14.png",
    );
  });
});
