import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import type { EventEffect } from "../eventBonus";
import { LanguageProvider } from "../i18n";
import { recordEvents } from "../telemetry/testing";
import { EventTab } from "./EventTab";

beforeEach(() => localStorage.setItem("sleepmon.lang", "en"));

function Harness({ initial = [] as EventEffect[] }) {
  const [effects, setEffects] = useState<EventEffect[]>(initial);
  return (
    <LanguageProvider>
      <EventTab effects={effects} onChange={setEffects} types={["Fire", "Psychic"]} />
    </LanguageProvider>
  );
}

describe("EventTab", () => {
  it("shows the empty state with only the add action", () => {
    render(<Harness />);
    expect(screen.getByRole("status")).toHaveTextContent(/No effects/);
    expect(screen.queryByRole("button", { name: "Remove all" })).toBeNull();
  });

  it("adds an effect with the default value and team scope", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "+ Add effect" }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("Extra ingredients per help");
    expect(row).toHaveTextContent("+1");
    expect(row).toHaveTextContent("Whole team");
  });

  it("records a confirmed new effect with its kind and scope", async () => {
    const rec = recordEvents();
    try {
      const user = userEvent.setup();
      render(<Harness />);
      await user.click(screen.getByRole("button", { name: "+ Add effect" }));
      expect(rec.events).toEqual([]);
      await user.click(screen.getByRole("button", { name: "Add" }));
      expect(rec.events).toEqual([
        { name: "event_effect_added", props: { effect: "extra_ingredients", scope: "team" } },
      ]);
    } finally {
      rec.restore();
    }
  });

  it("does not record an edit of an existing effect", async () => {
    const rec = recordEvents();
    try {
      const user = userEvent.setup();
      render(
        <Harness
          initial={[{ id: "a", kind: "dish_strength", value: 1.25, scope: { kind: "team" } }]}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Edit Dish strength" }));
      await user.click(screen.getByRole("button", { name: "+" }));
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(rec.events).toEqual([]);
    } finally {
      rec.restore();
    }
  });

  it("hides the scope for team-wide kinds", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "+ Add effect" }));
    await user.click(screen.getByRole("button", { name: /Extra ingredients per help/ }));
    await user.click(screen.getByRole("option", { name: /Pot size/ }));
    expect(screen.queryByRole("group", { name: "Scope" })).toBeNull();
  });

  it("disables confirm until a type is picked", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "+ Add effect" }));
    await user.click(screen.getByRole("button", { name: "Type" }));
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Pick a type/ }));
    await user.click(screen.getByRole("option", { name: /Psychic/ }));
    expect(screen.getByRole("button", { name: "Add" })).toBeEnabled();
  });

  it("disables the stepper at its bounds", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "+ Add effect" }));
    expect(screen.getByRole("button", { name: "−" })).toBeDisabled();
    const up = screen.getByRole("button", { name: "+" });
    for (let i = 0; i < 4; i++) await user.click(up);
    expect(up).toBeDisabled(); // +5 is the max
  });

  it("edits a row in place and removes all", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[{ id: "a", kind: "dish_strength", value: 1.25, scope: { kind: "team" } }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Edit Dish strength" }));
    await user.click(screen.getByRole("button", { name: "+" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("listitem")).toHaveTextContent("×1.3");
    await user.click(screen.getByRole("button", { name: "Remove all" }));
    expect(screen.getByRole("status")).toHaveTextContent(/No effects/);
  });

  it("removes one effect", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          { id: "a", kind: "dish_strength", value: 1.25, scope: { kind: "team" } },
          { id: "b", kind: "pot_size", value: 2, scope: { kind: "team" } },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove Dish strength" }));
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).getByText("Pot size")).toBeInTheDocument();
  });

  it("closes the editor when the effect being edited is removed", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[{ id: "a", kind: "dish_strength", value: 1.25, scope: { kind: "team" } }]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Edit Dish strength" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Dish strength" }));
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});
