import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import type { Catalog, ImportField, MemberInput, Species } from "../types";
import { MemberForm } from "./MemberForm";

const pikachu: Species = {
  name: "Pikachu",
  dex: 25,
  specialty: "Berries",
  berry: "Grepa Berry",
  type: "Electric",
  sleep_type: "Dozing",
  main_skill: "Charge Strength S",
  ingredient_slots: [["Fancy Apple"], ["Warming Ginger"], ["Fancy Apple", "Warming Ginger"]],
  ingredient_amounts: [[1], [2], [5, 8]],
  base_inventory: 20,
  evolutions: [],
  previous_stage: null,
};

const bulbasaur: Species = {
  name: "Bulbasaur",
  dex: 1,
  specialty: "Ingredients",
  berry: "Durin Berry",
  type: "Grass",
  sleep_type: "Snoozing",
  main_skill: "Ingredient Magnet S",
  ingredient_slots: [["Honey"], ["Snoozy Tomato"], ["Honey", "Soft Potato"]],
  ingredient_amounts: [[1], [2], [5, 8]],
  base_inventory: 20,
  evolutions: ["Ivysaur"],
  previous_stage: null,
};

const ivysaur: Species = {
  ...bulbasaur,
  name: "Ivysaur",
  dex: 2,
  evolutions: ["Venusaur"],
  previous_stage: "Bulbasaur",
};
const venusaur: Species = {
  ...bulbasaur,
  name: "Venusaur",
  dex: 3,
  evolutions: [],
  previous_stage: "Ivysaur",
};

const kirlia: Species = {
  ...bulbasaur,
  name: "Kirlia",
  dex: 281,
  main_skill: "Energy for Everyone S",
  evolutions: ["Gardevoir", "Gallade"],
  previous_stage: null,
};
const gardevoir: Species = {
  ...kirlia,
  name: "Gardevoir",
  dex: 282,
  evolutions: [],
  previous_stage: "Kirlia",
};
const gallade: Species = {
  ...kirlia,
  name: "Gallade",
  dex: 475,
  evolutions: [],
  previous_stage: "Kirlia",
};

const mew: Species = {
  name: "Mew",
  dex: 151,
  specialty: "All",
  berry: "Mago",
  type: "Psychic",
  sleep_type: "Snoozing",
  main_skill: "Versatile",
  ingredient_slots: [["Fancy Egg"], ["Fancy Egg"], ["Fancy Egg"]],
  ingredient_amounts: [[2], [4], [6]],
  base_inventory: 26,
  evolutions: [],
  previous_stage: null,
};

const catalog: Catalog = {
  natures: [{ name: "Bashful", neutral: true, increased: null, decreased: null }],
  sub_skills: [{ name: "Helping Speed M", tier: "Blue" }],
  ingredients: ["Fancy Apple", "Warming Ginger", "Honey", "Snoozy Tomato", "Soft Potato"],
  species: [pikachu, bulbasaur, ivysaur, venusaur, kirlia, gardevoir, gallade, mew],
  versatile_skills: ["Charge Strength M", "Metronome", "Berry Burst"],
  recipe_level_bonus: [1.0],
  ingredient_strengths: { "Fancy Apple": 90 },
  islands: [],
  pot_ladder: [],
};

function renderForm(props: Partial<React.ComponentProps<typeof MemberForm>> = {}) {
  const onSubmit = vi.fn();
  render(
    <LanguageProvider>
      <MemberForm
        catalog={catalog}
        onSubmit={onSubmit}
        pending={false}
        error={null}
        {...props}
      />
    </LanguageProvider>,
  );
  return { onSubmit };
}

async function pickSpecies(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole("button", { name: "Species" }));
  await user.click(screen.getByRole("option", { name }));
}

beforeEach(() => {
  // Force English so accessible-name selectors below are stable.
  localStorage.setItem("sleepmon.lang", "en");
});

describe("MemberForm unsaved changes", () => {
  it("is clean until something is changed, new or edited", async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    renderForm({ onDirtyChange });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await pickSpecies(user, /Pikachu/);
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("an untouched edit is clean even after its ingredients load", () => {
    const onDirtyChange = vi.fn();
    const initial: MemberInput = {
      species: "Pikachu",
      level: 30,
      nature: "",
      ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Apple"],
      sub_skills: [],
      ribbon: "",
      skill_level: 1,
    };
    renderForm({ initial, onDirtyChange });
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});

describe("MemberForm (catalogue-driven)", () => {
  it("blocks the submit until a species is chosen", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.getByRole("button", { name: "Add to my box" })).toBeDisabled();

    await pickSpecies(user, /Pikachu/);

    expect(screen.getByRole("button", { name: "Add to my box" })).toBeEnabled();
  });

  it("defaults each ingredient slot to the chosen species' first option", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await pickSpecies(user, /Pikachu/);
    await user.click(screen.getByRole("button", { name: "Add to my box" }));

    expect(onSubmit).toHaveBeenCalledWith({
      species: "Pikachu",
      level: 30,
      nature: "",
      ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Apple"],
      sub_skills: [],
      ribbon: "",
      skill_level: 1,
    });
  });

  it("derives the slot defaults from the species, not a fixed set", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await pickSpecies(user, /Bulbasaur/);
    await user.click(screen.getByRole("button", { name: "Add to my box" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        species: "Bulbasaur",
        ingredients: ["Honey", "Snoozy Tomato", "Honey"],
      }),
    );
  });

  it("keeps the existing kit when editing instead of resetting to defaults", async () => {
    const user = userEvent.setup();
    const initial: MemberInput = {
      species: "Pikachu",
      level: 42,
      nature: "Bashful",
      ingredients: ["Warming Ginger", "Fancy Apple", "Warming Ginger"],
      sub_skills: ["Helping Speed M"],
      ribbon: "",
      skill_level: 3,
    };
    const { onSubmit } = renderForm({ initial });

    await user.click(screen.getByRole("button", { name: "Add to my box" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        species: "Pikachu",
        ingredients: ["Warming Ginger", "Fancy Apple", "Warming Ginger"],
      }),
    );
  });

  it("flags an unknown species and blocks the submit", () => {
    const initial: MemberInput = {
      species: "Missingno",
      level: 30,
      nature: "",
      ingredients: [],
      sub_skills: [],
      ribbon: "",
      skill_level: 1,
    };
    renderForm({ initial });

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to my box" })).toBeDisabled();
  });
});

describe("MemberForm with Mew", () => {
  it("sends Metronome for a new Mew", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await pickSpecies(user, /Mew/);
    await user.click(screen.getByRole("button", { name: "Add to my box" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ species: "Mew", versatile_skill: "Metronome" }),
    );
  });

  it("sends the skill picked from the skill's menu", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await pickSpecies(user, /Mew/);
    await user.click(screen.getByRole("button", { name: "Choose main skill" }));
    await user.click(screen.getByRole("option", { name: "Charge Strength M" }));
    await user.click(screen.getByRole("button", { name: "Add to my box" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ species: "Mew", versatile_skill: "Charge Strength M" }),
    );
  });

  it("keeps an edited Mew's skill", async () => {
    const user = userEvent.setup();
    const initial: MemberInput = {
      species: "Mew",
      level: 30,
      nature: "",
      ingredients: ["Fancy Egg", "Fancy Egg", "Fancy Egg"],
      sub_skills: [],
      ribbon: "",
      skill_level: 1,
      versatile_skill: "Berry Burst",
    };
    const { onSubmit } = renderForm({ initial });
    await user.click(screen.getByRole("button", { name: "Add to my box" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ versatile_skill: "Berry Burst" }),
    );
  });

  it("sends no skill choice for other species", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await pickSpecies(user, /Pikachu/);
    await user.click(screen.getByRole("button", { name: "Add to my box" }));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty("versatile_skill");
  });
});

describe("MemberForm imported", () => {
  const imported = {
    values: {
      species: "Pikachu",
      level: 25,
      nature: "",
      ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Apple"],
      sub_skills: [],
      ribbon: "",
      skill_level: 3,
    } as MemberInput,
    unread: ["nature", "ribbon"] as ImportField[],
    images: 2,
  };

  it("opens with the read values, the summary and a mark per unread field", () => {
    renderForm({ imported });
    expect(screen.getByRole("spinbutton", { name: /level/i })).toHaveValue(25);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Read from 2 screenshots · check Nature and Ribbon",
    );
    expect(screen.getAllByText("Not read")).toHaveLength(2);
  });

  it("clears a field's mark once it changes, and the summary stops naming it", async () => {
    renderForm({ imported });
    await userEvent.click(screen.getByRole("button", { name: /next ribbon/i }));
    // The mark outlives the change by its exit animation.
    await waitFor(() => expect(screen.getAllByText("Not read")).toHaveLength(1));
    expect(screen.getByRole("status")).toHaveTextContent("check Nature");
    expect(screen.getByRole("status")).not.toHaveTextContent("Ribbon");
  });

  it("is dirty from the start", () => {
    const onDirtyChange = vi.fn();
    renderForm({ imported, onDirtyChange });
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });
});

describe("MemberForm imported without a species", () => {
  const imported = (ingredients: string[], unread: ImportField[] = ["species"]) => ({
    values: {
      species: "",
      level: 25,
      nature: "Bashful",
      ingredients,
      sub_skills: ["Helping Speed M"],
      ribbon: "",
      skill_level: 3,
    } as MemberInput,
    unread,
    images: 1,
  });

  it("opens with the rest of the reading and asks to check the species", () => {
    renderForm({ imported: imported(["Fancy Apple", "Warming Ginger", "Warming Ginger"]) });
    expect(screen.getByRole("spinbutton", { name: /level/i })).toHaveValue(25);
    expect(screen.getByRole("status")).toHaveTextContent("Read from 1 screenshot · check Species");
    expect(screen.getByRole("button", { name: "Add to my box" })).toBeDisabled();
  });

  it("keeps the read kit once a species that allows it is picked", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ imported: imported(["Fancy Apple", "Warming Ginger", "Warming Ginger"]) });
    await pickSpecies(user, /Pikachu/);
    await waitFor(() => expect(screen.queryByText("Not read")).toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent(/^Read from 1 screenshot$/);
    await user.click(screen.getByRole("button", { name: "Add to my box" }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      species: "Pikachu",
      level: 25,
      nature: "Bashful",
      ingredients: ["Fancy Apple", "Warming Ginger", "Warming Ginger"],
      sub_skills: ["Helping Speed M"],
    });
  });

  it("marks the kit unread when the picked species can't hold a read ingredient", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ imported: imported(["Fancy Egg", "Warming Ginger", ""]) });
    await pickSpecies(user, /Pikachu/);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("check Ingredients"));
    expect(screen.getByRole("status")).not.toHaveTextContent("Species");
    await user.click(screen.getByRole("button", { name: "Add to my box" }));
    expect(onSubmit.mock.calls[0][0].ingredients).toEqual(["Fancy Apple", "Warming Ginger", "Fancy Apple"]);
  });
});

describe("MemberForm evolution", () => {
  const caught: MemberInput = {
    species: "Bulbasaur",
    level: 12,
    nature: "Bashful",
    ingredients: ["Honey", "Snoozy Tomato", "Soft Potato"],
    sub_skills: ["Helping Speed M"],
    ribbon: "",
    skill_level: 2,
  };

  it("evolves one stage per click, keeping the kit and raising the skill", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ initial: caught });

    await user.click(screen.getByRole("button", { name: "Evolve to Ivysaur" }));
    await user.click(screen.getByRole("button", { name: "Evolve to Venusaur" }));
    expect(screen.getByRole("button", { name: "Evolve" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Add to my box" }));
    expect(onSubmit).toHaveBeenCalledWith({ ...caught, species: "Venusaur", skill_level: 4 });
  });

  it("picks the evolution from a grid when the line branches", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ initial: { ...caught, species: "Kirlia" } });

    await user.click(screen.getByRole("button", { name: "Evolve" }));
    await user.click(screen.getByRole("menuitem", { name: "Gallade" }));

    await user.click(screen.getByRole("button", { name: "Add to my box" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ species: "Gallade", skill_level: 3 }),
    );
  });

  it("goes back a stage from a Pokémon opened already evolved, lowering the skill", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ initial: { ...caught, species: "Venusaur", skill_level: 3 } });

    await user.click(screen.getByRole("button", { name: "Back to Ivysaur" }));

    await user.click(screen.getByRole("button", { name: "Add to my box" }));
    expect(onSubmit).toHaveBeenCalledWith({ ...caught, species: "Ivysaur", skill_level: 2 });
  });

  it("never takes the skill below 1 when going back", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ initial: { ...caught, species: "Ivysaur", skill_level: 1 } });

    await user.click(screen.getByRole("button", { name: "Back to Bulbasaur" }));

    await user.click(screen.getByRole("button", { name: "Add to my box" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ skill_level: 1 }));
  });

  it("shows both steps and the ingredient slots disabled before a species is picked", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "Back to the previous stage" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Evolve" })).toBeDisabled();
    const slots = screen.getByRole("group", { name: "Ingredients" });
    expect(within(slots).getAllByText(/^Lv \d+$/)).toHaveLength(3);
    expect(within(slots).queryAllByRole("button")).toHaveLength(0);
  });

  it("disables the steps a species doesn't have", () => {
    renderForm({
      initial: {
        ...caught,
        species: "Pikachu",
        ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Apple"],
      },
    });

    expect(screen.getByRole("button", { name: "Back to the previous stage" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Evolve" })).toBeDisabled();
  });

  it("closes the grid when the species is picked by hand", async () => {
    const user = userEvent.setup();
    renderForm({ initial: { ...caught, species: "Kirlia" } });

    await user.click(screen.getByRole("button", { name: "Evolve" }));
    await pickSpecies(user, /Pikachu/);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("keeps the ingredients when a species of the same line is picked by hand", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ initial: caught });

    await pickSpecies(user, /Venusaur/);

    await user.click(screen.getByRole("button", { name: "Add to my box" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ species: "Venusaur", ingredients: caught.ingredients }),
    );
  });

  it("resets the ingredients when another line is picked, even if it offers them", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm({ initial: caught });

    // Kirlia's fixture shares Bulbasaur's slots but is another line.
    await pickSpecies(user, /Kirlia/);

    await user.click(screen.getByRole("button", { name: "Add to my box" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ species: "Kirlia", ingredients: ["Honey", "Snoozy Tomato", "Honey"] }),
    );
  });

  it("disables Back on a base form", () => {
    renderForm({ initial: caught });

    expect(screen.getByRole("button", { name: "Back to the previous stage" })).toBeDisabled();
  });

  it("closes the grid on Escape and returns focus to Evolve", async () => {
    const user = userEvent.setup();
    renderForm({ initial: { ...caught, species: "Kirlia" } });

    await user.click(screen.getByRole("button", { name: "Evolve" }));
    expect(screen.getByRole("menuitem", { name: "Gardevoir" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Evolve" })).toHaveFocus();
  });

  it("closes the grid on an outside click", async () => {
    const user = userEvent.setup();
    renderForm({ initial: { ...caught, species: "Kirlia" } });

    await user.click(screen.getByRole("button", { name: "Evolve" }));
    await user.click(document.body);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("moves focus between grid items with the arrow keys", async () => {
    const user = userEvent.setup();
    renderForm({ initial: { ...caught, species: "Kirlia" } });

    await user.click(screen.getByRole("button", { name: "Evolve" }));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Gallade" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Gardevoir" })).toHaveFocus();
  });

  it("moves focus to Back after the last forward step", async () => {
    const user = userEvent.setup();
    renderForm({ initial: { ...caught, species: "Ivysaur", skill_level: 3 } });

    await user.click(screen.getByRole("button", { name: "Evolve to Venusaur" }));

    expect(screen.getByRole("button", { name: "Back to Ivysaur" })).toHaveFocus();
  });
});
