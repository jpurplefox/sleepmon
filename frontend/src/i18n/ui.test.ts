import { describe, expect, it } from "vitest";

import { UI } from "./ui";

describe("UI", () => {
  it("has the same keys in es and en", () => {
    const esKeys = new Set(Object.keys(UI.es));
    const enKeys = new Set(Object.keys(UI.en));

    const missingInEn = [...esKeys].filter((k) => !enKeys.has(k));
    const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));

    expect(missingInEn).toEqual([]);
    expect(missingInEs).toEqual([]);
  });
});
