import { describe, expect, it } from "vitest";

import { pickedFavorites, slotOne, slotsWithMainFirst, toggleFavoriteSlot } from "./favoriteSlots";

const pick = (...berries: string[]) => berries.reduce<string[]>(toggleFavoriteSlot, []);

describe("favoriteSlots", () => {
  it("fills slots in pick order and caps at three", () => {
    expect(pick("Belue", "Durin", "Leppa")).toEqual(["Belue", "Durin", "Leppa"]);
    expect(toggleFavoriteSlot(pick("Belue", "Durin", "Leppa"), "Oran")).toEqual(["Belue", "Durin", "Leppa"]);
  });

  it("leaves any removed berry's slot open, the first one included", () => {
    expect(toggleFavoriteSlot(pick("Belue", "Durin", "Leppa"), "Belue")).toEqual(["", "Durin", "Leppa"]);
    expect(toggleFavoriteSlot(pick("Belue", "Durin", "Leppa"), "Durin")).toEqual(["Belue", "", "Leppa"]);
  });

  it("fills the first open slot with the next pick", () => {
    const opened = toggleFavoriteSlot(toggleFavoriteSlot(pick("Belue", "Durin", "Leppa"), "Durin"), "Belue");
    expect(opened).toEqual(["", "", "Leppa"]);
    expect(toggleFavoriteSlot(opened, "Oran")).toEqual(["Oran", "", "Leppa"]);
  });

  it("drops open slots at the end", () => {
    expect(toggleFavoriteSlot(pick("Belue", "Durin", "Leppa"), "Leppa")).toEqual(["Belue", "Durin"]);
    expect(toggleFavoriteSlot(["", "Durin"], "Durin")).toEqual([]);
  });

  it("reads slot 1 and the picked berries", () => {
    expect(slotOne(["", "Durin"])).toBeNull();
    expect(slotOne(["Belue"])).toBe("Belue");
    expect(pickedFavorites(["", "Durin", "Leppa"])).toEqual(["Durin", "Leppa"]);
  });

  it("puts a saved main in slot 1", () => {
    expect(slotsWithMainFirst(["Belue", "Durin", "Leppa"], "Durin")).toEqual(["Durin", "Belue", "Leppa"]);
    expect(slotsWithMainFirst(["Belue", "Durin"], null)).toEqual(["Belue", "Durin"]);
  });
});
