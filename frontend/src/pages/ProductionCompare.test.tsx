import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { ComparisonSessionProvider, useComparisonSession } from "../comparisonSession";
import { LanguageProvider } from "../i18n";
import { EMPTY_PROGRESS } from "../progress";
import { newEntry } from "../roster";
import { recordEvents } from "../telemetry/testing";
import { production } from "../test/productionFixture";
import type { Catalog, Member, MemberInput, Species } from "../types";

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

import { Production } from "./Production";

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
  evolutions: [],
  previous_stage: null,
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

const pikachu = { ...raichu, species: "Pikachu" } as unknown as MemberInput;

// What the comparison already held before "Compare" was tapped in the box.
function Seed({ children }: { children: React.ReactNode }) {
  const { setEntries } = useComparisonSession();
  useEffect(() => setEntries([newEntry(pikachu), newEntry(pikachu)]), [setEntries]);
  return <>{children}</>;
}

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
  // jsdom has no scrolling; the swipe pager calls it when a card arrives.
  HTMLElement.prototype.scrollTo = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
  vi.spyOn(api, "getCatalog").mockResolvedValue(catalog);
  vi.spyOn(api, "listMembers").mockResolvedValue([raichu]);
  vi.spyOn(api, "getProgress").mockReturnValue(new Promise(() => {}));
  vi.spyOn(api, "computeProduction").mockReturnValue(new Promise(() => {}));
});

describe("Compare from the box", () => {
  it("starts the comparison with only that Pokémon, whatever it held before", async () => {
    const onBaseConsumed = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LanguageProvider>
          <ComparisonSessionProvider>
            <Seed>
              <Production baseMemberId="m-raichu" onBaseConsumed={onBaseConsumed} />
            </Seed>
          </ComparisonSessionProvider>
        </LanguageProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(onBaseConsumed).toHaveBeenCalled());
    const shown = screen.getAllByRole("button", { name: /^Show / }).map((b) => b.getAttribute("aria-label"));
    expect(shown).toEqual(["Show Raichu"]);
  });
});

function renderCompare(baseMemberId: string | null = null) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <LanguageProvider>
        <ComparisonSessionProvider>
          <Production baseMemberId={baseMemberId} onBaseConsumed={() => {}} />
        </ComparisonSessionProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("Comparison add cell", () => {
  it("offers New, From screenshots and My box, in that order", async () => {
    renderCompare();
    const cell = (await screen.findByRole("button", { name: "+ New" })).parentElement!;
    expect(within(cell).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "+ New", "+ From screenshots", "+ My box",
    ]);
  });
});

describe("Comparison analytics", () => {
  let rec: ReturnType<typeof recordEvents>;
  beforeEach(() => { rec = recordEvents(); });
  afterEach(() => rec.restore());

  const added = () => rec.events.filter((e) => e.name === "pokemon_added").map((e) => e.props);

  it("records New, My box and clone with their sources", async () => {
    const user = userEvent.setup();
    renderCompare();
    await user.click(await screen.findByRole("button", { name: "+ New" }));
    await user.click(screen.getByRole("button", { name: "submit-form" }));
    await user.click(screen.getByRole("button", { name: "+ My box" }));
    await user.click(await screen.findByRole("option", { name: /Raichu/ }));
    await user.click(screen.getAllByRole("button", { name: "Clone" })[0]);
    expect(added()).toEqual([
      { tool: "compare", source: "new", species: "Pikachu" },
      { tool: "compare", source: "box", species: "Raichu" },
      { tool: "compare", source: "clone", species: "Pikachu" },
    ]);
  });

  it("records Compare from the box as box_compare", async () => {
    renderCompare("m-raichu");
    await waitFor(() => expect(added()).toEqual([{ tool: "compare", source: "box_compare", species: "Raichu" }]));
  });

  it("records reaching the limit once", async () => {
    const user = userEvent.setup();
    renderCompare();
    await user.click(await screen.findByRole("button", { name: "+ New" }));
    await user.click(screen.getByRole("button", { name: "submit-form" }));
    for (let i = 0; i < 4; i++) await user.click(screen.getAllByRole("button", { name: "Clone" })[0]);
    expect(rec.events.filter((e) => e.name === "compare_limit_reached")).toHaveLength(1);
    expect(added()).toHaveLength(5);
  });

  it("records nothing when an existing card is edited", async () => {
    const user = userEvent.setup();
    renderCompare("m-raichu");
    await waitFor(() => expect(added()).toHaveLength(1));
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "submit-form" }));
    expect(added()).toHaveLength(1);
    expect(rec.events.map((e) => e.name)).toEqual(["pokemon_added"]);
  });

  it("records species_missing, not an add, for a Box Pokémon outside the catalogue", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "listMembers").mockResolvedValue([{ ...raichu, id: "m-ghost", species: "Missingno" } as Member]);
    renderCompare();
    await user.click(await screen.findByRole("button", { name: "+ My box" }));
    await user.click(await screen.findByRole("option", { name: /Missingno/ }));
    expect(rec.events).toEqual([
      { name: "species_missing", props: { species: "Missingno", tool: "compare" } },
    ]);
  });

  it("records nothing more once the comparison is full", async () => {
    const user = userEvent.setup();
    renderCompare();
    await user.click(await screen.findByRole("button", { name: "+ New" }));
    await user.click(screen.getByRole("button", { name: "submit-form" }));
    for (let i = 0; i < 4; i++) await user.click(screen.getAllByRole("button", { name: "Clone" })[0]);
    // Clone is disabled at 5/5; a click must change nothing and record nothing.
    await user.click(screen.getAllByRole("button", { name: "Clone" })[0]);
    expect(added()).toHaveLength(5);
    expect(rec.events.filter((e) => e.name === "compare_limit_reached")).toHaveLength(1);
    // At 5/5 neither the add card nor the pager's add item is rendered.
    expect(screen.queryByRole("button", { name: "+ New" })).toBeNull();
    expect(screen.queryByRole("button", { name: "+ My box" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a Pokémon" })).toBeNull();
    // Removing a card brings the add card back.
    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(await screen.findByRole("button", { name: "+ New" })).toBeTruthy();
  });

  it("suggests a comparable Box Pokémon, records the pick and stops suggesting it", async () => {
    const user = userEvent.setup();
    const bulbasaur = { ...species("Bulbasaur", 1), specialty: "Ingredients" } as Species;
    vi.spyOn(api, "getCatalog").mockResolvedValue({
      ...catalog,
      species: [...catalog.species, bulbasaur],
    } as Catalog);
    vi.spyOn(api, "listMembers").mockResolvedValue([
      raichu,
      { ...raichu, id: "m-bulba", species: "Bulbasaur" } as Member,
    ]);
    // Computations wait for the saved sleep schedule (signed in).
    vi.spyOn(api, "getProgress").mockResolvedValue(EMPTY_PROGRESS);
    vi.spyOn(api, "computeProduction").mockResolvedValue({
      helps_per_day: 0, seconds_per_help: 0, berry: "Grepa Berry", berry_amount: 0, berry_strength: 0,
      berry_percentage: 0, ingredient_percentage: 0, skill_percentage: 0, effective_skill_percentage: 0,
      ingredients: [], skill_triggers: 0, skill_ingredients: [], sleep_sessions: [], inventory: 0,
      inventory_fill_hours: 0, effective_skill_level: 1, skill_level_bonus: 0,
      main_ingredient_at_60: null,
    } as unknown as Awaited<ReturnType<typeof api.computeProduction>>);
    renderCompare();
    await user.click(await screen.findByRole("button", { name: "+ New" }));
    await user.click(screen.getByRole("button", { name: "submit-form" }));
    const pick = await screen.findByRole("button", { name: "Add Raichu, Lv. 30" });
    expect(screen.queryByRole("button", { name: /^Add Bulbasaur/ })).toBeNull();
    await user.click(pick);
    expect(added()).toContainEqual({ tool: "compare", source: "suggestion", species: "Raichu" });
    expect(screen.queryByRole("button", { name: "Add Raichu, Lv. 30" })).toBeNull();
  });
});

describe("Comparison level", () => {
  it("sends the level with every card and records it; save keeps the real level", async () => {
    const rec = recordEvents();
    // Signed in: the cards only compute once the profile's sleep schedule is known.
    vi.spyOn(api, "getProgress").mockResolvedValue({ sleep: { night_minutes: 510, nap_minutes: null } } as never);
    const raised = { ...production, comparison_raise: { from_level: 30, to_level: 60, candies: 1, dream_shards: 2 } };
    const compute = vi.spyOn(api, "computeProduction").mockResolvedValue(raised as never);
    const create = vi.spyOn(api, "createMember").mockResolvedValue(raichu);
    const user = userEvent.setup();
    renderCompare();
    await user.click(await screen.findByRole("button", { name: "+ New" }));
    await user.click(screen.getByRole("button", { name: "submit-form" }));

    await user.click(await screen.findByRole("radio", { name: "Level 60" }));

    await waitFor(() =>
      expect(compute).toHaveBeenLastCalledWith(expect.objectContaining({ level: 30, comparison_level: 60 })),
    );
    expect(rec.events).toContainEqual({ name: "comparison_level_set", props: { level: "60" } });

    // Save and Clone use the card's real level, not the raised one.
    await user.click(await screen.findByRole("button", { name: "Save as new to your box" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ level: 30 })));
    create.mockClear();
    await user.click(screen.getAllByRole("button", { name: "Clone" })[0]);
    // The saved original now offers "update"; the clone is the only unsaved card.
    await user.click(await screen.findByRole("button", { name: "Save as new to your box" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ level: 30 })));
    rec.restore();
  });

  it("keeps the level when Compare brings a Box Pokémon", async () => {
    function SeedLevel({ children }: { children: React.ReactNode }) {
      const { setComparisonLevel } = useComparisonSession();
      useEffect(() => setComparisonLevel(50), [setComparisonLevel]);
      return <>{children}</>;
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <LanguageProvider>
          <ComparisonSessionProvider>
            <SeedLevel>
              <Production baseMemberId="m-raichu" onBaseConsumed={() => {}} />
            </SeedLevel>
          </ComparisonSessionProvider>
        </LanguageProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("radio", { name: "Level 50" })).toHaveAttribute("aria-checked", "true");
  });
});
