import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";

import { LanguageProvider } from "../i18n";
import type { Catalog } from "../types";
import { MapModal } from "./MapModal";

beforeEach(() => {
  // Force English so the copy asserted below is stable.
  localStorage.setItem("sleepmon.lang", "en");
});

const catalog = {
  natures: [],
  sub_skills: [],
  ingredients: [],
  species: [],
  recipe_level_bonus: [],
  ingredient_strengths: {},
  islands: [],
  pot_ladder: [],
} as unknown as Catalog;

function renderModal(overrides: Partial<React.ComponentProps<typeof MapModal>> = {}) {
  const props: React.ComponentProps<typeof MapModal> = {
    catalog,
    selectedIsland: null,
    favoriteBerries: [],
    islandBonus: 0,
    bonusDisabled: true,
    mainFavorite: null,
    weeklyBonus: "berry_strength",
    onSelectIsland: vi.fn(),
    onFavoriteBerries: vi.fn(),
    onIslandBonus: vi.fn(),
    onMainFavorite: vi.fn(),
    onWeeklyBonus: vi.fn(),
    bonusUnsaved: false,
    savedBonusPct: 0,
    onSaveBonus: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(
    <LanguageProvider>
      <MapModal {...props} />
    </LanguageProvider>,
  );
  return props;
}

describe("MapModal — the area bonus mark", () => {
  it("marks a bonus that differs from what is saved, and saves it", async () => {
    const onSaveBonus = vi.fn();
    renderModal({ bonusUnsaved: true, savedBonusPct: 40, onSaveBonus });
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveBonus).toHaveBeenCalledOnce();
  });

  it("shows the failed-save alert", () => {
    renderModal({ saveError: true });
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save the change.");
  });
});
