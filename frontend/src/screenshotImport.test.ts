import { describe, expect, it } from "vitest";

import { checkFile, MAX_FILE_BYTES, toImportedForm, unreadAfterChange } from "./screenshotImport";
import type { MemberInput, ScreenshotImport, Species } from "./types";

const pikachu: Species = {
  name: "Pikachu", dex: 25, specialty: "Berries", berry: "Grepa", type: "Electric",
  sleep_type: "Dozing", main_skill: "Charge Strength S",
  ingredient_slots: [["Fancy Apple"], ["Fancy Apple", "Warming Ginger"], ["Fancy Apple", "Warming Ginger", "Fancy Egg"]],
  ingredient_amounts: [[1], [2, 2], [4, 3, 3]], base_inventory: 17, evolutions: [], previous_stage: null,
};

const read: ScreenshotImport = {
  species: "Pikachu", level: 25, nature: null, ingredients: ["Fancy Apple", null, null],
  sub_skills: ["Helping Bonus"], skill_level: 3, ribbon: null, versatile_skill: null,
  unread: ["nature", "ingredients", "ribbon"],
};

describe("checkFile", () => {
  it("accepts PNG, JPEG and WebP up to 5 MB", () => {
    expect(checkFile({ type: "image/png", size: 10 })).toBeNull();
    expect(checkFile({ type: "image/jpeg", size: MAX_FILE_BYTES })).toBeNull();
    expect(checkFile({ type: "image/webp", size: 1 })).toBeNull();
  });
  it("flags other formats and bigger files", () => {
    expect(checkFile({ type: "image/gif", size: 10 })).toBe("format");
    expect(checkFile({ type: "image/png", size: MAX_FILE_BYTES + 1 })).toBe("size");
  });
});

describe("toImportedForm", () => {
  it("fills unread fields with the create defaults", () => {
    const form = toImportedForm(read, pikachu, 2);
    expect(form.values).toEqual({
      species: "Pikachu", level: 25, nature: "", ingredients: ["Fancy Apple", "Fancy Apple", "Fancy Apple"],
      sub_skills: ["Helping Bonus"], ribbon: "", skill_level: 3,
    });
    expect(form.unread).toEqual(["nature", "ingredients", "ribbon"]);
    expect(form.images).toBe(2);
  });
  it("keeps Mew's skill when read", () => {
    const form = toImportedForm({ ...read, versatile_skill: "Metronome" }, pikachu, 1);
    expect(form.values.versatile_skill).toBe("Metronome");
  });
});

describe("unreadAfterChange", () => {
  const before: MemberInput = toImportedForm(read, pikachu, 2).values;
  it("drops the mark of the field that changed", () => {
    expect(unreadAfterChange(["nature", "ribbon"], before, { ...before, nature: "Jolly" })).toEqual(["ribbon"]);
  });
  it("treats any ingredient slot as the ingredients field", () => {
    const after = { ...before, ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Apple"] };
    expect(unreadAfterChange(["ingredients"], before, after)).toEqual([]);
  });
  it("keeps marks when nothing they cover changed", () => {
    expect(unreadAfterChange(["nature"], before, { ...before, level: 30 })).toEqual(["nature"]);
  });
});
