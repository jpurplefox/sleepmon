import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

import { api } from "../api/client";
import { ComparisonSessionProvider } from "../comparisonSession";
import { LanguageProvider } from "../i18n";
import { recordEvents } from "../telemetry/testing";
import type { Catalog, ComparisonShare, MemberInput, Production as ProductionData, Species } from "../types";

const auth = vi.hoisted(() => ({ status: "authenticated" as "authenticated" | "anonymous" }));
const gate = vi.hoisted(() => ({ guard: vi.fn((f: () => void) => f()) }));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ status: auth.status }) }));
vi.mock("../auth/useGate", () => ({ useGate: () => gate }));
// Drawing needs a real browser: here the picture is a stand-in.
const image = vi.hoisted(() => ({
  shareOrDownload: vi.fn(async () => "shared" as const),
}));
vi.mock("../shareImage", () => ({
  drawSheet: vi.fn(async () => ({}) as HTMLCanvasElement),
  sheetPng: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
  previewJpegBase64: vi.fn(async () => "SlBFRw=="),
  shareOrDownload: image.shareOrDownload,
  canShareFiles: () => true,
}));

import { Production } from "./Production";

const species = (name: string, dex: number): Species => ({
  name,
  dex,
  specialty: "Berries",
  berry: "Grepa",
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

const config = (name: string, level: number): MemberInput => ({
  species: name,
  level,
  nature: "",
  ingredients: ["Fancy Apple", "Fancy Apple", "Fancy Apple"],
  sub_skills: [],
  ribbon: "",
  skill_level: 1,
});

const share: ComparisonShare = {
  id: "abc123def456",
  url: "https://sleepmon.app/s/abc123def456",
  members: [config("Pikachu", 30), config("Raichu", 40)],
  island: null,
  favorites: ["Grepa"],
  weekly_bonus: "berry_strength",
};

// A real /production response (the one ProductionCard.test uses).
const production = {
  "helps_per_day": 106.14250614250614,
  "seconds_per_help": 814,
  "berry": "Mago",
  "berry_amount": 94.44390368550368,
  "berry_strength": 10577.717212776413,
  "berry_percentage": 88.48,
  "ingredient_percentage": 11.520000000000003,
  "skill_percentage": 4.2,
  "effective_skill_percentage": 5.906909447664128,
  "effective_skill_level": 3,
  "skill_level_bonus": 0,
  "ingredients": [
    {
      "ingredient": "Fancy Apple",
      "amount": 3.899534152334153
    },
    {
      "ingredient": "Greengrass Corn",
      "amount": 3.899534152334153
    },
    {
      "ingredient": "Large Leek",
      "amount": 7.799068304668306
    }
  ],
  "skill_triggers": 5.4869234009315555,
  "skill_ingredients": [],
  "skill_energy": 49.382310608384,
  "skill_ingredient_total": null,
  "skill_cooking_ingredients": null,
  "skill_strength": null,
  "skill_self_energy": null,
  "skill_dream_shards": null,
  "skill_tasty_chance": null,
  "skill_extra_helpful": null,
  "skill_random_energy": null,
  "sleep_sessions": [
    {
      "kind": "night",
      "hours": 8.5,
      "overflow_hours": 1.0383333333333333,
      "skill_chances": [
        0.857623470957523,
        0.5800917336637341
      ]
    }
  ],
  "inventory": 34,
  "inventory_fill_hours": 7.461666666666667,
  "skill_berry_amount": null,
  "skill_berry_strength": null,
  "skill_berries_per_teammate": null,
  "skill_help_targets": null,
  "skill_candy": null,
  "skill_berry_juice": null,
  "skill_energy_drain": null,
  "teammate_berries": null,
  "teammate_ingredients": null
} as unknown as ProductionData;

function renderAt(path: string) {
  const location = memoryLocation({ path, record: true });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LanguageProvider>
        <ComparisonSessionProvider>
          <Router hook={location.hook} searchHook={location.searchHook}>
            <Production />
          </Router>
        </ComparisonSessionProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  );
  return location;
}

let recorder: ReturnType<typeof recordEvents>;
beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
  // Anonymous: the cards compute with the default night, no profile to wait for.
  auth.status = "anonymous";
  HTMLElement.prototype.scrollTo = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
  URL.createObjectURL = () => "blob:picture";
  URL.revokeObjectURL = () => {};
  vi.spyOn(api, "getCatalog").mockResolvedValue(catalog);
  vi.spyOn(api, "listMembers").mockResolvedValue([]);
  vi.spyOn(api, "getProgress").mockReturnValue(new Promise(() => {}));
  vi.spyOn(api, "computeProduction").mockResolvedValue(production);
  recorder = recordEvents();
});

afterEach(() => {
  recorder.restore();
  vi.restoreAllMocks();
  gate.guard.mockClear();
  image.shareOrDownload.mockClear();
});

describe("Opening a shared link", () => {
  it("opens the shared cards and map terms, then drops the query", async () => {
    const getShare = vi.spyOn(api, "getComparisonShare").mockResolvedValue(share);
    const location = renderAt("/compare?share=abc123def456");

    await waitFor(() => expect(screen.getAllByText("Raichu").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Pikachu").length).toBeGreaterThan(0);
    expect(getShare).toHaveBeenCalledWith("abc123def456");
    await waitFor(() => expect(location.history[location.history.length - 1]).toBe("/compare"));
    expect(recorder.events).toContainEqual({ name: "shared_comparison_opened", props: { cards: 2 } });
  });

  it("says so when the share doesn't exist", async () => {
    vi.spyOn(api, "getComparisonShare").mockRejectedValue(new Error("404"));
    renderAt("/compare?share=missing");

    expect(await screen.findByText(/doesn't exist or is no longer available/)).toBeInTheDocument();
  });
});

describe("Sharing the comparison", () => {
  async function openDialog() {
    vi.spyOn(api, "getComparisonShare").mockResolvedValue(share);
    renderAt("/compare?share=abc123def456");
    const button = await screen.findByRole("button", { name: "Share" });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    return screen.getByRole("dialog");
  }

  it("draws every card side by side, whatever the screen", async () => {
    await openDialog();

    const sheet = document.querySelector(".share-sheet") as HTMLElement;
    expect(sheet.querySelectorAll(".prod-card--snapshot")).toHaveLength(2);
    // A picture has nothing to tap: no action bar, no reorder, no "Make base".
    expect(within(sheet).queryByRole("button", { name: /edit/i })).toBeNull();
    expect(within(sheet).queryByText("Make base")).toBeNull();
    expect(within(sheet).getByText("Base")).toBeInTheDocument();
  });

  it("shares the picture", async () => {
    const dialog = await openDialog();
    const shareImage = within(dialog).getByRole("button", { name: "Share image" });
    await waitFor(() => expect(shareImage).toBeEnabled());

    await userEvent.click(shareImage);

    expect(image.shareOrDownload).toHaveBeenCalledOnce();
    expect(recorder.events).toContainEqual({ name: "comparison_shared", props: { kind: "image", cards: 2 } });
  });

  it("creates a link behind a sign-in, with the cards and the preview", async () => {
    const create = vi.spyOn(api, "createComparisonShare").mockResolvedValue({ ...share, id: "new", url: "https://sleepmon.app/s/new" });
    const dialog = await openDialog();
    const shareLink = within(dialog).getByRole("button", { name: "Share link" });
    await waitFor(() => expect(shareLink).toBeEnabled());

    await userEvent.click(shareLink);

    expect(gate.guard).toHaveBeenCalledWith(expect.any(Function), "share_link");
    await waitFor(() => expect(within(dialog).getByRole("textbox")).toHaveValue("https://sleepmon.app/s/new"));
    const body = create.mock.calls[0][0];
    expect(body.members.map((m) => m.species)).toEqual(["Pikachu", "Raichu"]);
    expect(body.favorites).toEqual(["Grepa"]);
    expect(body.language).toBe("en");
    expect(body.image).toEqual({ media_type: "image/jpeg", data: "SlBFRw==" });
    expect(recorder.events).toContainEqual({ name: "comparison_shared", props: { kind: "link", cards: 2 } });
  });
});
