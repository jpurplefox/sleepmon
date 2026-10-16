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

function renderEntry(member: Member = MEMBER) {
  return render(
    <LanguageProvider>
      <BoxEntry
        member={member}
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
    expect(within(cell).getByText("1,227")).toBeInTheDocument();
    expect(within(cell).getByText("1,141,655")).toBeInTheDocument();
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
    expect(pill).toHaveTextContent("+30.0 new");
    expect(pill.querySelector(".prod-delta__arrow")).toBeNull();
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

  it("keeps an empty cell at level 70+ so the column stays aligned", () => {
    useEnglish();
    setViewport(false);
    const { container } = renderEntry({
      ...MEMBER,
      level: 75,
      production: { ...MEMBER.production!, level_up: null },
    });
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    expect(container.querySelector(".box-entry__levelup")).toBeEmptyDOMElement();
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
    expect(screen.getByText("1,227")).toBeInTheDocument();
    // The desktop cell isn't rendered on a phone.
    expect(container.querySelector(".box-entry__levelup")).toBeNull();
  });

  it("has no Next level section on a phone at level 70+", async () => {
    useEnglish();
    setViewport(true);
    const user = userEvent.setup();
    const { container } = renderEntry({
      ...MEMBER,
      level: 75,
      production: { ...MEMBER.production!, level_up: null },
    });
    await user.click(screen.getByRole("button", { name: /^Venusaur/ }));
    expect(screen.queryByText("Next level")).not.toBeInTheDocument();
    expect(container.querySelector(".box-entry__divider--levelup")).toBeNull();
  });
});
