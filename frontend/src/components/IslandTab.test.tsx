import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import type { Catalog, Island, Species } from "../types";
import { IslandTab } from "./IslandTab";

const pikachu: Species = {
  name: "Pikachu",
  dex: 25,
  specialty: "Berries",
  berry: "Grepa",
  type: "Electric",
  sleep_type: "Dozing",
  main_skill: "Charge Strength S",
  ingredient_slots: [["Fancy Apple"], ["Warming Ginger"], ["Fancy Apple", "Warming Ginger"]],
  ingredient_amounts: [[1], [2], [5, 8]],
  base_inventory: 20,
};

const oranMon: Species = { ...pikachu, name: "Squirtle", dex: 7, berry: "Oran" };
const pechaMon: Species = { ...pikachu, name: "Clefairy", dex: 35, berry: "Pecha" };

const cyanBeach: Island = {
  name: "Cyan Beach",
  favorite_berries: ["Oran", "Pamtre", "Pecha"],
  user_picks: false,
  expert: false,
  ratings: [],
  expert_speed: null,
};

const cyanBeachExpert: Island = {
  name: "Cyan Beach (Expert)",
  favorite_berries: [],
  user_picks: true,
  expert: true,
  ratings: [],
  expert_speed: { main: 0.8, penalty: 1.35 },
};

const catalog = {
  natures: [],
  sub_skills: [],
  ingredients: [],
  species: [pikachu, oranMon, pechaMon],
  recipe_level_bonus: [],
  ingredient_strengths: {},
  islands: [cyanBeach, cyanBeachExpert],
} as unknown as Catalog;

function renderTab(overrides: Partial<React.ComponentProps<typeof IslandTab>> = {}) {
  const props = {
    catalog,
    selectedIsland: null,
    favoriteBerries: [],
    mainFavorite: null,
    weeklyBonus: "berry_strength" as const,
    islandBonus: 0,
    bonusDisabled: false,
    bonusUnsaved: false,
    savedBonusPct: 0,
    onSelectIsland: vi.fn(),
    onFavoriteBerries: vi.fn(),
    onMainFavorite: vi.fn(),
    onWeeklyBonus: vi.fn(),
    onIslandBonus: vi.fn(),
    onSaveBonus: vi.fn(),
    ...overrides,
  };
  render(
    <LanguageProvider>
      <IslandTab {...props} />
    </LanguageProvider>,
  );
  return props;
}

beforeEach(() => {
  // Force English so accessible-name selectors below are stable.
  localStorage.setItem("sleepmon.lang", "en");
});

describe("IslandTab weekly bonus", () => {
  it("hides the weekly bonus row on a normal map", () => {
    renderTab({ selectedIsland: "Cyan Beach", favoriteBerries: ["Oran"] });
    expect(screen.queryByText("Weekly bonus")).not.toBeInTheDocument();
  });

  it("shows it on an expert map with berry strength active by default", () => {
    renderTab({ selectedIsland: "Cyan Beach (Expert)" });
    expect(screen.getByText("Weekly bonus")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Berries ×2.4" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("reports the chosen weekly bonus", async () => {
    const props = renderTab({ selectedIsland: "Cyan Beach (Expert)" });
    await userEvent.click(screen.getByRole("button", { name: "+1 ingredient" }));
    expect(props.onWeeklyBonus).toHaveBeenCalledWith("ingredient");
  });
});

describe("IslandTab bonus slider", () => {
  // No hint text is rendered anymore (it read oddly with the slider already
  // showing disabled) — the disabled state alone communicates "pick a map".
  it("disables the slider with no island selected and renders no hint text", () => {
    renderTab({ selectedIsland: null, bonusDisabled: true });
    expect(screen.getByLabelText("Area bonus")).toBeDisabled();
    expect(screen.queryByText("pick a map")).not.toBeInTheDocument();
  });

  it("leaves the slider enabled once a map is picked", () => {
    renderTab({ selectedIsland: "Cyan Beach", favoriteBerries: ["Oran"], bonusDisabled: false });
    expect(screen.getByLabelText("Area bonus")).not.toBeDisabled();
  });
});

describe("IslandTab favorite berries", () => {
  it("shows every berry chip, all disabled, with no map selected", () => {
    renderTab({ selectedIsland: null });
    const chips = screen.getAllByRole("button", { name: /Grepa|Oran|Pecha/ });
    expect(chips).toHaveLength(3);
    for (const chip of chips) {
      expect(chip).toBeDisabled();
      expect(chip).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.queryByText(/\/ 3/)).not.toBeInTheDocument();
  });
});

describe("IslandTab main favorite", () => {
  it("reports the first berry chosen as the main favorite", async () => {
    const props = renderTab({ selectedIsland: "Cyan Beach (Expert)", favoriteBerries: [] });
    await userEvent.click(screen.getByRole("button", { name: /Oran/ }));
    expect(props.onFavoriteBerries).toHaveBeenCalledWith(["Oran"]);
    expect(props.onMainFavorite).toHaveBeenCalledWith("Oran");
  });

  it("leaves the main's slot open when it is removed, keeping the subs in place", async () => {
    const props = renderTab({
      selectedIsland: "Cyan Beach (Expert)",
      favoriteBerries: ["Oran", "Pecha"],
      mainFavorite: "Oran",
    });
    await userEvent.click(screen.getByRole("button", { name: "Primary berry" }));
    expect(props.onFavoriteBerries).toHaveBeenCalledWith(["", "Pecha"]);
    expect(props.onMainFavorite).toHaveBeenCalledWith(null);
  });

  it("leaves a sub's slot open too, so the third doesn't move up", async () => {
    const props = renderTab({
      selectedIsland: "Cyan Beach (Expert)",
      favoriteBerries: ["Oran", "Pecha", "Grepa"],
      mainFavorite: "Oran",
    });
    const pecha = screen.getAllByRole("button", { name: "Secondary berry" }).find((b) => b.textContent?.includes("Pecha"))!;
    await userEvent.click(pecha);
    expect(props.onFavoriteBerries).toHaveBeenCalledWith(["Oran", "", "Grepa"]);
    expect(props.onMainFavorite).toHaveBeenCalledWith("Oran");
  });
});
