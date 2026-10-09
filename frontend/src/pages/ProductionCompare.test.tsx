import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { ComparisonSessionProvider, useComparisonSession } from "../comparisonSession";
import { LanguageProvider } from "../i18n";
import { newEntry } from "../roster";
import { recordEvents } from "../telemetry/testing";
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

describe("Comparison analytics", () => {
  let rec: ReturnType<typeof recordEvents>;
  beforeEach(() => { rec = recordEvents(); });
  afterEach(() => rec.restore());

  const added = () => rec.events.filter((e) => e.name === "pokemon_added").map((e) => e.props);

  it("records New, My Pokémon and clone with their sources", async () => {
    const user = userEvent.setup();
    renderCompare();
    await user.click(await screen.findByRole("button", { name: "+ New" }));
    await user.click(screen.getByRole("button", { name: "submit-form" }));
    await user.click(screen.getByRole("button", { name: "+ My Pokémon" }));
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
});
