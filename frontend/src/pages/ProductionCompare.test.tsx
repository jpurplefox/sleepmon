import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { ComparisonSessionProvider, useComparisonSession } from "../comparisonSession";
import { LanguageProvider } from "../i18n";
import { newEntry } from "../roster";
import type { Catalog, Member, MemberInput, Species } from "../types";

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
