import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LanguageProvider } from "../i18n";
import type { Catalog, MemberInput, Production } from "../types";
import { ProductionCard } from "./ProductionCard";

const GARDEVOIR = {
  "name": "Gardevoir",
  "dex": 282,
  "specialty": "Skills",
  "berry": "Mago",
  "type": "Psychic",
  "sleep_type": "Snoozing",
  "main_skill": "Energy for Everyone S",
  "ingredient_slots": [
    [
      "Fancy Apple"
    ],
    [
      "Fancy Apple",
      "Greengrass Corn"
    ],
    [
      "Fancy Apple",
      "Greengrass Corn",
      "Large Leek"
    ]
  ],
  "ingredient_amounts": [
    [
      1
    ],
    [
      2,
      1
    ],
    [
      4,
      2,
      2
    ]
  ],
  "base_inventory": 18
};

const CATALOG = {
  natures: [],
  sub_skills: [],
  ingredients: [],
  species: [GARDEVOIR],
  recipe_level_bonus: [],
  pot_ladder: [],
  ingredient_strengths: {},
  islands: [],
  versatile_skills: [],
} as unknown as Catalog;

const CONFIG: MemberInput = {
  species: "Gardevoir",
  level: 60,
  nature: "",
  ingredients: ["Fancy Apple", "Greengrass Corn", "Large Leek"],
  sub_skills: [],
  ribbon: "",
  skill_level: 4,
};

const PRODUCTION = {
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
} as unknown as Production;

const noop = () => {};

function renderCard(production: Production = PRODUCTION) {
  localStorage.setItem("sleepmon.lang", "en");
  return render(
    <LanguageProvider>
      <ProductionCard
        config={CONFIG}
        catalog={CATALOG}
        production={production}
        productionError={null}
        onEdit={noop}
        onClone={noop}
        onRemove={noop}
        onMakeBase={noop}
        onSaveToBox={noop}
      />
    </LanguageProvider>,
  );
}

describe("ProductionCard skill block", () => {
  it("shows the main skill's level in the skill block's header", () => {
    const { container } = renderCard();
    const head = container.querySelector(".prod-card__block--skill .prod-card__block-head");
    expect(head).not.toBeNull();
    expect(within(head as HTMLElement).getByText("Lv. 4")).toBeInTheDocument();
  });

  it("names the main skill for screen readers alongside its level", () => {
    renderCard();
    expect(screen.getByText("Energy for Everyone S Lv. 4")).toBeInTheDocument();
  });

  const levelOf = (container: HTMLElement) =>
    container.querySelector(".prod-card__skill-lv > [aria-hidden]") as HTMLElement;

  it("shows the boosted level after the one set when a bonus raises it", () => {
    const { container } = renderCard({ ...PRODUCTION, effective_skill_level: 5, skill_level_bonus: 1 });
    expect(levelOf(container)).toHaveTextContent(/^Lv\. 4 → 5$/);
    expect(within(levelOf(container)).getByText("5")).toHaveClass("prod-card__skill-lv-boost");
    expect(screen.getByText("Energy for Everyone S Lv. 5")).toBeInTheDocument();
  });

  it("adds max when the bonus overflows the skill's cap", () => {
    // Set at 4, +5 from an event, Energy for Everyone S caps at 6.
    const { container } = renderCard({ ...PRODUCTION, effective_skill_level: 6, skill_level_bonus: 5 });
    expect(levelOf(container)).toHaveTextContent(/^Lv\. 4 → 6max$/);
  });

  it("shows the same level on both sides when it already sits at the cap", () => {
    const { container } = renderCard(
      { ...PRODUCTION, effective_skill_level: 4, skill_level_bonus: 1 },
    );
    expect(levelOf(container)).toHaveTextContent(/^Lv\. 4 → 4max$/);
  });

  it("shows no max when the bonus fits under the cap", () => {
    const { container } = renderCard({ ...PRODUCTION, effective_skill_level: 6, skill_level_bonus: 2 });
    expect(levelOf(container)).toHaveTextContent(/^Lv\. 4 → 6$/);
  });
});
