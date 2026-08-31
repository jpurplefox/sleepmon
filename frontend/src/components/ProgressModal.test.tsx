import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

function renderModal() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <ProgressModal onClose={() => {}} />
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

afterEach(() => {
  vi.useRealTimers();
});

describe("ProgressModal", () => {
  it("shows the saved pot size", async () => {
    renderModal();
    expect(await screen.findByText("33 ingredients")).toBeInTheDocument();
  });

  it("saves the next ladder step when the pot is raised", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("button", { name: "Bigger pot" }));
    // TanStack Query v5 calls mutationFn with a second (internal) context argument.
    await waitFor(() =>
      expect(api.patchProgress).toHaveBeenCalledWith({ pot_size: 36 }, expect.anything()),
    );
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

  it("saves a recipe level from the recipes tab", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Recipes" }));
    const inputs = await screen.findAllByLabelText("Recipe level");
    await userEvent.clear(inputs[0]);
    await userEvent.type(inputs[0], "55");
    await waitFor(() =>
      expect(api.patchProgress).toHaveBeenCalledWith(
        { recipe_levels: expect.objectContaining({ "Beanburger Curry": 55 }) },
        expect.anything(),
      ),
    );
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

  it("saves an area bonus", async () => {
    vi.spyOn(api, "getProgress").mockResolvedValue(
      makeProgress({ area_bonuses: { "Cyan Beach": 42 } }),
    );
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    expect(await screen.findByText("42")).toBeInTheDocument();
  });

  it("debounces a slider drag into a single save", async () => {
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    const slider = await screen.findByLabelText("Area bonus — Cyan Beach");
    // Other tests' calls share this spy (no mock-clearing between tests), so
    // compare against a baseline instead of asserting an absolute call count.
    const callsBefore = vi.mocked(api.patchProgress).mock.calls.length;

    vi.useFakeTimers();
    // A drag fires onChange on every pixel — simulate a burst, not one clean step.
    fireEvent.change(slider, { target: { value: "10" } });
    fireEvent.change(slider, { target: { value: "35" } });
    fireEvent.change(slider, { target: { value: "60" } });
    expect(api.patchProgress).toHaveBeenCalledTimes(callsBefore);

    // Async variant: also flushes the microtask react-query uses to invoke mutationFn.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(api.patchProgress).toHaveBeenCalledTimes(callsBefore + 1);
    expect(api.patchProgress).toHaveBeenLastCalledWith(
      { area_bonuses: { "Cyan Beach": 60 } },
      expect.anything(),
    );
  });

  it("cancels a pending save when the modal unmounts before the debounce fires", async () => {
    const { unmount } = renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    const slider = await screen.findByLabelText("Area bonus — Cyan Beach");
    const callsBefore = vi.mocked(api.patchProgress).mock.calls.length;

    vi.useFakeTimers();
    fireEvent.change(slider, { target: { value: "77" } });
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(api.patchProgress).toHaveBeenCalledTimes(callsBefore);
  });

  it("follows an external progress change when no save is pending", async () => {
    const { client } = renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    const slider = (await screen.findByLabelText(
      "Area bonus — Cyan Beach",
    )) as HTMLInputElement;
    expect(slider.value).toBe("0");

    act(() => {
      client.setQueryData<PlayerProgress>(
        ["progress"],
        makeProgress({ area_bonuses: { "Cyan Beach": 50 } }),
      );
    });

    await waitFor(() => expect(slider.value).toBe("50"));
  });

  it("keeps the slider on the last value sent when two saves resolve out of order", async () => {
    // Control resolution order ourselves: two overlapping sends, the older one
    // (60) settling after the newer one (75) has already landed.
    const resolvers: Array<(value: PlayerProgress) => void> = [];
    vi.spyOn(api, "patchProgress").mockImplementation(
      () => new Promise<PlayerProgress>((resolve) => resolvers.push(resolve)),
    );
    renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    const slider = (await screen.findByLabelText(
      "Area bonus — Cyan Beach",
    )) as HTMLInputElement;

    vi.useFakeTimers();
    fireEvent.change(slider, { target: { value: "60" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300); // sends request A (60)
    });
    fireEvent.change(slider, { target: { value: "75" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300); // sends request B (75), A still outstanding
    });
    expect(resolvers).toHaveLength(2);

    // B, the newer request, resolves first.
    await act(async () => {
      resolvers[1](makeProgress({ area_bonuses: { "Cyan Beach": 75 } }));
      await vi.advanceTimersByTimeAsync(0);
    });
    // A resolves late, carrying its now-stale snapshot.
    await act(async () => {
      resolvers[0](makeProgress({ area_bonuses: { "Cyan Beach": 60 } }));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(slider.value).toBe("75");
  });

  it("follows an external change after a failed save instead of staying pinned", async () => {
    vi.spyOn(api, "patchProgress").mockRejectedValue(new Error("network error"));
    const { client } = renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    const slider = (await screen.findByLabelText(
      "Area bonus — Cyan Beach",
    )) as HTMLInputElement;

    vi.useFakeTimers();
    fireEvent.change(slider, { target: { value: "60" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300); // fires the save, which will reject
      await vi.advanceTimersByTimeAsync(0); // flush the rejection's microtasks
    });

    // An external update arrives after the failed save; the row must follow it.
    act(() => {
      client.setQueryData<PlayerProgress>(
        ["progress"],
        makeProgress({ area_bonuses: { "Cyan Beach": 20 } }),
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // flush the cache notification
    });

    expect(slider.value).toBe("20");
  });

  it("follows a genuine external change after its own save has already succeeded", async () => {
    // The ordinary case: our own send's success is what advances `pct` to 60.
    // A second, genuine external change to 80 must still be picked up afterwards.
    const { client } = renderModal();
    await screen.findByText("33 ingredients");
    await userEvent.click(screen.getByRole("tab", { name: "Areas" }));
    const slider = (await screen.findByLabelText(
      "Area bonus — Cyan Beach",
    )) as HTMLInputElement;

    vi.useFakeTimers();
    fireEvent.change(slider, { target: { value: "60" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300); // fires the debounced save for 60
      await vi.advanceTimersByTimeAsync(0); // flush its resolution into the cache
    });
    expect(slider.value).toBe("60");

    act(() => {
      client.setQueryData<PlayerProgress>(
        ["progress"],
        makeProgress({ area_bonuses: { "Cyan Beach": 80 } }),
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0); // flush the cache notification
    });
    expect(slider.value).toBe("80");
  });
});
