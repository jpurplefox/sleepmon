import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  species: [{ name: "Pikachu", berry: "Grepa" }],
  islands: [
    island("Greengrass Isle", false),
    island("Greengrass Isle (Expert)", true),
    island("Cyan Beach", false, ["Oran", "Pamtre", "Pecha"]),
  ],
} as unknown as Catalog;

function renderBar(value: ComparisonMap = NEUTRAL_MAP) {
  const onChange = vi.fn();
  render(
    <LanguageProvider>
      <ComparisonMapBar catalog={catalog} value={value} onChange={onChange} />
    </LanguageProvider>,
  );
  return onChange;
}

describe("ComparisonMapBar", () => {
  it("names the map and offers every one, normal and expert", async () => {
    const onChange = renderBar();
    const trigger = screen.getByRole("button", { name: "Map" });
    expect(trigger).toHaveTextContent("Greengrass Isle");
    await userEvent.click(trigger);
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options[0]).toBe("Greengrass Isle");
    expect(options[1]).toContain("Greengrass Isle (Expert)");
    expect(options[2]).toBe("Cyan Beach");
    expect(screen.queryByText("Normal")).toBeNull();

    await userEvent.click(screen.getByRole("option", { name: "Cyan Beach" }));
    expect(onChange).toHaveBeenCalledWith({ ...NEUTRAL_MAP, island: "Cyan Beach", favorites: ["Oran", "Pamtre", "Pecha"] });
  });

  it("shows a map's game-set favorites without a picker", () => {
    renderBar({ ...NEUTRAL_MAP, island: "Cyan Beach", favorites: ["Oran", "Pamtre", "Pecha"] });
    expect(screen.queryByRole("button", { name: "Favorite berries" })).toBeNull();
    expect(screen.getByAltText("Oran")).toBeInTheDocument();
    expect(screen.getByTitle("The game sets this map's favorites")).toBeInTheDocument();
  });

  it("lets you pick the favorites where the map doesn't set them", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Favorite berries" })).toBeInTheDocument();
  });
});
