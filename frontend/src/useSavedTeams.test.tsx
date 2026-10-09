import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  createMember: vi.fn(),
  updateMember: vi.fn(),
  createSavedTeam: vi.fn(),
  replaceSavedTeam: vi.fn(),
  listSavedTeams: vi.fn(),
}));
vi.mock("./api/client", () => ({ api }));
vi.mock("./auth/AuthContext", () => ({ useAuth: () => ({ status: "authenticated" }) }));

import { newEntry } from "./roster";
import { recordEvents } from "./telemetry/testing";
import type { Catalog, MemberInput } from "./types";
import { useSaveTeam } from "./useSavedTeams";

const cfg = (species: string): MemberInput => ({
  species, level: 30, nature: "", ingredients: ["Fancy Apple", "Fancy Apple", "Fancy Apple"],
  sub_skills: [], ribbon: "", skill_level: 1,
});
const catalog = { species: [], islands: [] } as unknown as Catalog;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

let rec: ReturnType<typeof recordEvents>;
beforeEach(() => { rec = recordEvents(); vi.clearAllMocks(); });
afterEach(() => rec.restore());

const definition = (slots: ReturnType<typeof newEntry>[]) => ({
  slots: slots.map((e) => ({ entries: [e], share: 1 })),
  meals: [null, null, null], dishType: null, island: null,
  favoriteBerries: [], mainFavorite: null, weeklyBonus: null,
}) as never;

describe("useSaveTeam analytics", () => {
  it("records each Box Pokémon it creates and the team, without its name", async () => {
    api.createMember.mockResolvedValueOnce({ id: "n1" }).mockResolvedValueOnce({ id: "n2" });
    api.createSavedTeam.mockResolvedValue({ id: "t-1", name: "Mi equipo" });
    const { result } = renderHook(() => useSaveTeam(), { wrapper });
    act(() =>
      result.current.mutate({
        name: "Mi equipo", overId: null, kind: "new",
        definition: definition([newEntry(cfg("Pikachu")), newEntry(cfg("Eevee"))]),
        members: new Map(), catalog, islands: [], onLinked: () => {},
      }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rec.events.filter((e) => e.name === "box_pokemon_saved").map((e) => e.props)).toEqual([
      { origin: "team_save", action: "create", species: "Pikachu" },
      { origin: "team_save", action: "create", species: "Eevee" },
    ]);
    expect(rec.events.filter((e) => e.name === "team_saved").map((e) => e.props)).toEqual([
      { kind: "new", slots: 2, split_slots: 0, members_from_box: 0, members_created: 2, has_map: false, expert_map: false, meals: 0 },
    ]);
    expect(JSON.stringify(rec.events)).not.toContain("Mi equipo");
  });

  it("records nothing when the team write fails", async () => {
    api.createMember.mockResolvedValue({ id: "n1" });
    api.createSavedTeam.mockRejectedValue(new Error("duplicate"));
    const { result } = renderHook(() => useSaveTeam(), { wrapper });
    act(() =>
      result.current.mutate({
        name: "X", overId: null, kind: "new",
        definition: definition([newEntry(cfg("Pikachu"))]),
        members: new Map(), catalog, islands: [], onLinked: () => {},
      }),
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(rec.events).toEqual([]);
  });
});
