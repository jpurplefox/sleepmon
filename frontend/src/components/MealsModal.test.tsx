import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";

import { LanguageProvider } from "../i18n";
import type { Catalog, Recipe } from "../types";
import { MealsModal } from "./MealsModal";

beforeEach(() => {
  // Force English so the copy asserted below is stable.
  localStorage.setItem("sleepmon.lang", "en");
});

const catalog: Catalog = {
  natures: [],
  sub_skills: [],
  ingredients: [],
  species: [],
  recipe_level_bonus: [],
  ingredient_strengths: {},
  islands: [],
  pot_ladder: [],
};

// Merges `overrides` over a complete default props object built from
// MealsModal's real Props, then renders it.
function renderModal(overrides: Partial<React.ComponentProps<typeof MealsModal>> = {}) {
  const props: React.ComponentProps<typeof MealsModal> = {
    recipes: [],
    levelBonus: [],
    catalog,
    meals: [null, null, null],
    onChangeMeals: vi.fn(),
    onClose: vi.fn(),
    potSize: 21,
    onPotSizeChange: vi.fn(),
    effectivePot: 21,
    skillPerMeal: 0,
    potMultiplied: false,
    dishType: null,
    onDishTypeChange: vi.fn(),
    levelFor: () => 1,
    onRecipeLevelChange: vi.fn(),
    potUnsaved: false,
    savedPotSize: 21,
    onSavePot: vi.fn(),
    levelUnsaved: () => false,
    savedLevelFor: () => 1,
    onSaveLevel: vi.fn(),
    ...overrides,
  };

  render(
    <LanguageProvider>
      <MealsModal {...props} />
    </LanguageProvider>,
  );
  return props;
}

describe("MealsModal — the unsaved mark", () => {
  it("marks a pot that differs from what is saved", () => {
    renderModal({ potSize: 36, savedPotSize: 33, potUnsaved: true });
    expect(screen.getByText("unsaved")).toBeInTheDocument();
  });

  it("marks nothing when the pot matches what is saved", () => {
    renderModal({ potSize: 33, savedPotSize: 33, potUnsaved: false });
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
  });

  it("saves the shown value", async () => {
    const onSavePot = vi.fn();
    renderModal({ potSize: 36, savedPotSize: 33, potUnsaved: true, onSavePot });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSavePot).toHaveBeenCalledOnce();
  });

  // The mark hangs under the pot control instead of sharing the toolbar's line: the
  // search box there is the only item that flexes, so a mark beside it took its width
  // out of the search and slid everything after it — the stepper included, ~141px,
  // mid-click. Far enough that a second click on "+" landed on Guardar and saved by
  // accident. Structure carries half of that (the block is a column, so the mark
  // never widens it); styles.css carries the rest (the mark is out of the flow).
  it("anchors the pot mark to the stepper", () => {
    renderModal({ potSize: 36, savedPotSize: 33, potUnsaved: true });
    const mark = screen.getByText("unsaved").closest(".tooltip");
    // Inside the stepper is what makes it hang under the buttons rather than under
    // the label — it is positioned against this box. Being *out of flow* is the
    // other half, and that half lives in styles.css where jsdom cannot see it.
    expect(mark?.parentElement).toHaveClass("meal-picker-pot__stepper");
  });
});

describe("MealsModal — the effective pot", () => {
  it("shows the ticket-boosted effective pot it is given", async () => {
    renderModal({ potSize: 21, effectivePot: 35, potMultiplied: true });
    expect(screen.getByText("= 35")).toBeInTheDocument();
  });

  it("uses the = form when the pot is multiplied, ticket or not", async () => {
    renderModal({ potSize: 21, effectivePot: 62, skillPerMeal: 1, potMultiplied: true });
    expect(screen.getByText("= 62")).toBeInTheDocument();
    expect(screen.queryByText(/\+1/)).not.toBeInTheDocument();
  });

  it("shows the skill share next to the effective pot", async () => {
    renderModal({ potSize: 21, effectivePot: 28, skillPerMeal: 7 });
    expect(screen.getByText(/\+7/)).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
  });

  it("shows a dash and no fit marks while the pot is unknown", async () => {
    const recipe: Recipe = {
      name: "Beanburger Curry",
      type: "Curry",
      ingredients: [{ ingredient: "Bean Sausage", count: 5 }],
      base_strength: 100,
    };
    renderModal({
      effectivePot: null,
      skillPerMeal: null,
      recipes: [recipe],
      levelBonus: [1],
    });
    expect(screen.getByText("= —")).toBeInTheDocument();
    expect(screen.queryByText(/Fits/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Doesn't fit/)).not.toBeInTheDocument();
  });
});

describe("MealsModal — the recipe level mark", () => {
  const beanburger: Recipe = {
    name: "Beanburger Curry",
    type: "Curry",
    ingredients: [],
    base_strength: 100,
  };

  it("marks a recipe level that differs from what is saved, and saves it", async () => {
    const onSaveLevel = vi.fn();
    renderModal({
      recipes: [beanburger],
      levelBonus: [1],
      levelFor: () => 10,
      savedLevelFor: () => 5,
      levelUnsaved: () => true,
      onSaveLevel,
    });
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveLevel).toHaveBeenCalledWith("Beanburger Curry");
  });
});

describe("MealsModal — the pot control walks the ladder", () => {
  const LADDER = [21, 23, 25, 27, 29, 31, 33, 36];

  it("steps to the previous ladder rung instead of an arbitrary value", async () => {
    const onPotSizeChange = vi.fn();
    renderModal({
      catalog: { ...catalog, pot_ladder: LADDER },
      potSize: 33,
      savedPotSize: 33,
      onPotSizeChange,
    });
    await userEvent.click(screen.getByLabelText("−"));
    // The backend only accepts ladder rungs (validate_pot_size); 32 would be rejected.
    expect(onPotSizeChange).toHaveBeenCalledWith(31);
    expect(onPotSizeChange).not.toHaveBeenCalledWith(32);
    // Pot input is not typeable: only stepped via the ladder.
    expect(screen.getByLabelText("Pot size")).toHaveAttribute("readOnly");
  });

  it("disables the down button at the bottom rung", () => {
    renderModal({ catalog: { ...catalog, pot_ladder: LADDER }, potSize: 21, savedPotSize: 21 });
    expect(screen.getByLabelText("−")).toBeDisabled();
  });
});

describe("MealsModal — surfacing a failed save", () => {
  it("shows an alert inside the modal when a save has failed", () => {
    renderModal({ saveError: true });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save the change.");
  });

  it("shows nothing when there is no error", () => {
    renderModal({ saveError: false });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("MealsModal — shows the active dish type", () => {
  // The type is picked in the context bar, but the grid still filters by it,
  // so the dialog must still say which type is active.
  it("shows the chosen type's name", () => {
    renderModal({ dishType: "Salad" });
    expect(screen.getByText(/Dish type:/)).toHaveTextContent("Dish type: Salad");
  });

  // No "all" state exists anymore (PRD 0006) — unset renders the same
  // "None" placeholder Player progress uses for an unset favorite.
  it("shows the type as not chosen while it is unset", () => {
    renderModal({ dishType: null });
    expect(screen.getByText(/Dish type:/)).toHaveTextContent("Dish type: Not chosen");
  });
});

describe("MealsModal — Limpiar clears only the meals", () => {
  it("clears the meals and leaves the dish type set", async () => {
    const onChangeMeals = vi.fn();
    const onDishTypeChange = vi.fn();
    renderModal({
      meals: [{ recipe: "Beanburger Curry", level: 10 }, null, null],
      dishType: "Curry",
      onChangeMeals,
      onDishTypeChange,
    });
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChangeMeals).toHaveBeenCalledWith([null, null, null]);
    expect(onDishTypeChange).not.toHaveBeenCalled();
  });
});

describe("MealsModal — closing keeps session values, no question asked", () => {
  it("closes immediately when nothing is unsaved", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  // PRD 0011: unlike Player progress's draft, these are session values the
  // user is analysing with — closing keeps them, nothing to confirm.
  it("closes immediately with a value marked unsaved, fires no save, and leaves it untouched", async () => {
    const onClose = vi.fn();
    const onSavePot = vi.fn();
    const onSaveLevel = vi.fn();
    const onPotSizeChange = vi.fn();
    renderModal({
      potSize: 36,
      potUnsaved: true,
      onClose,
      onSavePot,
      onSaveLevel,
      onPotSizeChange,
    });

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    // No question rendered — closes right away.
    expect(screen.queryByText(/stay in the session/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leave without saving" })).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledOnce();
    // No PATCH-triggering save fired for either unsaved kind.
    expect(onSavePot).not.toHaveBeenCalled();
    expect(onSaveLevel).not.toHaveBeenCalled();
    // The session value itself was never touched (no revert either).
    expect(onPotSizeChange).not.toHaveBeenCalled();
  });
});


describe("MealsModal — the first recipe on an empty plan", () => {
  const beanburger: Recipe = {
    name: "Beanburger Curry",
    type: "Curry",
    ingredients: [],
    base_strength: 100,
  };

  it("locks in the dish type when no type is chosen yet", async () => {
    const onDishTypeChange = vi.fn();
    const onChangeMeals = vi.fn();
    renderModal({ recipes: [beanburger], levelBonus: [1], onDishTypeChange, onChangeMeals });
    await userEvent.click(screen.getByTitle("Midday"));
    expect(onChangeMeals).toHaveBeenCalledWith([
      null,
      { recipe: "Beanburger Curry", level: 1 },
      null,
    ]);
    expect(onDishTypeChange).toHaveBeenCalledWith("Curry");
  });
});
