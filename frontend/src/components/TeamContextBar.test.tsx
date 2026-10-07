import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import type { MapSummary } from "../mapSummary";
import { TeamContextBar } from "./TeamContextBar";

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
});

const NO_MAP: MapSummary = { name: null, berries: [], areaPct: null, weeklyBonus: null };

function renderBar(overrides: Partial<React.ComponentProps<typeof TeamContextBar>> = {}) {
  const onGoodCampTicket = vi.fn();
  const onOpenDialog = vi.fn();
  const onDishType = vi.fn();
  render(
    <LanguageProvider>
      <TeamContextBar
        map={NO_MAP}
        eventEffects={[]}
        goodCampTicket={false}
        onGoodCampTicket={onGoodCampTicket}
        onOpenDialog={onOpenDialog}
        dishType={null}
        meals={[null, null, null]}
        onDishType={onDishType}
        mapNames={[]}
        {...overrides}
      />
    </LanguageProvider>,
  );
  return { onGoodCampTicket, onOpenDialog, onDishType };
}

describe("TeamContextBar", () => {
  it("shows every setting even when nothing is set", () => {
    renderBar();
    expect(screen.getByRole("button", { name: /^Map No map/ })).toBeInTheDocument();
    expect(screen.getByText("No event")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^Map No map/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Event No event/ })).toBeInTheDocument();
  });

  it("turns the Good Camp Ticket on in place, and ignores the already-pressed side", async () => {
    const { onGoodCampTicket, onOpenDialog } = renderBar();
    await userEvent.click(screen.getByRole("button", { name: "No" }));
    expect(onGoodCampTicket).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onGoodCampTicket).toHaveBeenCalledWith(true);
    expect(onOpenDialog).not.toHaveBeenCalled();
  });

  it("opens the settings on the Map tab from the Map field and on the Event tab from the Event field", async () => {
    const { onOpenDialog } = renderBar();
    await userEvent.click(screen.getByRole("button", { name: /^Map No map/ }));
    expect(onOpenDialog).toHaveBeenLastCalledWith("map");
    await userEvent.click(screen.getByText("No event"));
    expect(onOpenDialog).toHaveBeenLastCalledWith("event");
  });

  it("shows the map name, its berries in order and the area bonus", () => {
    renderBar({ map: { name: "Greengrass Isle (Expert)", berries: ["Leppa", "Grepa"], areaPct: 35, weeklyBonus: null } });
    const field = screen.getByText("Greengrass Isle (Expert)").closest("button")!;
    const alts = within(field)
      .getAllByRole("img")
      .filter((el) => el.tagName === "IMG")
      .map((img) => img.getAttribute("alt"));
    expect(alts).toEqual(["Leppa", "Grepa"]);
    expect(within(field).getByRole("img", { name: "Area +35%" })).toHaveTextContent(/^\+35%$/);
  });

  it("omits the area figure when there is no area bonus", () => {
    renderBar({ map: { name: "Cyan Beach", berries: [], areaPct: null, weeklyBonus: null } });
    expect(screen.getByRole("button", { name: /^Map Cyan Beach/ })).not.toHaveAccessibleName(/Area/);
    expect(screen.getByRole("button", { name: /^Map Cyan Beach/ })).toBeInTheDocument();
  });

  it("shows the event's marks instead of 'No event' when it has effects", () => {
    renderBar({ eventEffects: [{ id: "e1", kind: "pot_size", value: 2, scope: { kind: "team" } }] });
    expect(screen.queryByText("No event")).not.toBeInTheDocument();
    expect(screen.getByText("×2")).toBeInTheDocument();
  });

  it("picks the dish type in place, and ignores the type already picked", async () => {
    const { onDishType, onOpenDialog } = renderBar({ dishType: "Curry" });
    expect(screen.getByRole("button", { name: "Curry" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Curry" }));
    expect(onDishType).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Salad" }));
    expect(onDishType).toHaveBeenCalledWith("Salad");
    expect(onOpenDialog).not.toHaveBeenCalled();
  });

  it("opens the settings on the Meals tab from the meals, even before any is chosen", async () => {
    const { onOpenDialog } = renderBar();
    await userEvent.click(screen.getByRole("button", { name: /^Meals No recipes/ }));
    expect(onOpenDialog).toHaveBeenCalledWith("meals");
  });

  it("shows the three chosen meals in order", () => {
    renderBar({
      dishType: "Curry",
      meals: [
        { recipe: "Bean Burger Curry", level: 1 },
        { recipe: "Mild Honey Curry", level: 3 },
        null,
      ],
    });
    const button = screen.getByRole("button", { name: /^Meals/ });
    const alts = within(button).getAllByRole("img").map((img) => img.getAttribute("alt"));
    expect(alts).toEqual(["Bean Burger Curry", "Mild Honey Curry"]);
    expect(button).not.toHaveAccessibleName(/No recipes/);
  });

  it("says 'No recipes' with nothing chosen, keeping the three places laid out behind it", () => {
    renderBar();
    const empty = screen.getByRole("button", { name: /^Meals No recipes/ });
    expect(within(empty).getByText("No recipes")).toBeInTheDocument();
    // The slots stay in the layout (hidden) so the field keeps one width either way.
    expect(empty.querySelectorAll(".ctx-recipe--empty")).toHaveLength(3);
  });

  it("fills the chosen places and leaves the rest as empty slots", () => {
    renderBar({
      meals: [{ recipe: "Bean Burger Curry", level: 1 }, null, { recipe: "Mild Honey Curry", level: 1 }],
    });
    const button = screen.getByRole("button", { name: /^Meals/ });
    expect(within(button).getAllByRole("img")).toHaveLength(2);
    expect(button.querySelectorAll(".ctx-recipe--empty")).toHaveLength(1);
  });

  it("shows an expert map's weekly bonus as a mark after its berries", () => {
    renderBar({
      map: { name: "Greengrass Isle (Expert)", berries: ["Leppa"], areaPct: null, weeklyBonus: "berry_strength" },
    });
    const field = screen.getByRole("button", { name: /^Map Greengrass Isle \(Expert\)/ });
    expect(within(field).getByRole("img", { name: "Berries ×2.4" })).toHaveTextContent("×2.4");
  });

  it("names the ingredient and skill weekly bonuses by their effect", () => {
    renderBar({ map: { name: "Cyan Beach (Expert)", berries: [], areaPct: null, weeklyBonus: "skill_trigger" } });
    expect(screen.getByRole("img", { name: "Skill ×1.25" })).toHaveTextContent("×1.25");
  });

  it("reserves room for the longest map, so the field keeps one width whatever is chosen", () => {
    renderBar({ mapNames: ["Cyan Beach", "Old Gold Power Plant (Expert)"] });
    const field = screen.getByRole("button", { name: /^Map No map/ });
    // One hidden sizer per map (plus "No map"), each with the widest extras; never announced.
    const sizers = field.querySelectorAll(".ctx-map__sizer");
    expect([...sizers].map((el) => el.firstChild?.textContent)).toEqual([
      "No map",
      "Cyan Beach",
      "Old Gold Power Plant (Expert)",
    ]);
    sizers.forEach((el) => expect(el).toHaveAttribute("aria-hidden", "true"));
    expect(field).not.toHaveAccessibleName(/Cyan Beach/);
  });
});
