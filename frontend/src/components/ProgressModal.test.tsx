import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "../api/client";
import { LanguageProvider } from "../i18n";
import type { Catalog, Island, PlayerProgress, Recipe } from "../types";
import { ProgressModal } from "./ProgressModal";

const LADDER = [21, 23, 25, 27, 29, 31, 33, 36];

// `Island` is { name, favorite_berries, user_picks, ratings, expert }.
const islands: Island[] = [
  { name: "Cyan Beach", favorite_berries: [], user_picks: false, expert: false, ratings: [] },
  {
    name: "Cyan Beach (Expert)",
    favorite_berries: [],
    user_picks: true,
    expert: true,
    ratings: [],
  },
];

// `Recipe` is { name, type, ingredients: IngredientCount[], base_strength } — all four.
const recipes: Recipe[] = [
  {
    name: "Beanburger Curry",
    type: "Curry",
    ingredients: [{ ingredient: "Bean Sausage", count: 7 }],
    base_strength: 856,
  },
  {
    name: "Snoozy Tomato Salad",
    type: "Salad",
    ingredients: [{ ingredient: "Snoozy Tomato", count: 8 }],
    base_strength: 1045,
  },
];

// A complete `Catalog`, so the test never needs a type cast: fields the test
// doesn't care about get empty defaults, and `overrides` fills in the rest.
function makeCatalog(overrides: Partial<Catalog> = {}): Catalog {
  return {
    natures: [],
    sub_skills: [],
    ingredients: [],
    species: [],
    recipe_level_bonus: [],
    ingredient_strengths: {},
    islands: [],
    pot_ladder: [],
    ...overrides,
  };
}

function makeProgress(overrides: Partial<PlayerProgress> = {}): PlayerProgress {
  return {
    pot_size: 33,
    recipe_levels: {},
    favorite_recipes: {},
    area_bonuses: {},
    ...overrides,
  };
}

function renderModal(onClose: () => void = () => {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <ProgressModal onClose={onClose} />
      </LanguageProvider>
    </QueryClientProvider>,
  );
  return { ...result, client };
}

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
  vi.spyOn(api, "getProgress").mockResolvedValue(makeProgress());
  vi.spyOn(api, "getRecipes").mockResolvedValue(recipes);
  vi.spyOn(api, "getCatalog").mockResolvedValue(makeCatalog({ pot_ladder: LADDER, islands }));
  vi.spyOn(api, "patchProgress").mockImplementation(async (patch) =>
    makeProgress(patch as Partial<PlayerProgress>),
  );
});

describe("ProgressModal — reading the draft", () => {
  it("shows the saved pot size", async () => {
    renderModal();
    expect(await screen.findByText("33 ingredients")).toBeInTheDocument();
  });

  it("disables the up button at the top of the ladder", async () => {
    vi.spyOn(api, "getProgress").mockResolvedValue(makeProgress({ pot_size: 36 }));
    renderModal();
    await screen.findByText("36 ingredients");
    expect(screen.getByRole("button", { name: "Bigger pot" })).toBeDisabled();
  });

  it("switches tabs", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    expect(screen.getByRole("tab", { name: "Areas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("33 ingredients")).not.toBeInTheDocument();
  });

  it("shows a type with no favorite as None", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    expect(screen.getAllByText("None").length).toBeGreaterThan(0);
  });

  it("shows the empty state when a search matches nothing", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Recipes" }));
    await userEvent.type(await screen.findByLabelText(/search/i), "zzzzz");
    expect(await screen.findByText("No results")).toBeInTheDocument();
  });

  it("shows one row per area and marks the expert ones", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    expect(await screen.findByText("Cyan Beach")).toBeInTheDocument();
    expect(screen.getByText("Expert")).toBeInTheDocument();
  });

  it("shows an area with no bonus as an ordinary starting state", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    expect(await screen.findAllByText("no bonus yet")).toHaveLength(2);
  });

  it("shows a saved area bonus", async () => {
    vi.spyOn(api, "getProgress").mockResolvedValue(
      makeProgress({ area_bonuses: { "Cyan Beach": 42 } }),
    );
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    expect(await screen.findByText("42")).toBeInTheDocument();
  });
});

describe("ProgressModal — the draft is not saved until Guardar", () => {
  it("raises the pot in the draft without sending a PATCH", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    const callsBefore = vi.mocked(api.patchProgress).mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Bigger pot" }));

    expect(await screen.findByText("36 ingredients")).toBeInTheDocument();
    expect(api.patchProgress).toHaveBeenCalledTimes(callsBefore);
  });

  it("changes a recipe level in the draft without sending a PATCH", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Recipes" }));
    const callsBefore = vi.mocked(api.patchProgress).mock.calls.length;

    const [input] = await screen.findAllByLabelText("Recipe level");
    await userEvent.clear(input);
    await userEvent.type(input, "55");

    expect(input).toHaveValue(55);
    expect(api.patchProgress).toHaveBeenCalledTimes(callsBefore);
  });

  it("changes an area bonus in the draft without sending a PATCH", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    const callsBefore = vi.mocked(api.patchProgress).mock.calls.length;

    const slider = await screen.findByLabelText("Area bonus — Cyan Beach");
    fireEvent.change(slider, { target: { value: "42" } });

    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(api.patchProgress).toHaveBeenCalledTimes(callsBefore);
  });

  it("keeps the draft unaffected by a background cache update", async () => {
    const { client } = renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("button", { name: "Bigger pot" }));
    await screen.findByText("36 ingredients");

    // A save from elsewhere (or a refetch) lands in the cache mid-edit; the
    // draft was seeded once and must not be clobbered by it.
    act(() => {
      client.setQueryData<PlayerProgress>(["progress"], makeProgress({ pot_size: 25 }));
    });

    expect(screen.getByText("36 ingredients")).toBeInTheDocument();
  });
});

describe("ProgressModal — Guardar", () => {
  it("is disabled with no changes", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("sends one PATCH with exactly the changed fields, across every tab, and closes", async () => {
    const onClose = vi.fn();
    renderModal(onClose);
    await screen.findByText("33 ingredients");

    await userEvent.click(screen.getByRole("button", { name: "Bigger pot" })); // 33 -> 36

    await userEvent.click(screen.getByRole("tab", { name: "Recipes" }));
    const [levelInput] = await screen.findAllByLabelText("Recipe level");
    await userEvent.clear(levelInput);
    await userEvent.type(levelInput, "55");

    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    const slider = await screen.findByLabelText("Area bonus — Cyan Beach");
    fireEvent.change(slider, { target: { value: "42" } });

    const callsBefore = vi.mocked(api.patchProgress).mock.calls.length;
    expect(api.patchProgress).toHaveBeenCalledTimes(callsBefore); // nothing sent yet

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).not.toBeDisabled();
    await userEvent.click(saveButton);

    // TanStack Query v5 calls mutationFn with a second (internal) context argument.
    await waitFor(() => expect(api.patchProgress).toHaveBeenCalledTimes(callsBefore + 1));
    expect(api.patchProgress).toHaveBeenLastCalledWith(
      {
        pot_size: 36,
        recipe_levels: { "Beanburger Curry": 55 },
        area_bonuses: { "Cyan Beach": 42 },
      },
      expect.anything(),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the modal open with the draft intact and shows the error when the save fails", async () => {
    vi.spyOn(api, "patchProgress").mockRejectedValueOnce(new Error("network error"));
    const onClose = vi.fn();
    renderModal(onClose);
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("button", { name: "Bigger pot" }));
    await screen.findByText("36 ingredients");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the change.");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("36 ingredients")).toBeInTheDocument();
  });
});

describe("ProgressModal — leaving with changes", () => {
  it("closes immediately with no changes, asking nothing", async () => {
    const onClose = vi.fn();
    renderModal(onClose);
    await screen.findByText("33 ingredients");

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByText(/leaving without saving discards/i)).not.toBeInTheDocument();
  });

  it("asks before closing with changes, and cancelar keeps the modal and the draft", async () => {
    const onClose = vi.fn();
    renderModal(onClose);
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("button", { name: "Bigger pot" }));
    await screen.findByText("36 ingredients");

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByText(/leaving without saving discards/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText(/leaving without saving discards/i)).not.toBeInTheDocument();
    expect(await screen.findByText("36 ingredients")).toBeInTheDocument();
  });

  it("salir sin guardar closes and discards the draft, without saving", async () => {
    const onClose = vi.fn();
    renderModal(onClose);
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("button", { name: "Bigger pot" }));
    await screen.findByText("36 ingredients");
    const callsBefore = vi.mocked(api.patchProgress).mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave without saving" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(api.patchProgress).toHaveBeenCalledTimes(callsBefore);
  });

  it("guardar from the exit question saves the draft and closes", async () => {
    const onClose = vi.fn();
    renderModal(onClose);
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("button", { name: "Bigger pot" }));
    await screen.findByText("36 ingredients");

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(api.patchProgress).toHaveBeenLastCalledWith({ pot_size: 36 }, expect.anything()),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("cancels the question on Escape instead of closing the modal", async () => {
    const onClose = vi.fn();
    renderModal(onClose);
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("button", { name: "Bigger pot" }));
    await screen.findByText("36 ingredients");

    fireEvent.keyDown(document, { key: "Escape" }); // ✕/Escape/overlay all ask first
    expect(await screen.findByText(/leaving without saving discards/i)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" }); // Escape again cancels the question
    await waitFor(() =>
      expect(screen.queryByText(/leaving without saving discards/i)).not.toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("36 ingredients")).toBeInTheDocument();
  });
});
