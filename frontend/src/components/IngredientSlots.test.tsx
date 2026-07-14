import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import type { Species } from "../types";
import { IngredientSlots } from "./IngredientSlots";

const species: Species = {
  name: "Test",
  dex: 1,
  specialty: "Ingredients",
  berry: "Oran",
  type: "Grass",
  sleep_type: "Snoozing",
  main_skill: "Ingredient Magnet S",
  // Slot 2 carries a unique ingredient so it is unambiguous to target.
  ingredient_slots: [["Fancy Apple"], ["Warming Ginger"], ["Honey", "Soft Potato"]],
  ingredient_amounts: [[1], [2], [5, 8]],
  base_inventory: 20,
};

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
});

function renderSlots(value: string[]) {
  const onChange = vi.fn();
  render(
    <LanguageProvider>
      <IngredientSlots species={species} level={60} value={value} onChange={onChange} />
    </LanguageProvider>,
  );
  return { onChange };
}

describe("IngredientSlots", () => {
  it("marks the current pick in each slot as pressed", () => {
    renderSlots(["Fancy Apple", "Warming Ginger", "Honey"]);
    expect(screen.getByRole("button", { name: "Honey", pressed: true })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Soft Potato", pressed: false }),
    ).toBeInTheDocument();
  });

  it("changes only the clicked slot and preserves the others", async () => {
    const user = userEvent.setup();
    const { onChange } = renderSlots(["Fancy Apple", "Warming Ginger", "Honey"]);

    await user.click(screen.getByRole("button", { name: "Soft Potato" }));

    expect(onChange).toHaveBeenCalledWith(["Fancy Apple", "Warming Ginger", "Soft Potato"]);
  });
});
