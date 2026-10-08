import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useStickyData } from "./useStickyData";

function setup(keys: string[], data: (number | undefined)[]) {
  return renderHook(({ k, d }) => useStickyData(k, d), { initialProps: { k: keys, d: data } });
}

describe("useStickyData", () => {
  it("keeps an item's last data while it reloads", () => {
    const { result, rerender } = setup(["a", "b"], [1, 2]);
    rerender({ k: ["a", "b"], d: [undefined, undefined] }); // a new map: both reload
    expect(result.current).toEqual([1, 2]);
    rerender({ k: ["a", "b"], d: [10, 20] });
    expect(result.current).toEqual([10, 20]);
  });

  it("follows each item by key when the order changes", () => {
    const { result, rerender } = setup(["a", "b"], [1, 2]);
    rerender({ k: ["b", "a"], d: [undefined, undefined] });
    expect(result.current).toEqual([2, 1]);
  });

  it("has nothing for a new item, and forgets a removed one", () => {
    const { result, rerender } = setup(["a"], [1]);
    rerender({ k: ["a", "c"], d: [1, undefined] });
    expect(result.current).toEqual([1, undefined]);
    rerender({ k: ["c"], d: [undefined] });
    rerender({ k: ["c", "a"], d: [undefined, undefined] }); // "a" came back as a new card
    expect(result.current).toEqual([undefined, undefined]);
  });
});
