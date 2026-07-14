import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import { SkillLevelSelector } from "./SkillLevelSelector";

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
});

function renderSelector(props: React.ComponentProps<typeof SkillLevelSelector>) {
  render(
    <LanguageProvider>
      <SkillLevelSelector {...props} />
    </LanguageProvider>,
  );
}

describe("SkillLevelSelector", () => {
  it("clamps the level down when the new skill tops out lower", () => {
    const onChange = vi.fn();
    // Energy for Everyone S caps at 6, so a level-7 value must be pulled down.
    renderSelector({ value: 7, onChange, mainSkill: "Energy for Everyone S" });
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it("leaves the level untouched when it is within the skill's range", () => {
    const onChange = vi.fn();
    renderSelector({ value: 5, onChange, mainSkill: "Energy for Everyone S" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables stepping below level 1", () => {
    renderSelector({ value: 1, onChange: vi.fn(), mainSkill: "Charge Strength S" });
    expect(screen.getByRole("button", { name: "Lower skill level" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Raise skill level" })).toBeEnabled();
  });

  it("disables stepping past the skill's maximum", () => {
    // Charge Strength S caps at 7.
    renderSelector({ value: 7, onChange: vi.fn(), mainSkill: "Charge Strength S" });
    expect(screen.getByRole("button", { name: "Raise skill level" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lower skill level" })).toBeEnabled();
  });
});
