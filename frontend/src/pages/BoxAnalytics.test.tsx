import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { LanguageProvider } from "../i18n";
import { recordEvents } from "../telemetry/testing";
import type { Catalog, Member, SavedTeam, Species } from "../types";

const pikachuForm = vi.hoisted(() => ({
  species: "Pikachu", level: 30, nature: "", ingredients: ["Fancy Apple", "Fancy Apple", "Fancy Apple"],
  sub_skills: [], ribbon: "", skill_level: 1,
}));
vi.mock("../components/MemberForm", () => ({
  MemberForm: ({ onSubmit }: { onSubmit: (c: unknown) => void }) => (
    <button type="button" onClick={() => onSubmit(pikachuForm)}>submit-form</button>
  ),
}));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ status: "authenticated" }) }));
vi.mock("../auth/useGate", () => ({ useGate: () => ({ guard: (f: () => void) => f() }) }));

import { Team } from "./Team";

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
  species: [species("Pikachu", 25), species("Raichu", 26)],
  recipe_level_bonus: [1],
  ingredient_strengths: {},
  islands: [],
  pot_ladder: [],
} as unknown as Catalog;

const member = (id: string, name: string) =>
  ({ ...pikachuForm, id, species: name, production: null }) as unknown as Member;

const team = {
  id: "t-1",
  name: "Mi equipo",
  slots: [{ members: ["m-1"], share: 1 }],
  island: null,
  favorite_berries: [],
  main_favorite: null,
  weekly_bonus: null,
  dish_type: null,
  meals: [null, null, null],
} as unknown as SavedTeam;

function renderBox() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LanguageProvider>
        <Team onCompare={() => {}} />
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("Box analytics", () => {
  let rec: ReturnType<typeof recordEvents>;
  beforeEach(() => {
    localStorage.setItem("sleepmon.lang", "en");
    HTMLElement.prototype.scrollTo = () => {};
    HTMLElement.prototype.scrollIntoView = () => {};
    // jsdom has no matchMedia; BoxEntry reads it to pick the desktop layout.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    rec = recordEvents();
    vi.spyOn(api, "getCatalog").mockResolvedValue(catalog);
    vi.spyOn(api, "listMembers").mockResolvedValue([member("m-1", "Pikachu"), member("m-2", "Raichu")]);
    vi.spyOn(api, "listSavedTeams").mockResolvedValue([]);
    vi.spyOn(api, "createMember").mockResolvedValue(member("m-3", "Pikachu"));
    vi.spyOn(api, "updateMember").mockResolvedValue(member("m-1", "Pikachu"));
    vi.spyOn(api, "deleteMember").mockResolvedValue(undefined);
  });
  afterEach(() => {
    rec.restore();
    vi.restoreAllMocks();
  });

  it("records a create from the Box", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.click(await screen.findByRole("button", { name: "+ Add Pokémon" }));
    await user.click(screen.getByRole("button", { name: "submit-form" }));
    await waitFor(() =>
      expect(rec.events).toContainEqual({
        name: "box_pokemon_saved",
        props: { origin: "box", action: "create", species: "Pikachu" },
      }),
    );
  });

  it("records an update from the Box", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.click(await screen.findByRole("button", { name: "More actions for Pikachu" }));
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "submit-form" }));
    await waitFor(() =>
      expect(rec.events).toContainEqual({
        name: "box_pokemon_saved",
        props: { origin: "box", action: "update", species: "Pikachu" },
      }),
    );
  });

  it("records a delete with the number of teams affected", async () => {
    vi.spyOn(api, "listSavedTeams").mockResolvedValue([team]);
    const user = userEvent.setup();
    renderBox();
    await user.click(await screen.findByRole("button", { name: "More actions for Pikachu" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete Pikachu" }));
    await screen.findByText(/«Mi equipo»/);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(rec.events).toContainEqual({ name: "box_pokemon_deleted", props: { teams_affected: 1 } }),
    );
    expect(JSON.stringify(rec.events)).not.toContain("Mi equipo");
  });

  it("records turning a filter on but not clearing it, and sorting", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.click(await screen.findByRole("button", { name: "Filter by type (berry)" }));
    await user.click(screen.getByRole("option", { name: "Electric" }));
    await user.click(screen.getByRole("option", { name: "Electric" }));
    await user.click(screen.getByRole("button", { name: "Sort by" }));
    await user.click(screen.getByRole("option", { name: "Level" }));
    await user.click(screen.getByRole("button", { name: "Ascending" }));
    expect(rec.events.filter((e) => e.name === "list_filtered")).toEqual([
      { name: "list_filtered", props: { list: "box", filter: "type" } },
    ]);
    expect(rec.events.filter((e) => e.name === "list_sorted").map((e) => e.props)).toEqual([
      { list: "box", key: "level", direction: "asc" },
      { list: "box", key: "level", direction: "desc" },
    ]);
  });

  it("does not record re-picking the current sort key", async () => {
    const user = userEvent.setup();
    renderBox();
    await user.click(await screen.findByRole("button", { name: "Sort by" }));
    await user.click(screen.getByRole("option", { name: "Pokédex" }));
    expect(rec.events.filter((e) => e.name === "list_sorted")).toEqual([]);
  });
});
