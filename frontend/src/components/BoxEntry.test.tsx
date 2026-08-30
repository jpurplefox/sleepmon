import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import type { Member, Species } from "../types";
import { BoxEntry } from "./BoxEntry";

// jsdom has no matchMedia; the component reads it to know whether the collapsible
// mobile layout is the one on screen.
// The section headings are prose, so the test pins the language.
function useEnglish() {
  localStorage.setItem("sleepmon.lang", "en");
}

function setViewport(mobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: mobile,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const VENUSAUR: Species = {
  name: "Venusaur",
  dex: 3,
  specialty: "Ingredients",
  berry: "Durin",
  type: "Grass",
  sleep_type: "Dozing",
  main_skill: "Ingredient Magnet S",
  ingredient_slots: [["Honey"], ["Honey"], ["Soft Potato"]],
  ingredient_amounts: [[2], [5], [6]],
  base_inventory: 17,
};

const MEMBER: Member = {
  id: "m1",
  species: "Venusaur",
  level: 62,
  nature: "",
  ingredients: ["Honey", "Honey", "Soft Potato"],
  sub_skills: ["Helping Speed M"],
  ribbon: "",
  skill_level: 3,
  production: {
    berries: 75.3,
    berry_strength: 10167,
    ingredients: [{ ingredient: "Honey", amount: 59.8 }],
    ingredients_total: 59.8,
    skill_triggers: 2,
    skill_ingredients: [],
    skill_ingredient_total: 21.8,
    skill_energy: null,
    skill_cooking_ingredients: null,
    skill_strength: null,
    skill_self_energy: null,
    skill_dream_shards: null,
    skill_tasty_chance: null,
    skill_extra_helpful: null,
    skill_random_energy: null,
  },
};

function renderEntry() {
  return render(
    <LanguageProvider>
      <BoxEntry
        member={MEMBER}
        species={VENUSAUR}
        tierBySubSkill={() => "Blue"}
        onEdit={() => {}}
        onDelete={() => {}}
        onCompare={() => {}}
      />
    </LanguageProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BoxEntry", () => {
  it("on mobile starts collapsed and expands on click", async () => {
    useEnglish();
    setViewport(true);
    const user = userEvent.setup();
    renderEntry();

    const toggle = screen.getByRole("button", { name: /^Venusaur/ });
    // Collapsed: no production detail, only the headline metric of its specialty.
    expect(screen.queryByText("Production")).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Production")).toBeInTheDocument();
    expect(screen.getByText("Build")).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Production")).not.toBeInTheDocument();
  });

  it("above the mobile breakpoint there is no toggle and the detail is always there", () => {
    useEnglish();
    setViewport(false);
    renderEntry();

    // Only the overflow "···" menu is a button; the identity is not a disclosure.
    expect(screen.queryByRole("button", { name: /^Venusaur/ })).not.toBeInTheDocument();
    // Section labels belong to the collapsible layout only.
    expect(screen.queryByText("Production")).not.toBeInTheDocument();
    // ...but the production numbers are rendered.
    expect(screen.getByText("75.3")).toBeInTheDocument();
  });
});
