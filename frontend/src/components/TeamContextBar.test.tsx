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

const NO_MAP: MapSummary = { name: null, berries: [], areaPct: null };

function renderBar(overrides: Partial<React.ComponentProps<typeof TeamContextBar>> = {}) {
  const onGoodCampTicket = vi.fn();
  const onOpenSettings = vi.fn();
  render(
    <LanguageProvider>
      <TeamContextBar
        map={NO_MAP}
        eventEffects={[]}
        goodCampTicket={false}
        onGoodCampTicket={onGoodCampTicket}
        onOpenSettings={onOpenSettings}
        {...overrides}
      />
    </LanguageProvider>,
  );
  return { onGoodCampTicket, onOpenSettings };
}

describe("TeamContextBar", () => {
  it("shows every setting even when nothing is set", () => {
    renderBar();
    expect(screen.getByText("No map")).toBeInTheDocument();
    expect(screen.getByText("No event")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^Map No map/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Event No event/ })).toBeInTheDocument();
  });

  it("turns the Good Camp Ticket on in place, and ignores the already-pressed side", async () => {
    const { onGoodCampTicket, onOpenSettings } = renderBar();
    await userEvent.click(screen.getByRole("button", { name: "No" }));
    expect(onGoodCampTicket).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onGoodCampTicket).toHaveBeenCalledWith(true);
    expect(onOpenSettings).not.toHaveBeenCalled();
  });

  it("opens the settings on the Map tab from the Map field and on the Event tab from the Event field", async () => {
    const { onOpenSettings } = renderBar();
    await userEvent.click(screen.getByText("No map"));
    expect(onOpenSettings).toHaveBeenLastCalledWith("island");
    await userEvent.click(screen.getByText("No event"));
    expect(onOpenSettings).toHaveBeenLastCalledWith("event");
  });

  it("shows the map name, its berries in order and the area bonus", () => {
    renderBar({ map: { name: "Greengrass Isle (Expert)", berries: ["Leppa", "Grepa"], areaPct: 35 } });
    const field = screen.getByText("Greengrass Isle (Expert)").closest("button")!;
    const alts = within(field).getAllByRole("img").map((img) => img.getAttribute("alt"));
    expect(alts).toEqual(["Leppa", "Grepa"]);
    expect(within(field).getByText("Area +35%")).toBeInTheDocument();
  });

  it("omits the area figure when there is no area bonus", () => {
    renderBar({ map: { name: "Cyan Beach", berries: [], areaPct: null } });
    expect(screen.queryByText(/Area \+/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Map Cyan Beach/ })).toBeInTheDocument();
  });

  it("shows the event's marks instead of 'No event' when it has effects", () => {
    renderBar({ eventEffects: [{ id: "e1", kind: "pot_size", value: 2, scope: { kind: "team" } }] });
    expect(screen.queryByText("No event")).not.toBeInTheDocument();
    expect(screen.getByText("×2")).toBeInTheDocument();
  });
});
