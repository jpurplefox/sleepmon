import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IconBackpack, IconStopwatch } from "./icons";

describe("filled metric icons", () => {
  it("give each instance its own mask, so several on one card don't share one", () => {
    const { container } = render(
      <>
        <IconStopwatch />
        <IconStopwatch />
        <IconBackpack />
      </>,
    );
    const masks = [...container.querySelectorAll("mask")].map((m) => m.id);
    expect(masks).toHaveLength(3);
    expect(new Set(masks).size).toBe(3);
    for (const id of masks) {
      expect(container.querySelector(`[mask="url(#${id})"]`)).not.toBeNull();
    }
  });
});
