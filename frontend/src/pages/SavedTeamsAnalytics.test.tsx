import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { LanguageProvider } from "../i18n";
import { TeamSessionProvider } from "../teamSession";
import { recordEvents } from "../telemetry/testing";
import type { Catalog, Member, SavedTeam, Species } from "../types";

vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ status: "authenticated" }) }));

import { SavedTeams } from "./SavedTeams";

const species = (name: string, dex: number): Species => ({
  name,
  dex,
  specialty: "Berries",
  berry: "Grepa Berry",
  type: "Electric",
  sleep_type: "Dozing",
  main_skill: "Charge Strength S",
  ingredient_slots: [["Fancy Apple"], ["Fancy Apple"], ["Fancy Apple"]],
  ingredient_amounts: [[1], [2], [3]],
  base_inventory: 20,
});

const catalog = {
  natures: [],
  sub_skills: [],
  ingredients: ["Fancy Apple"],
  species: [species("Pikachu", 25)],
  recipe_level_bonus: [1],
  ingredient_strengths: {},
  islands: [{ name: "Greengrass Isle", expert: false, favorite_berries: [] }],
  pot_ladder: [],
} as unknown as Catalog;

const member = { id: "m-1", species: "Pikachu", level: 30, nature: "", ingredients: ["Fancy Apple", "Fancy Apple", "Fancy Apple"],
  sub_skills: [], ribbon: "", skill_level: 1, production: null } as unknown as Member;

const team = (id: string, name: string, members: string[]): SavedTeam =>
  ({
    id, name,
    slots: [{ members, share: 1 }],
    island: null, favorite_berries: [], main_favorite: null,
    weekly_bonus: "berry_strength", dish_type: null, meals: [null, null, null],
    saved_at: "2026-10-01T00:00:00Z",
  }) as unknown as SavedTeam;

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LanguageProvider>
        <TeamSessionProvider>
          <SavedTeams />
        </TeamSessionProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("Saved teams analytics", () => {
  let rec: ReturnType<typeof recordEvents>;
  beforeEach(() => {
    localStorage.setItem("sleepmon.lang", "en");
    HTMLElement.prototype.scrollTo = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    rec = recordEvents();
    vi.spyOn(api, "getCatalog").mockResolvedValue(catalog);
    vi.spyOn(api, "listMembers").mockResolvedValue([member]);
    vi.spyOn(api, "listSavedTeams").mockResolvedValue([team("t-1", "Uno", ["m-1"]), team("t-2", "Dos", ["m-1"])]);
  });
  afterEach(() => {
    rec.restore();
    vi.restoreAllMocks();
  });

  it("records the map filter once it is set", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Map/ }));
    await user.click(await screen.findByRole("option", { name: "Greengrass Isle" }));
    expect(rec.events).toEqual([{ name: "list_filtered", props: { list: "teams", filter: "map" } }]);
  });

  it("records a dish type only when it is turned on", async () => {
    const user = userEvent.setup();
    renderPage();
    const group = await screen.findByRole("group", { name: "Dish" });
    const toggle = within(group).getByRole("button", { name: "Curry" });
    await user.click(toggle);
    expect(rec.events).toEqual([{ name: "list_filtered", props: { list: "teams", filter: "dish_type" } }]);
    await user.click(toggle);
    expect(rec.events).toHaveLength(1);
  });

  it("records the Pokémon filter when one is picked", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /^Pokémon: All/ }));
    await user.click(await screen.findByRole("option", { name: /Pikachu/ }));
    await waitFor(() =>
      expect(rec.events).toContainEqual({ name: "list_filtered", props: { list: "teams", filter: "pokemon" } }),
    );
  });

  it("records a deleted team without its name", async () => {
    vi.spyOn(api, "deleteSavedTeam").mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Actions for “Uno”" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete “Uno”" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await waitFor(() => expect(rec.events).toContainEqual({ name: "team_deleted", props: {} }));
    expect(JSON.stringify(rec.events)).not.toContain("Uno");
  });

  it("records an opened team with how many members are gone, and no Pokémon added", async () => {
    vi.spyOn(api, "listSavedTeams").mockResolvedValue([team("t-1", "Uno", ["m-1", "m-gone"])]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Open Uno in Team analysis" }));
    await waitFor(() =>
      expect(rec.events).toContainEqual({ name: "team_opened", props: { members_missing: 1 } }),
    );
    expect(rec.events.some((e) => e.name === "pokemon_added")).toBe(false);
  });
});
