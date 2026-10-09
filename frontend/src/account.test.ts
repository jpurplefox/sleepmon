import { describe, expect, it } from "vitest";
import { accountSummary, emailMatches, isDefaultProgress } from "./account";
import { readContactEmail } from "./contact";
import { EMPTY_PROGRESS } from "./progress";
import type { Member, SavedTeam } from "./types";

describe("emailMatches", () => {
  it("ignores case and surrounding whitespace", () => {
    expect(emailMatches("Ana@Example.com ", "ana@example.com")).toBe(true);
  });
  it("rejects a different address", () => {
    expect(emailMatches("ana@example.co", "ana@example.com")).toBe(false);
  });
  it("rejects an empty entry", () => {
    expect(emailMatches("", "ana@example.com")).toBe(false);
    expect(emailMatches("  ", "  ")).toBe(false);
  });
});

describe("isDefaultProgress", () => {
  it("is true for the empty progress", () => {
    expect(isDefaultProgress(EMPTY_PROGRESS)).toBe(true);
    expect(isDefaultProgress(structuredClone(EMPTY_PROGRESS))).toBe(true);
  });
  it("is false once anything differs", () => {
    expect(isDefaultProgress({ ...EMPTY_PROGRESS, pot_size: 30 })).toBe(false);
    expect(isDefaultProgress({ ...EMPTY_PROGRESS, recipe_levels: { curry: 5 } })).toBe(false);
  });
});

describe("accountSummary", () => {
  it("counts the box, the saved teams and whether a profile exists", () => {
    const members = [{}, {}, {}] as unknown as Member[];
    const teams = [{}, {}] as unknown as SavedTeam[];
    expect(accountSummary(members, teams, EMPTY_PROGRESS)).toEqual({
      boxSize: 3,
      savedTeams: 2,
      hasProfile: false,
    });
    expect(accountSummary(members, teams, { ...EMPTY_PROGRESS, pot_size: 30 }).hasProfile).toBe(true);
  });
});

describe("readContactEmail", () => {
  it("is null when unset or empty", () => {
    expect(readContactEmail({})).toBeNull();
    expect(readContactEmail({ VITE_CONTACT_EMAIL: "" })).toBeNull();
  });
  it("returns the configured address", () => {
    expect(readContactEmail({ VITE_CONTACT_EMAIL: "a@b.c" })).toBe("a@b.c");
  });
});
