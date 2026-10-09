import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import type { Catalog, SavedTeam } from "../types";
import { SavedTeamRow } from "./SavedTeams";

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

const team: SavedTeam = {
  id: "t1",
  name: "Cyan curry",
  slots: [],
  island: null,
  favorite_berries: [],
  main_favorite: null,
  weekly_bonus: "berry_strength",
  dish_type: null,
  meals: [null, null, null],
  saved_at: "2026-10-01T00:00:00Z",
};

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
});

describe("SavedTeamRow", () => {
  it("opens the team in one tap on its name", () => {
    const onOpen = vi.fn();
    render(
      <LanguageProvider>
        <ul>
          <SavedTeamRow team={team} catalog={catalog} members={new Map()} onOpen={onOpen} onDelete={() => {}} />
        </ul>
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Cyan curry in Team analysis" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    // The row itself is still named after the team.
    expect(screen.getByRole("listitem", { name: "Cyan curry" })).toBeInTheDocument();
  });
});
