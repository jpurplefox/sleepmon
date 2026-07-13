import { describe, expect, it } from "vitest";

import { fdown } from "./format";

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
