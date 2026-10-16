import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
  evolutions: [],
  previous_stage: null,
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
    skill_berry_amount: null,
    skill_berries_per_teammate: null,
  },
};

function renderEntry(member: Member = MEMBER, species: Species = VENUSAUR) {
  return render(
    <LanguageProvider>
      <BoxEntry
        member={member}
        species={species}
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
    expect(screen.queryByText("Berries")).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Berries")).toBeInTheDocument();
    expect(screen.getByText("Nature")).toBeInTheDocument();
    // No section titles: the row labels already say what each block is.
    expect(screen.queryByText("Build")).not.toBeInTheDocument();
    expect(screen.queryByText("Production")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Berries")).not.toBeInTheDocument();
  });

  it("above the mobile breakpoint there is no toggle and the detail is always there", () => {
    useEnglish();
    setViewport(false);
    renderEntry();

    // Only the overflow "···" menu is a button; the identity is not a disclosure.
    expect(screen.queryByRole("button", { name: /^Venusaur/ })).not.toBeInTheDocument();
    // Row labels belong to the collapsible layout only.
    expect(screen.queryByText("Berries")).not.toBeInTheDocument();
    // ...but the production numbers are rendered.
    expect(screen.getByText("75.3")).toBeInTheDocument();
  });
});

const AT_TARGET = {
  ...MEMBER.production!,
  helps_per_day: 50,
  level_up: null,
  ingredients: [
    { ingredient: "Honey", amount: 40 },
    { ingredient: "Soft Potato", amount: 30 },
  ],
};
const LEVELED: Member = {
  ...MEMBER,
  level: 55,
  production: {
    ...MEMBER.production!,
    helps_per_day: 45,
    level_up: { target_level: 60, candies: 1227, dream_shards: 1141655, at_target: AT_TARGET },
  },
};
// No unlock between 61 and 65: the pill falls back to the main ingredient at the target.
const NO_UNLOCK: Member = {
  ...MEMBER,
  level: 61,
  production: {
    ...MEMBER.production!,
    helps_per_day: 45,
    level_up: {
      target_level: 65,
      candies: 900,
      dream_shards: 800000,
      at_target: { ...MEMBER.production!, ingredients: [{ ingredient: "Honey", amount: 62.3 }] },
    },
  },
};

describe("level-up cost", () => {
  afterEach(() => localStorage.clear());

  it("shows the span and the cost in its own column", () => {
    useEnglish();
    setViewport(false);
    const { container } = renderEntry(LEVELED);
    const cell = container.querySelector(".box-entry__levelup") as HTMLElement;
    expect(within(cell).getByText("Lv. 55 → 60")).toBeInTheDocument();
    // Figures are abbreviated so the column stays narrow (PRD 0021).
    const costRow = cell.querySelector(".levelup-cost") as HTMLElement;
    expect(within(costRow).getByText("1,227")).toBeInTheDocument();
    expect(within(costRow).getByText("1.14M")).toBeInTheDocument();
  });

  it("keeps the exact cost in the comparison tooltip", () => {
    useEnglish();
    setViewport(false);
    const { container } = renderEntry(LEVELED);
    const bubble = container.querySelector(".box-entry__levelup .tooltip__bubble") as HTMLElement;
    const cost = bubble.querySelector(".levelup-tip__cost") as HTMLElement;
    // Icons + exact figures, as in the column; the words stay for screen readers.
    expect(cost.querySelectorAll("img")).toHaveLength(2);
    expect(within(cost).getByText("1,227")).toBeInTheDocument();
    expect(within(cost).getByText("1,141,655")).toBeInTheDocument();
    expect(cost.querySelector(".sr-only")).toHaveTextContent("1,227 candies · 1,141,655 dream shards");
  });

  it("names the focusable span with the full level-up cost", () => {
    useEnglish();
    setViewport(false);
    renderEntry(LEVELED);
    const trigger = screen.getByLabelText(/Level 55 to 60: 1,227 candies/);
    expect(trigger).toHaveAttribute("tabIndex", "0");
    expect(trigger).toHaveAttribute("role", "img");
    // The tooltip wrapper carries no competing label.
    expect(trigger.closest(".tooltip")).not.toHaveAttribute("aria-label");
  });

  it("shows the new ingredient as the gain when the span unlocks one", () => {
    useEnglish();
    setViewport(false);
    const { container } = renderEntry(LEVELED);
    const pill = container.querySelector(".levelup-gain") as HTMLElement;
    expect(pill).toHaveClass("prod-delta--up");
    expect(pill).toHaveTextContent("+30.0");
    expect(pill.querySelector(".prod-delta__arrow")).toBeNull();
    // The desktop row drops the visible "new" word to stay compact.
    expect(pill.querySelector(".levelup-gain__new")).toBeNull();
  });

  it("puts the span and the gain on one line, the cost on the next", () => {
    useEnglish();
    setViewport(false);
    const { container } = renderEntry(LEVELED);
    const head = container.querySelector(".box-entry__levelup-head") as HTMLElement;
    expect(within(head).getByText("Lv. 55 → 60")).toBeInTheDocument();
    expect(head.querySelector(".levelup-gain")).not.toBeNull();
    expect(head.querySelector(".levelup-cost")).toBeNull();
  });

  it("abbreviates a strength gain from 10,000 up", () => {
    useEnglish();
    setViewport(false);
    const berry: Member = {
      ...LEVELED,
      production: {
        ...LEVELED.production!,
        level_up: {
          ...LEVELED.production!.level_up!,
          at_target: { ...AT_TARGET, berry_strength: 22467 },
        },
      },
    };
    const { container } = renderEntry(berry, { ...VENUSAUR, specialty: "Berries" });
    expect(container.querySelector(".levelup-gain")).toHaveTextContent("12.3K");
  });

  it("shows the main ingredient's delta when the span unlocks no ingredient", () => {
    useEnglish();
    setViewport(false);
    const { container } = renderEntry(NO_UNLOCK);
    const pill = container.querySelector(".levelup-gain") as HTMLElement;
    expect(pill).toHaveClass("prod-delta--up");
    expect(pill.querySelector(".prod-delta__arrow")).not.toBeNull();
    expect(pill).toHaveTextContent("+2.5");
  });

  it("opens a wide tooltip with the unlocks and the now-vs-target rows on keyboard focus", () => {
    useEnglish();
    setViewport(false);
    renderEntry(LEVELED);
    const trigger = screen.getByText("Lv. 55 → 60");
    const bubble = trigger.closest(".tooltip")!.querySelector(".tooltip__bubble") as HTMLElement;
    expect(bubble.style.display).toBe("none");

    // The Tooltip opens on keyboard focus only (:focus-visible). jsdom derives that
    // from the last key event, so a Tab keydown precedes moving focus to the span.
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => trigger.focus());

    expect(bubble.style.display).toBe("flex");
    expect(bubble).toHaveClass("tooltip__bubble--wide");
    const tip = within(bubble);
    expect(tip.getByText("Lv. 55 → Lv. 60")).toBeInTheDocument();
    expect(tip.getByText("Helps")).toBeInTheDocument();
    // Once as the unlock in the head, once as its row.
    expect(tip.getAllByText("Soft Potato")).toHaveLength(2);
    expect(tip.getByText("—")).toBeInTheDocument();
  });

  it("notes an unrecorded sub skill unlocked by the span", () => {
    useEnglish();
    setViewport(false);
    renderEntry({ ...LEVELED, level: 45, sub_skills: ["Helping Speed M", "Berry Finding S"] });
    expect(screen.getByText("Sub skill not recorded")).toBeInTheDocument();
    expect(screen.getByText(/With no sub skill recorded/)).toBeInTheDocument();
  });

  it("says the Pokémon is at max level at 70+, instead of an empty cell", () => {
    useEnglish();
    setViewport(false);
    const { container } = renderEntry({
      ...MEMBER,
      level: 75,
      production: { ...MEMBER.production!, level_up: null },
    });
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    const cell = container.querySelector(".box-entry__levelup") as HTMLElement;
    expect(within(cell).getByText("Max level reached")).toBeInTheDocument();
  });

  it("keeps an empty cell when production isn't computed", () => {
    useEnglish();
    setViewport(false);
    const { container } = renderEntry({ ...MEMBER, production: undefined });
    expect(container.querySelector(".box-entry__levelup")).toBeEmptyDOMElement();
  });

  it("adds a Next level section to the expanded phone entry", async () => {
    useEnglish();
    setViewport(true);
    const user = userEvent.setup();
    const { container } = renderEntry(LEVELED);
    expect(screen.queryByText("Next level")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Venusaur/ }));

    expect(screen.getByText("Next level")).toBeInTheDocument();
    expect(screen.getByText("Cost")).toBeInTheDocument();
    const costRow = container.querySelector(".box-entry__levelup-cost") as HTMLElement;
    expect(within(costRow).getByText("1,227")).toBeInTheDocument();
    expect(container.querySelector(".levelup-gain__new")).toHaveTextContent("new");
    // The desktop cell isn't rendered on a phone.
    expect(container.querySelector(".box-entry__levelup")).toBeNull();
  });

  it("says max level in the phone's Next level section at 70+, with no cost", async () => {
    useEnglish();
    setViewport(true);
    const user = userEvent.setup();
    renderEntry({
      ...MEMBER,
      level: 75,
      production: { ...MEMBER.production!, level_up: null },
    });
    await user.click(screen.getByRole("button", { name: /^Venusaur/ }));
    expect(screen.getByText("Next level")).toBeInTheDocument();
    expect(screen.getByText("Max level reached")).toBeInTheDocument();
    expect(screen.queryByText("Cost")).not.toBeInTheDocument();
  });

  it("has no Next level section on a phone without production", async () => {
    useEnglish();
    setViewport(true);
    const user = userEvent.setup();
    const { container } = renderEntry({ ...MEMBER, production: undefined });
    await user.click(screen.getByRole("button", { name: /^Venusaur/ }));
    expect(screen.queryByText("Next level")).not.toBeInTheDocument();
    expect(container.querySelector(".box-entry__divider--levelup")).toBeNull();
  });
});

describe("build", () => {
  afterEach(() => localStorage.clear());

  it("orders ingredients, sub skills, then nature", () => {
    useEnglish();
    setViewport(false);
    const { container } = renderEntry();
    const build = container.querySelector(".box-entry__build") as HTMLElement;
    const parts = [
      ...build.querySelectorAll(
        ".box-entry__ing-config > .ingredient-row, .box-entry__config > .ingredient-row, .box-entry__config > .prod-box-item__nature",
      ),
    ].map((el) =>
      el.classList.contains("prod-box-item__nature")
        ? "nature"
        : el.parentElement!.classList.contains("box-entry__ing-config")
          ? "ingredients"
          : "sub skills",
    );
    expect(parts).toEqual(["ingredients", "sub skills", "nature"]);
  });

  it("names the nature, or says there is none", () => {
    useEnglish();
    setViewport(false);
    const { container, unmount } = renderEntry();
    expect(within(container.querySelector(".prod-box-item__nature") as HTMLElement).getByText("No nature")).toBeInTheDocument();
    unmount();
    const adamant = render(
      <LanguageProvider>
        <BoxEntry
          member={{ ...MEMBER, nature: "Adamant" }}
          species={VENUSAUR}
          nature={{ name: "Adamant", neutral: false, increased: "Speed of Help", decreased: "Main Skill Chance" }}
          tierBySubSkill={() => "Blue"}
          onEdit={() => {}}
          onDelete={() => {}}
          onCompare={() => {}}
        />
      </LanguageProvider>,
    );
    const pill = adamant.container.querySelector(".prod-box-item__nature .nature-pill") as HTMLElement;
    expect(within(pill).getByText("Adamant")).toBeInTheDocument();
  });
});
