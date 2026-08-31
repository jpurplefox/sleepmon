import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";

import { LanguageProvider } from "../i18n";
import type { Catalog, Recipe } from "../types";
import { SettingsModal } from "./SettingsModal";

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
// SettingsModal's real Props, renders it, then opens the Meals tab — the
// dish-type buttons and the pot stepper live there, and the modal defaults to
// the Map (island) tab.
function renderModal(overrides: Partial<React.ComponentProps<typeof SettingsModal>> = {}) {
  const props: React.ComponentProps<typeof SettingsModal> = {
    recipes: [],
    levelBonus: [],
    meals: [null, null, null],
    onChangeMeals: vi.fn(),
    onClose: vi.fn(),
    potSize: 21,
    onPotSizeChange: vi.fn(),
    cookingExtra: 0,
    catalog,
    selectedIsland: null,
    favoriteBerries: [],
    islandBonus: 0,
    bonusDisabled: true,
    goodCampTicket: false,
    mainFavorite: null,
    weeklyBonus: "berry_strength",
    onSelectIsland: vi.fn(),
    onFavoriteBerries: vi.fn(),
    onIslandBonus: vi.fn(),
    onGoodCampTicket: vi.fn(),
    onMainFavorite: vi.fn(),
    onWeeklyBonus: vi.fn(),
    dishType: null,
    onDishTypeChange: vi.fn(),
    levelFor: () => 1,
    onRecipeLevelChange: vi.fn(),
    potUnsaved: false,
    savedPotSize: 21,
    onSavePot: vi.fn(),
    bonusUnsaved: false,
    savedBonusPct: 0,
    onSaveBonus: vi.fn(),
    levelUnsaved: () => false,
    savedLevelFor: () => 1,
    onSaveLevel: vi.fn(),
    favoriteFor: () => null,
    unsavedRecipeNames: [],
    ...overrides,
  };

  render(
    <LanguageProvider>
      <SettingsModal {...props} />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("tab", { name: "Meals" }));

  return props;
}

describe("SettingsModal — the unsaved mark", () => {
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
});

describe("SettingsModal — the area bonus mark", () => {
  it("marks a bonus that differs from what is saved, and saves it", async () => {
    const onSaveBonus = vi.fn();
    renderModal({ bonusUnsaved: true, savedBonusPct: 40, onSaveBonus });
    // The bonus lives on the Map tab.
    await userEvent.click(screen.getByRole("tab", { name: "Map" }));
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveBonus).toHaveBeenCalledOnce();
  });
});

describe("SettingsModal — the recipe level mark", () => {
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

describe("SettingsModal — the pot control walks the ladder", () => {
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

describe("SettingsModal — surfacing a failed save", () => {
  it("shows an alert inside the modal when a save has failed", () => {
    renderModal({ saveError: true });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save the change.");
  });

  it("shows nothing when there is no error", () => {
    renderModal({ saveError: false });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("SettingsModal — the favorite prefill", () => {
  it("fills the three meals from the favorite of the chosen type", async () => {
    const onChangeMeals = vi.fn();
    renderModal({
      meals: [null, null, null],
      favoriteFor: () => "Beanburger Curry",
      levelFor: () => 55,
      onChangeMeals,
    });
    await userEvent.click(screen.getByRole("button", { name: "Curry" }));
    expect(onChangeMeals).toHaveBeenCalledWith([
      { recipe: "Beanburger Curry", level: 55 },
      { recipe: "Beanburger Curry", level: 55 },
      { recipe: "Beanburger Curry", level: 55 },
    ]);
  });

  it("changes nothing when a meal is already planned", async () => {
    const onChangeMeals = vi.fn();
    renderModal({
      meals: [{ recipe: "Fancy Apple Curry", level: 1 }, null, null],
      favoriteFor: () => "Beanburger Curry",
      onChangeMeals,
    });
    await userEvent.click(screen.getByRole("button", { name: "Curry" }));
    expect(onChangeMeals).not.toHaveBeenCalled();
  });

  it("leaves the meals empty when the type has no favorite", async () => {
    const onChangeMeals = vi.fn();
    renderModal({ meals: [null, null, null], favoriteFor: () => null, onChangeMeals });
    await userEvent.click(screen.getByRole("button", { name: "Curry" }));
    expect(onChangeMeals).not.toHaveBeenCalled();
  });
});

describe("SettingsModal — leaving with unsaved session values", () => {
  it("closes immediately when nothing is unsaved", async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("asks before closing when a value is unsaved", async () => {
    const onClose = vi.fn();
    renderModal({ potUnsaved: true, onClose });
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    // The copy must say the session values are kept — the opposite of Player
    // progress's "salir sin guardar", which discards the draft.
    expect(screen.getByText(/stay in the session/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancelar keeps the modal open, asking nothing further", async () => {
    const onClose = vi.fn();
    renderModal({ bonusUnsaved: true, onClose });
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText(/stay in the session/i)).not.toBeInTheDocument();
  });

  it("salir sin guardar closes without reverting the value or saving it", async () => {
    const onClose = vi.fn();
    const onSavePot = vi.fn();
    const onSaveBonus = vi.fn();
    const onSaveLevel = vi.fn();
    renderModal({ potUnsaved: true, onClose, onSavePot, onSaveBonus, onSaveLevel });

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave without saving" }));

    expect(onClose).toHaveBeenCalledOnce();
    // Nothing was written — the session value the user was analysing with is
    // untouched, only the write into Player progress was declined.
    expect(onSavePot).not.toHaveBeenCalled();
    expect(onSaveBonus).not.toHaveBeenCalled();
    expect(onSaveLevel).not.toHaveBeenCalled();
  });

  it("guardar saves every unsaved value — pot, bonus, and every changed recipe level — then closes", async () => {
    const onClose = vi.fn();
    const onSavePot = vi.fn();
    const onSaveBonus = vi.fn();
    const onSaveLevel = vi.fn();
    renderModal({
      potUnsaved: true,
      bonusUnsaved: true,
      unsavedRecipeNames: ["Beanburger Curry", "Fancy Apple Curry"],
      onClose,
      onSavePot,
      onSaveBonus,
      onSaveLevel,
    });

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSavePot).toHaveBeenCalledOnce();
    expect(onSaveBonus).toHaveBeenCalledOnce();
    expect(onSaveLevel).toHaveBeenCalledWith("Beanburger Curry");
    expect(onSaveLevel).toHaveBeenCalledWith("Fancy Apple Curry");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
