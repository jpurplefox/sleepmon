import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { LanguageProvider } from "../i18n";
import type { SubSkill } from "../types";
import { SubSkillSelect } from "./SubSkillSelect";

const subSkills: SubSkill[] = [
  { name: "Helping Speed S", tier: "Blue" },
  { name: "Helping Speed M", tier: "Gold" },
  { name: "Inventory Up S", tier: "Regular" },
  { name: "Ingredient Finder S", tier: "Blue" },
  { name: "Skill Trigger S", tier: "Gold" },
  { name: "Skill Level Up S", tier: "Blue" },
];

// SubSkillSelect is controlled; a stateful host lets sequential clicks accumulate.
function Harness({ level = 100 }: { level?: number }) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <LanguageProvider>
      <SubSkillSelect
        subSkills={subSkills}
        value={value}
        level={level}
        onChange={setValue}
        ariaLabel="Sub skills"
      />
    </LanguageProvider>
  );
}

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
});

describe("SubSkillSelect", () => {
  it("selects into the first empty slot and clears it on re-click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Sub skills" }));

    await user.click(screen.getByRole("option", { name: "Helping Speed S" }));
    // Once selected, the option's accessible name becomes the "Remove …" label.
    expect(screen.getByRole("option", { selected: true })).toHaveAccessibleName(
      "Remove Helping Speed S",
    );

    await user.click(screen.getByRole("option", { name: "Remove Helping Speed S" }));
    expect(screen.queryByRole("option", { selected: true })).toBeNull();
  });

  it("lets you preload a slot the level has not unlocked yet", async () => {
    const user = userEvent.setup();
    // Level 1 unlocks no sub-skill slots, but the game still lets you load them;
    // they simply activate once the Pokémon reaches the unlock level.
    render(<Harness level={1} />);
    await user.click(screen.getByRole("button", { name: "Sub skills" }));

    await user.click(screen.getByRole("option", { name: "Helping Speed S" }));

    expect(screen.getByRole("option", { selected: true })).toHaveAccessibleName(
      "Remove Helping Speed S",
    );
  });

  it("caps selections at five and disables the remaining options", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Sub skills" }));

    for (const name of [
      "Helping Speed S",
      "Helping Speed M",
      "Inventory Up S",
      "Ingredient Finder S",
      "Skill Trigger S",
    ]) {
      await user.click(screen.getByRole("option", { name }));
    }

    expect(screen.getAllByRole("option", { selected: true })).toHaveLength(5);
    // The sixth, still-unselected option can no longer be added.
    expect(screen.getByRole("option", { name: "Skill Level Up S" })).toBeDisabled();
  });
});
