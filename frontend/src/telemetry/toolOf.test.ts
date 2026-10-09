import { describe, expect, it } from "vitest";

import { toolOf } from "./toolOf";

describe("toolOf", () => {
  it.each([
    ["/compare", "compare"],
    ["/team-analysis", "team_analysis"],
    ["/box", "box"],
    ["/teams", "teams"],
  ])("%s → %s", (path, tool) => expect(toolOf(path)).toBe(tool));

  it.each(["/", "/nope", ""])("%j is not a tool", (path) => expect(toolOf(path)).toBeNull());
});
