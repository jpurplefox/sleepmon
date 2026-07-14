import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import type { Catalog, MemberInput, Species } from "../types";
import { MemberForm } from "./MemberForm";

const pikachu: Species = {
  name: "Pikachu",
  dex: 25,
  specialty: "Berries",
  berry: "Grepa Berry",
  type: "Electric",
  sleep_type: "Dozing",
  main_skill: "Charge Strength S",
  ingredient_slots: [["Fancy Apple"], ["Warming Ginger"], ["Fancy Apple", "Warming Ginger"]],
  ingredient_amounts: [[1], [2], [5, 8]],
  base_inventory: 20,
};

const bulbasaur: Species = {
  name: "Bulbasaur",
  dex: 1,
  specialty: "Ingredients",
  berry: "Durin Berry",
  type: "Grass",
  sleep_type: "Snoozing",
  main_skill: "Ingredient Magnet S",
  ingredient_slots: [["Honey"], ["Snoozy Tomato"], ["Honey", "Soft Potato"]],
  ingredient_amounts: [[1], [2], [5, 8]],
  base_inventory: 20,
};

const catalog: Catalog = {
  natures: [{ name: "Bashful", neutral: true, increased: null, decreased: null }],
  sub_skills: [{ name: "Helping Speed M", tier: "Blue" }],
  ingredients: ["Fancy Apple", "Warming Ginger", "Honey", "Snoozy Tomato", "Soft Potato"],
  species: [pikachu, bulbasaur],
  recipe_level_bonus: [1.0],
  ingredient_strengths: { "Fancy Apple": 90 },
  islands: [],
};

function renderForm(props: Partial<React.ComponentProps<typeof MemberForm>> = {}) {
  const onSubmit = vi.fn();
  render(
    <LanguageProvider>
      <MemberForm
        catalog={catalog}
        onSubmit={onSubmit}
        pending={false}
        error={null}
        {...props}
      />
    </LanguageProvider>,
  );
  return { onSubmit };
}

async function pickSpecies(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole("button", { name: "Species" }));
  await user.click(screen.getByRole("option", { name }));
}

beforeEach(() => {
  // Force English so accessible-name selectors below are stable.
  localStorage.setItem("sleepmon.lang", "en");
});

describe("MemberForm (catalogue-driven)", () => {
  it("blocks the submit until a species is chosen", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByRole("button", { name: "Add to team" })).toBeDisabled();

    await pickSpecies(user, /Pikachu/);

    expect(screen.getByRole("button", { name: "Add to team" })).toBeEnabled();
  });

  it("defaults each ingredient slot to the chosen species' first option", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await pickSpecies(user, /Pikachu/);
    await user.click(screen.getByRole("button", { name: "Add to team" }));

    expect(onSubmit).toHaveBeenCalledWith({
      species: "Pikachu",
      level: 30,
      nature: "",
      ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Apple"],
      sub_skills: [],
      ribbon: "",
      skill_level: 1,
    });
  });

  it("derives the slot defaults from the species, not a fixed set", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await pickSpecies(user, /Bulbasaur/);
    await user.click(screen.getByRole("button", { name: "Add to team" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        species: "Bulbasaur",
        ingredients: ["Honey", "Snoozy Tomato", "Honey"],
      }),
    );
  });

  it("keeps the existing kit when editing instead of resetting to defaults", async () => {
    const user = userEvent.setup();
    const initial: MemberInput = {
      species: "Pikachu",
      level: 42,
      nature: "Bashful",
      ingredients: ["Warming Ginger", "Fancy Apple", "Warming Ginger"],
      sub_skills: ["Helping Speed M"],
      ribbon: "",
      skill_level: 3,
    };
    const { onSubmit } = renderForm({ initial });

    await user.click(screen.getByRole("button", { name: "Add to team" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        species: "Pikachu",
        ingredients: ["Warming Ginger", "Fancy Apple", "Warming Ginger"],
      }),
    );
  });

  it("flags an unknown species and blocks the submit", () => {
    const initial: MemberInput = {
      species: "Missingno",
      level: 30,
      nature: "",
      ingredients: [],
      sub_skills: [],
      ribbon: "",
      skill_level: 1,
    };
    renderForm({ initial });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to team" })).toBeDisabled();
  });
});
