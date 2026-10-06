import { describe, expect, it } from "vitest";

import { fdown, fup } from "./format";

describe("fdown", () => {
  it("floors instead of rounding", () => {
    expect(fdown(4.999)).toBe("4");
    expect(fdown(0.1)).toBe("0");
  });

  it("adds en-US thousands separators", () => {
    expect(fdown(1234)).toBe("1,234");
    expect(fdown(1234567.8)).toBe("1,234,567");
  });

  it("leaves whole numbers and zero untouched", () => {
    expect(fdown(0)).toBe("0");
    expect(fdown(42)).toBe("42");
  });
});

describe("fup", () => {
  it("rounds any fraction up", () => {
    expect(fup(0.64)).toBe("1");
    expect(fup(4.001)).toBe("5");
  });

  it("leaves whole numbers untouched and adds separators", () => {
    expect(fup(0)).toBe("0");
    expect(fup(1234)).toBe("1,234");
  });
});
