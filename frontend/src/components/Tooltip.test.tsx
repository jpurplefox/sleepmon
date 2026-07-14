import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("renders the trigger and the bubble content", () => {
    render(
      <Tooltip content="Ingredient Finder">
        <span>icon</span>
      </Tooltip>,
    );
    expect(screen.getByText("icon")).toBeInTheDocument();
    expect(screen.getByText("Ingredient Finder")).toBeInTheDocument();
  });

  it("uses string content as the accessible label by default", () => {
    render(
      <Tooltip content="Dream Shard Bonus">
        <span>icon</span>
      </Tooltip>,
    );
    expect(screen.getByText("icon").closest(".tooltip")).toHaveAttribute(
      "aria-label",
      "Dream Shard Bonus",
    );
  });

  it("prefers the explicit label when the content is rich", () => {
    render(
      <Tooltip
        label="Base: 9,173 · Bonus: +6,971"
        content={
          <Tooltip.Row>
            <Tooltip.Label>Base</Tooltip.Label>
            <Tooltip.Value>9,173</Tooltip.Value>
          </Tooltip.Row>
        }
      >
        <span>16,144</span>
      </Tooltip>,
    );
    expect(screen.getByText("16,144").closest(".tooltip")).toHaveAttribute(
      "aria-label",
      "Base: 9,173 · Bonus: +6,971",
    );
    expect(document.querySelector(".tooltip__label")).toHaveTextContent("Base");
    expect(document.querySelector(".tooltip__val")).toHaveTextContent("9,173");
  });

  it("positions without error on hover and focus", () => {
    render(
      <Tooltip content="hi">
        <span>trigger</span>
      </Tooltip>,
    );
    const wrap = screen.getByText("trigger").closest(".tooltip")!;
    expect(() => {
      fireEvent.mouseEnter(wrap);
      fireEvent.focus(wrap);
    }).not.toThrow();
    expect(screen.getByText("hi")).toBeInTheDocument();
  });
});
