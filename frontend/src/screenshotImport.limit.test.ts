import { afterEach, describe, expect, it } from "vitest";

import { forgetImportLimit, futureReset, rememberImportLimit } from "./screenshotImport";

describe("remembered import limit", () => {
  afterEach(forgetImportLimit);

  it("is kept while in the future and dropped by forgetImportLimit", () => {
    const later = new Date(Date.now() + 3_600_000).toISOString();
    rememberImportLimit(later);
    expect(futureReset()).toBe(later);
    forgetImportLimit();
    expect(futureReset()).toBeNull();
  });

  it("ignores a reset time already past", () => {
    rememberImportLimit(new Date(Date.now() - 1000).toISOString());
    expect(futureReset()).toBeNull();
  });
});
