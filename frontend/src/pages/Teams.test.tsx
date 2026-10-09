import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { ComparisonSessionProvider } from "../comparisonSession";
import { LanguageProvider } from "../i18n";
import { TeamSessionProvider } from "../teamSession";
import { recordEvents } from "../telemetry/testing";
import type { Catalog, Member, Species } from "../types";

const pikachuForm = vi.hoisted(() => ({
  species: "Pikachu", level: 30, nature: "", ingredients: ["Fancy Apple", "Fancy Apple", "Fancy Apple"],
  sub_skills: [], ribbon: "", skill_level: 1,
}));
vi.mock("../components/MemberForm", () => ({
  MemberForm: ({ onSubmit }: { onSubmit: (c: unknown) => void }) => (
    <button type="button" onClick={() => onSubmit(pikachuForm)}>submit-form</button>
  ),
}));
// The real bar and dialog are covered by their own tests; here they only open,
// change and close the meals dialog.
vi.mock("../components/TeamContextBar", () => ({
  TeamContextBar: ({ onOpenDialog }: { onOpenDialog: (d: "meals") => void }) => (
    <button type="button" onClick={() => onOpenDialog("meals")}>open-meals</button>
  ),
}));
vi.mock("../components/MealsModal", () => ({
  MealsModal: ({ onChangeMeals, onClose }: { onChangeMeals: (m: unknown[]) => void; onClose: () => void }) => (
    <div>
      <button type="button" onClick={() => onChangeMeals([{ recipe: "Fancy Apple Curry", level: 1 }, null, null])}>
        pick-meal
      </button>
      <button type="button" onClick={onClose}>close-meals</button>
    </div>
  ),
}));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ status: "authenticated" }) }));
vi.mock("../auth/useGate", () => ({ useGate: () => ({ guard: (f: () => void) => f() }) }));

import { Teams } from "./Teams";

const species: Species = {
  name: "Raichu",
  dex: 26,
  specialty: "Berries",
  berry: "Grepa Berry",
  type: "Electric",
  sleep_type: "Dozing",
  main_skill: "Charge Strength S",
  ingredient_slots: [["Fancy Apple"], ["Fancy Apple"], ["Fancy Apple"]],
  ingredient_amounts: [[1], [2], [3]],
  base_inventory: 20,
} as unknown as Species;

const catalog = {
  natures: [],
  sub_skills: [],
  ingredients: ["Fancy Apple"],
  species: [species, { ...species, name: "Pikachu", dex: 25 }],
  recipe_level_bonus: [1],
  ingredient_strengths: {},
  islands: [],
  pot_ladder: [],
} as unknown as Catalog;

const raichu = {
  id: "m-raichu",
  species: "Raichu",
  level: 30,
  nature: "",
  ingredients: ["Fancy Apple", "Fancy Apple", "Fancy Apple"],
  sub_skills: [],
  ribbon: "",
  skill_level: 1,
} as unknown as Member;

let rec: ReturnType<typeof recordEvents>;
beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
  // jsdom has no scrolling; the swipe pager calls it when a card arrives.
  HTMLElement.prototype.scrollTo = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
  vi.spyOn(api, "getCatalog").mockResolvedValue(catalog);
  vi.spyOn(api, "listMembers").mockResolvedValue([raichu]);
  vi.spyOn(api, "getRecipes").mockResolvedValue([]);
  vi.spyOn(api, "getProgress").mockReturnValue(new Promise(() => {}));
  vi.spyOn(api, "computeTeamProduction").mockReturnValue(new Promise(() => {}));
  rec = recordEvents();
});
afterEach(() => rec.restore());

function renderTeams() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <LanguageProvider>
        <ComparisonSessionProvider>
          <TeamSessionProvider>
            <Teams />
          </TeamSessionProvider>
        </ComparisonSessionProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

const added = () => rec.events.filter((e) => e.name === "pokemon_added").map((e) => e.props);

describe("Team Analysis analytics", () => {
  it("records an add from the Box as a single slot", async () => {
    const user = userEvent.setup();
    renderTeams();
    await user.click(await screen.findByRole("button", { name: "+ My Pokémon" }));
    await user.click(await screen.findByRole("option", { name: /Raichu/ }));
    expect(added()).toEqual([{ tool: "team_analysis", source: "box", slot: "single", species: "Raichu" }]);
  });

  it("records a new Pokémon added as a split", async () => {
    const user = userEvent.setup();
    renderTeams();
    await user.click(await screen.findByRole("button", { name: "+ New" }));
    await user.click(screen.getByRole("button", { name: "submit-form" }));
    await user.click(screen.getByRole("button", { name: "Split" }));
    await user.click(screen.getByRole("menuitem", { name: "+ New" }));
    await user.click(screen.getByRole("button", { name: "submit-form" }));
    expect(added()).toEqual([
      { tool: "team_analysis", source: "new", slot: "single", species: "Pikachu" },
      { tool: "team_analysis", source: "new", slot: "split", species: "Pikachu" },
    ]);
  });

  it("records meals_set only when the meals dialog closes with a change", async () => {
    const user = userEvent.setup();
    renderTeams();
    await user.click(await screen.findByRole("button", { name: "open-meals" }));
    await user.click(screen.getByRole("button", { name: "close-meals" }));
    expect(rec.events.filter((e) => e.name === "meals_set")).toEqual([]);
    await user.click(screen.getByRole("button", { name: "open-meals" }));
    await user.click(screen.getByRole("button", { name: "pick-meal" }));
    await user.click(screen.getByRole("button", { name: "close-meals" }));
    expect(rec.events.filter((e) => e.name === "meals_set")).toEqual([{ name: "meals_set", props: { meals: 1 } }]);
  });
});
