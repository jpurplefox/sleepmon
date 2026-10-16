import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import { ComparisonLevelField } from "./ComparisonLevelField";

beforeEach(() => localStorage.setItem("sleepmon.lang", "en"));

function renderField(value: Parameters<typeof ComparisonLevelField>[0]["value"]) {
  const onChange = vi.fn();
  render(
    <LanguageProvider>
      <ComparisonLevelField value={value} onChange={onChange} />
    </LanguageProvider>,
  );
  return onChange;
}

describe("ComparisonLevelField", () => {
  it("offers off and the six unlock levels, in order", () => {
    renderField(null);
    const group = screen.getByRole("radiogroup", { name: "Compare at level" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("aria-label"))).toEqual([
      "No comparison level", "Level 10", "Level 25", "Level 30", "Level 50", "Level 60", "Level 70",
    ]);
    expect(screen.getByRole("radio", { name: "No comparison level" })).toHaveAttribute("aria-checked", "true");
  });

  it("sets a level and turns it off", async () => {
    const onChange = renderField(60);
    expect(screen.getByRole("radio", { name: "Level 60" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("radio", { name: "Level 30" }));
    await userEvent.click(screen.getByRole("radio", { name: "No comparison level" }));
    expect(onChange.mock.calls).toEqual([[30], [null]]);
  });

  it("does nothing when the active chip is tapped again", async () => {
    const onChange = renderField(60);
    await userEvent.click(screen.getByRole("radio", { name: "Level 60" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves between chips with the arrow keys", async () => {
    const onChange = renderField(60);
    screen.getByRole("radio", { name: "Level 60" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith(70);
  });
});
