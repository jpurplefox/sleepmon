import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { NEUTRAL_MAP, type ComparisonMap } from "../comparisonMap";
import { LanguageProvider } from "../i18n";
import type { Catalog, Island } from "../types";
import { ComparisonMapBar } from "./ComparisonMapBar";

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
});

const island = (name: string, expert: boolean, favorites: string[] = []): Island => ({
  name, favorite_berries: favorites, user_picks: favorites.length === 0, ratings: [], expert,
  expert_speed: expert ? { main: 0.8, penalty: 1.35 } : null,
});
const catalog = {
  species: [
    { name: "Pikachu", berry: "Grepa" },
    { name: "Squirtle", berry: "Oran" },
  ],
  islands: [
    island("Greengrass Isle", false),
    island("Cyan Beach", false, ["Oran", "Pamtre", "Pecha"]),
    island("Cyan Beach (Expert)", true),
  ],
} as unknown as Catalog;

let current: ComparisonMap = NEUTRAL_MAP;
function Harness() {
  const [map, setMap] = useState<ComparisonMap>(NEUTRAL_MAP);
  current = map;
  return <ComparisonMapBar catalog={catalog} value={map} onChange={setMap} />;
}
const renderBar = () =>
  render(
    <LanguageProvider>
      <Harness />
    </LanguageProvider>,
  );

describe("ComparisonMapBar", () => {
  it("is Team analysis's Map field, naming the map", () => {
    renderBar();
    expect(screen.getByRole("button", { name: /Map Greengrass Isle/ })).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("opens Team analysis's map dialog, with no 'No map' and no area bonus", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: /Map Greengrass Isle/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText("Area bonus")).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Greengrass Isle" }));
    expect(within(dialog).queryByRole("option", { name: "No map" })).toBeNull();
    expect(within(dialog).getAllByRole("option")).toHaveLength(3);
  });

  it("a map with its own favorites brings them; picking berries fills the slots", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: /Map Greengrass Isle/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Grepa" }));
    expect(current.favorites).toEqual(["Grepa"]);

    await userEvent.click(within(dialog).getByRole("button", { name: "Greengrass Isle" }));
    await userEvent.click(within(dialog).getByRole("option", { name: /^Cyan BeachOran/ }));
    expect(current).toEqual({ ...NEUTRAL_MAP, island: "Cyan Beach", favorites: ["Oran", "Pamtre", "Pecha"] });
  });

  it("shows the weekly bonus on an expert map", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: /Map Greengrass Isle/ }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Greengrass Isle" }));
    await userEvent.click(within(dialog).getByRole("option", { name: /Cyan Beach \(Expert\)/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "+1 ingredient" }));
    expect(current.weeklyBonus).toBe("ingredient");
  });
});
