import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { LanguageProvider } from "../i18n";
import type { Catalog, PlayerProgress, Recipe } from "../types";
import { ProgressModal } from "./ProgressModal";

const LADDER = [21, 23, 25, 27, 29, 31, 33, 36];

// `Recipe` is { name, type, ingredients: IngredientCount[], base_strength } — all four.
const recipes: Recipe[] = [
  {
    name: "Beanburger Curry",
    type: "Curry",
    ingredients: [{ ingredient: "Bean Sausage", count: 7 }],
    base_strength: 856,
  },
  {
    name: "Snoozy Tomato Salad",
    type: "Salad",
    ingredients: [{ ingredient: "Snoozy Tomato", count: 8 }],
    base_strength: 1045,
  },
];

// A complete `Catalog`, so the test never needs a type cast: fields the test
// doesn't care about get empty defaults, and `overrides` fills in the rest.
function makeCatalog(overrides: Partial<Catalog> = {}): Catalog {
  return {
    natures: [],
    sub_skills: [],
    ingredients: [],
    species: [],
    recipe_level_bonus: [],
    ingredient_strengths: {},
    islands: [],
    pot_ladder: [],
    ...overrides,
  };
}

function makeProgress(overrides: Partial<PlayerProgress> = {}): PlayerProgress {
  return {
    pot_size: 33,
    recipe_levels: {},
    favorite_recipes: {},
    area_bonuses: {},
    ...overrides,
  };
}

function renderModal() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <ProgressModal onClose={() => {}} />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
  vi.spyOn(api, "getProgress").mockResolvedValue(makeProgress());
  vi.spyOn(api, "getRecipes").mockResolvedValue(recipes);
  vi.spyOn(api, "getCatalog").mockResolvedValue(makeCatalog({ pot_ladder: LADDER }));
  vi.spyOn(api, "patchProgress").mockImplementation(async (patch) =>
    makeProgress(patch as Partial<PlayerProgress>),
  );
});

describe("ProgressModal", () => {
  it("shows the saved pot size", async () => {
    renderModal();
    expect(await screen.findByText("33 ingredients")).toBeInTheDocument();
  });

  it("saves the next ladder step when the pot is raised", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("button", { name: "Bigger pot" }));
    // TanStack Query v5 calls mutationFn with a second (internal) context argument.
    await waitFor(() =>
      expect(api.patchProgress).toHaveBeenCalledWith({ pot_size: 36 }, expect.anything()),
    );
  });

  it("disables the up button at the top of the ladder", async () => {
    vi.spyOn(api, "getProgress").mockResolvedValue(makeProgress({ pot_size: 36 }));
    renderModal();
    await screen.findByText("36 ingredients");
    expect(screen.getByRole("button", { name: "Bigger pot" })).toBeDisabled();
  });

  it("switches tabs", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    expect(screen.getByRole("tab", { name: "Areas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("33 ingredients")).not.toBeInTheDocument();
  });

  it("shows a type with no favorite as None", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    expect(screen.getAllByText("None").length).toBeGreaterThan(0);
  });
});
