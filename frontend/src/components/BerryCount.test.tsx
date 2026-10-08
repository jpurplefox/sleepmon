import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BerryCount } from "./BerryCount";

describe("BerryCount", () => {
  it("fills one segment per picked berry and reports the progress", () => {
    const { container } = render(<BerryCount slots={["Oran", "Pecha"]} max={3} label="Favorite berries" />);
    const bar = screen.getByRole("progressbar", { name: "Favorite berries" });
    expect(bar).toHaveAttribute("aria-valuenow", "2");
    expect(bar).toHaveAttribute("aria-valuetext", "2 / 3");
    expect(bar).toHaveAttribute("aria-valuemax", "3");
    expect(container.querySelectorAll(".berry-count__seg.is-filled")).toHaveLength(2);
    expect(container.querySelectorAll(".berry-count__seg")).toHaveLength(3);
    // The bar is the count: no figures repeat it.
    expect(screen.queryByText("2 / 3")).toBeNull();
    expect(container.firstChild).not.toHaveClass("berry-count--full");
  });

  it("marks itself full once every berry is picked", () => {
    const { container } = render(<BerryCount slots={["Oran", "Pecha", "Grepa"]} max={3} label="Favorite berries" />);
    expect(container.firstChild).toHaveClass("berry-count--full");
  });

  it("leaves an open slot's segment empty where it is", () => {
    const { container } = render(<BerryCount slots={["Oran", "", "Grepa"]} max={3} label="Favorite berries" />);
    const segs = [...container.querySelectorAll(".berry-count__seg")];
    expect(segs.map((s) => s.classList.contains("is-filled"))).toEqual([true, false, true]);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  });
});
