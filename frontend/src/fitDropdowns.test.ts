import { afterEach, describe, expect, it, vi } from "vitest";

import { fitDropdown, fitDropdownsIn, MIN_LIST_HEIGHT } from "./fitDropdowns";

function rect(top: number, bottom: number): DOMRect {
  return { top, bottom, height: bottom - top, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) };
}

// A modal body (visible down to `bodyBottom`) holding an absolute pop whose list
// spans `listTop`..`listBottom`, with 8px of pop padding below the list.
function setup(bodyBottom: number, listTop: number, listBottom: number) {
  const body = document.createElement("div");
  const pop = document.createElement("div");
  pop.style.position = "absolute";
  const list = document.createElement("div");
  list.className = "filter-list";
  pop.append(list);
  vi.spyOn(body, "getBoundingClientRect").mockReturnValue(rect(0, bodyBottom));
  vi.spyOn(pop, "getBoundingClientRect").mockReturnValue(rect(listTop - 8, listBottom + 8));
  vi.spyOn(list, "getBoundingClientRect").mockReturnValue(rect(listTop, listBottom));
  pop.scrollIntoView = vi.fn();
  document.body.append(body);
  return { body, pop, list };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("fitDropdown", () => {
  it("leaves a list that fits the body's visible room alone", () => {
    const { body, pop, list } = setup(500, 100, 300);
    body.append(pop);
    fitDropdown(list, body);
    expect(list.style.maxHeight).toBe("");
  });

  it("shrinks a list that would overflow to the room left below it", () => {
    const { body, pop, list } = setup(400, 100, 388);
    body.append(pop);
    fitDropdown(list, body);
    // 400 - 8 gap - 8 pop padding - 100 top
    expect(list.style.maxHeight).toBe("284px");
    expect(pop.scrollIntoView).not.toHaveBeenCalled();
  });

  it("keeps a usable height near the bottom and brings the list into view", () => {
    const { body, pop, list } = setup(400, 350, 638);
    body.append(pop);
    fitDropdown(list, body);
    expect(list.style.maxHeight).toBe(`${MIN_LIST_HEIGHT}px`);
    expect(pop.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("ignores a list that isn't inside a dropdown", () => {
    const { body, list } = setup(100, 50, 400);
    body.append(list);
    fitDropdown(list, body);
    expect(list.style.maxHeight).toBe("");
  });
});

describe("fitDropdownsIn", () => {
  it("fits a dropdown as it opens in the body, until cleaned up", async () => {
    const { body, pop, list } = setup(400, 100, 388);
    const stop = fitDropdownsIn(body);
    body.append(pop);
    await Promise.resolve();
    expect(list.style.maxHeight).toBe("284px");
    stop();
  });
});
