import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Fragment, StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

import { api, ApiError } from "../api/client";
import { ComparisonSessionProvider } from "../comparisonSession";
import { __resetShareCacheForTests } from "../comparisonShare";
import { LanguageProvider } from "../i18n";
import { recordEvents } from "../telemetry/testing";
import type { Catalog, ComparisonShare, MemberInput, Production as ProductionData, Species } from "../types";

const auth = vi.hoisted(() => ({ status: "authenticated" as "authenticated" | "anonymous" }));
const gate = vi.hoisted(() => ({ guard: vi.fn((f: () => void) => f()) }));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ status: auth.status }) }));
vi.mock("../auth/useGate", () => ({ useGate: () => gate }));
const ts = vi.hoisted(() => ({ token: vi.fn(async () => "tok"), key: "site" }));
vi.mock("../turnstile", () => ({
  get TURNSTILE_SITE_KEY() {
    return ts.key;
  },
  renderTurnstile: ts.token,
}));
// Drawing needs a real browser: here the picture is a stand-in.
const image = vi.hoisted(() => ({
  png: new Blob(["png"], { type: "image/png" }),
  download: vi.fn(),
  canCopy: true,
}));
vi.mock("../shareImage", () => ({
  drawSheet: vi.fn(async () => ({}) as HTMLCanvasElement),
  sheetPng: vi.fn(async () => image.png),
  previewJpegBase64: vi.fn(async () => "SlBFRw=="),
  downloadBlob: image.download,
  canCopyImage: () => image.canCopy,
}));

import * as shareImage from "../shareImage";
import { Production } from "./Production";

const species = (name: string, dex: number): Species => ({
  name,
  dex,
  specialty: "Berries",
  berry: "Grepa",
  type: "Electric",
  sleep_type: "Dozing",
  main_skill: "Charge Strength S",
  ingredient_slots: [["Fancy Apple"], ["Fancy Apple"], ["Fancy Apple"]],
  ingredient_amounts: [[1], [2], [3]],
  base_inventory: 20,
  evolutions: [],
  previous_stage: null,
});

const catalog = {
  natures: [],
  sub_skills: [],
  ingredients: ["Fancy Apple"],
  species: [species("Pikachu", 25), species("Raichu", 26)],
  recipe_level_bonus: [1],
  ingredient_strengths: {},
  islands: [],
  pot_ladder: [],
} as unknown as Catalog;

const config = (name: string, level: number): MemberInput => ({
  species: name,
  level,
  nature: "",
  ingredients: ["Fancy Apple", "Fancy Apple", "Fancy Apple"],
  sub_skills: [],
  ribbon: "",
  skill_level: 1,
});

const share: ComparisonShare = {
  id: "abc123def456",
  url: "https://sleepmon.app/s/abc123def456",
  members: [config("Pikachu", 30), config("Raichu", 40)],
  island: null,
  favorites: ["Grepa"],
  weekly_bonus: "berry_strength",
  sleep: { night_minutes: 420, nap_minutes: 120 },
};

// A real /production response (the one ProductionCard.test uses).
const production = {
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
} as unknown as ProductionData;

function renderAt(path: string, strict = false) {
  const location = memoryLocation({ path, record: true });
  const Wrap = strict ? StrictMode : Fragment;
  render(
    <Wrap>
      <QueryClientProvider client={new QueryClient()}>
        <LanguageProvider>
          <ComparisonSessionProvider>
            <Router hook={location.hook} searchHook={location.searchHook}>
              <Production />
            </Router>
          </ComparisonSessionProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </Wrap>,
  );
  return location;
}

let recorder: ReturnType<typeof recordEvents>;
beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
  // Anonymous: the cards compute with the default night, no profile to wait for.
  auth.status = "anonymous";
  ts.key = "site";
  HTMLElement.prototype.scrollTo = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
  URL.createObjectURL = () => "blob:picture";
  URL.revokeObjectURL = () => {};
  vi.spyOn(api, "getCatalog").mockResolvedValue(catalog);
  vi.spyOn(api, "listMembers").mockResolvedValue([]);
  vi.spyOn(api, "getProgress").mockReturnValue(new Promise(() => {}));
  vi.spyOn(api, "computeProduction").mockResolvedValue(production);
  recorder = recordEvents();
});

afterEach(() => {
  recorder.restore();
  vi.restoreAllMocks();
  gate.guard.mockClear();
  ts.token.mockClear();
  image.download.mockClear();
  image.canCopy = true;
});

describe("Opening a shared link", () => {
  it("opens the shared cards and map terms, then drops the query", async () => {
    const getShare = vi.spyOn(api, "getComparisonShare").mockResolvedValue(share);
    const location = renderAt("/compare?share=abc123def456");

    await waitFor(() => expect(screen.getAllByText("Raichu").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Pikachu").length).toBeGreaterThan(0);
    expect(getShare).toHaveBeenCalledWith("abc123def456");
    await waitFor(() => expect(location.history[location.history.length - 1]).toBe("/compare"));
    expect(recorder.events).toContainEqual({ name: "shared_comparison_opened", props: { cards: 2 } });
  });

  it("says so when the share doesn't exist", async () => {
    vi.spyOn(api, "getComparisonShare").mockRejectedValue(new Error("404"));
    renderAt("/compare?share=missing");

    expect(await screen.findByText(/doesn't exist or has expired/)).toBeInTheDocument();
  });
});

describe("Share placements and the sleep notice", () => {
  it("offers Share in the header and in the pager", async () => {
    vi.spyOn(api, "getComparisonShare").mockResolvedValue(share);
    renderAt("/compare?share=abc123def456");
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Share" })).toHaveLength(2));
    expect(document.querySelector(".tool-head__action--wide button")).not.toBeNull();
    expect(document.querySelector(".swipe-pager__action button")).not.toBeNull();
  });

  it("disables Share while a card is calculating", async () => {
    vi.spyOn(api, "computeProduction").mockReturnValue(new Promise(() => {}));
    vi.spyOn(api, "getComparisonShare").mockResolvedValue(share);
    renderAt("/compare?share=abc123def456");
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Share" })).toHaveLength(2));
    for (const b of screen.getAllByRole("button", { name: "Share" })) expect(b).toBeDisabled();
  });

  it("disables Share while a map change recomputes the numbers, then enables it", async () => {
    vi.spyOn(api, "getComparisonShare").mockResolvedValue(share);
    renderAt("/compare?share=abc123def456");
    await waitFor(() => {
      for (const b of screen.getAllByRole("button", { name: "Share" })) expect(b).toBeEnabled();
    });

    let finish!: (p: ProductionData) => void;
    vi.spyOn(api, "computeProduction").mockReturnValue(new Promise((r) => (finish = r)));
    // Dropping the shared favorite berry changes the map the numbers depend on.
    await userEvent.click(screen.getByRole("button", { name: /Favorite berries/ }));
    await userEvent.click(screen.getByRole("button", { name: "Grepa" }));

    await waitFor(() => {
      for (const b of screen.getAllByRole("button", { name: "Share" })) expect(b).toBeDisabled();
    });
    finish(production);
    await waitFor(() => {
      for (const b of screen.getAllByRole("button", { name: "Share" })) expect(b).toBeEnabled();
    });
  });

  it("drops the sleep notice when every card is removed", async () => {
    vi.spyOn(api, "getComparisonShare").mockResolvedValue(share);
    renderAt("/compare?share=abc123def456");
    await screen.findByText(/The person who shared this comparison sleeps/);

    while (screen.queryAllByRole("button", { name: "Remove" }).length > 0) {
      await userEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    }

    expect(screen.queryByText(/The person who shared this comparison sleeps/)).toBeNull();
  });

  it("points out a different sleep schedule, and x closes it", async () => {
    vi.spyOn(api, "getComparisonShare").mockResolvedValue(share);
    renderAt("/compare?share=abc123def456");
    const notice = await screen.findByText(/The person who shared this comparison sleeps/);
    expect(notice.textContent).toBe(
      "The person who shared this comparison sleeps in two sessions (night 7:00 and nap 2:00) and you in one session of 8:30, so the values shown may not match theirs.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/The person who shared this comparison sleeps/)).toBeNull();
  });

  it("signed in: waits for the profile's schedule before comparing", async () => {
    auth.status = "authenticated";
    let resolve!: (v: never) => void;
    vi.spyOn(api, "getProgress").mockReturnValue(new Promise((r) => (resolve = r as never)));
    vi.spyOn(api, "getComparisonShare").mockResolvedValue(share);
    renderAt("/compare?share=abc123def456");
    await waitFor(() => expect(screen.getAllByText("Raichu").length).toBeGreaterThan(0));
    expect(screen.queryByText(/The person who shared this comparison sleeps/)).toBeNull();
    resolve({ sleep: { night_minutes: 600, nap_minutes: null } } as never);
    const notice = await screen.findByText(/The person who shared this comparison sleeps/);
    expect(notice.textContent).toContain("you in one session of 10:00");
  });

  it("says nothing when the schedules match", async () => {
    vi.spyOn(api, "getComparisonShare").mockResolvedValue({ ...share, sleep: { night_minutes: 510, nap_minutes: null } });
    renderAt("/compare?share=abc123def456");
    await waitFor(() => expect(screen.getAllByText("Raichu").length).toBeGreaterThan(0));
    expect(screen.queryByText(/The person who shared this comparison sleeps/)).toBeNull();
  });
});

describe("Sharing the comparison", () => {
  const created = { ...share, id: "new", url: "https://sleepmon.app/s/new" };
  let clipboard: { writeText: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn> };
  class FakeClipboardItem {
    constructor(readonly items: Record<string, Blob>) {}
  }

  beforeEach(() => {
    __resetShareCacheForTests();
    clipboard = { writeText: vi.fn(async () => {}), write: vi.fn(async () => {}) };
    Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
    vi.stubGlobal("ClipboardItem", FakeClipboardItem);
  });
  afterEach(() => vi.unstubAllGlobals());

  async function openDialog(opened = true, strict = false) {
    if (opened) {
      vi.spyOn(api, "getComparisonShare").mockResolvedValue(share);
      renderAt("/compare?share=abc123def456", strict);
    }
    const button = await screen.findAllByRole("button", { name: "Share" }).then((b) => b[0]);
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    return screen.getByRole("dialog");
  }
  const section = (dialog: HTMLElement, name: "Image" | "Link") => within(dialog).getByRole("group", { name });
  const linkField = (dialog: HTMLElement) => within(section(dialog, "Link")).findByRole("textbox");

  it("draws every card side by side, whatever the screen", async () => {
    vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    await openDialog();

    const sheet = document.querySelector(".share-sheet") as HTMLElement;
    expect(sheet.querySelectorAll(".prod-card--snapshot")).toHaveLength(2);
    // A picture has nothing to tap: no action bar, no reorder, no "Make base".
    expect(within(sheet).queryByRole("button", { name: /edit/i })).toBeNull();
    expect(within(sheet).queryByText("Make base")).toBeNull();
    expect(within(sheet).getByText("Base")).toBeInTheDocument();
  });

  it("orders the dialog: preview, then the image, then the link, with no note", async () => {
    vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    const dialog = await openDialog();
    const image = section(dialog, "Image");
    const link = section(dialog, "Link");
    const preview = dialog.querySelector(".share-dialog__preview")!;
    expect(preview.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(image.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      within(link).getByText(
        "Anyone who opens it sees the comparison in sleepmon and can change levels, natures or the map to try their own variants.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/shows this image when shared/)).toBeNull();
  });

  it("copies the picture to the clipboard", async () => {
    vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    const dialog = await openDialog();
    const copy = within(section(dialog, "Image")).getByRole("button", { name: "Copy" });
    await waitFor(() => expect(copy).toBeEnabled());

    await userEvent.click(copy);

    expect(clipboard.write).toHaveBeenCalledOnce();
    const [items] = clipboard.write.mock.calls[0] as [FakeClipboardItem[]];
    expect(items[0]).toBeInstanceOf(FakeClipboardItem);
    expect(items[0].items).toEqual({ "image/png": image.png });
    expect(await within(section(dialog, "Image")).findByRole("button", { name: "Copied!" })).toBeInTheDocument();
    expect(recorder.events).toContainEqual({ name: "comparison_shared", props: { kind: "image", cards: 2 } });
  });

  it("offers no image Copy where the browser can't copy images", async () => {
    image.canCopy = false;
    vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    const dialog = await openDialog();
    expect(within(section(dialog, "Image")).queryByRole("button", { name: "Copy" })).toBeNull();
    expect(within(section(dialog, "Image")).getByRole("button", { name: "Download" })).toBeInTheDocument();
  });

  it("downloads the picture", async () => {
    vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    const dialog = await openDialog();
    const download = within(section(dialog, "Image")).getByRole("button", { name: "Download" });
    await waitFor(() => expect(download).toBeEnabled());

    await userEvent.click(download);

    expect(image.download).toHaveBeenCalledWith(image.png, "sleepmon-comparison.png");
    expect(recorder.events).toContainEqual({ name: "comparison_shared", props: { kind: "image", cards: 2 } });
  });

  it("signed out: the link is ready when the dialog opens, after the human check", async () => {
    const create = vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    const dialog = await openDialog();

    expect(await linkField(dialog)).toHaveValue("https://sleepmon.app/s/new");
    expect(gate.guard).not.toHaveBeenCalled();
    expect(ts.token).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    const body = create.mock.calls[0][0];
    expect(body.verification_token).toBe("tok");
    expect(body.sleep).toEqual({ night_minutes: 510, nap_minutes: null });
    expect(body.members.map((m) => m.species)).toEqual(["Pikachu", "Raichu"]);
    expect(body.favorites).toEqual(["Grepa"]);
    expect(body.language).toBe("en");
    expect(body.image).toEqual({ media_type: "image/jpeg", data: "SlBFRw==" });
    // Nothing is tracked until the link is actually copied.
    expect(recorder.events.filter((e) => e.name === "comparison_shared")).toEqual([]);
  });

  it("creates the link only once, even under StrictMode", async () => {
    const create = vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    const dialog = await openDialog(true, true);
    expect(await linkField(dialog)).toHaveValue("https://sleepmon.app/s/new");
    expect(create).toHaveBeenCalledOnce();
    expect(ts.token).toHaveBeenCalledOnce();
  });

  it("says it's creating the link meanwhile, with Copy disabled", async () => {
    let finish!: (s: ComparisonShare) => void;
    vi.spyOn(api, "createComparisonShare").mockReturnValue(new Promise((r) => (finish = r)));
    const dialog = await openDialog();
    const link = section(dialog, "Link");

    expect(await within(link).findByText("Creating link…")).toBeInTheDocument();
    expect(within(link).getByRole("button", { name: "Copy" })).toBeDisabled();
    finish(created);
    expect(await linkField(dialog)).toHaveValue("https://sleepmon.app/s/new");
    expect(within(link).getByRole("button", { name: "Copy" })).toBeEnabled();
  });

  it("signed in: creates the link without a human check", async () => {
    auth.status = "authenticated";
    vi.spyOn(api, "getProgress").mockResolvedValue({ sleep: { night_minutes: 510, nap_minutes: null } } as never);
    const create = vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    const dialog = await openDialog();

    expect(await linkField(dialog)).toHaveValue("https://sleepmon.app/s/new");
    expect(ts.token).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].verification_token).toBeNull();
  });

  it("Copy copies the link and says so; the link is tracked once", async () => {
    vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    const dialog = await openDialog();
    await linkField(dialog);
    const link = section(dialog, "Link");

    await userEvent.click(within(link).getByRole("button", { name: "Copy" }));
    expect(clipboard.writeText).toHaveBeenCalledWith("https://sleepmon.app/s/new");
    expect(await within(link).findByRole("button", { name: "Copied!" })).toBeInTheDocument();

    await userEvent.click(within(link).getByRole("button", { name: "Copied!" }));
    expect(clipboard.writeText).toHaveBeenCalledTimes(2);
    expect(
      recorder.events.filter((e) => e.name === "comparison_shared" && e.props.kind === "link"),
    ).toEqual([{ name: "comparison_shared", props: { kind: "link", cards: 2 } }]);
  });

  it("reopening on the same comparison shows the same link without creating another", async () => {
    const create = vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    let dialog = await openDialog();
    await linkField(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    dialog = await openDialog(false);

    expect(await linkField(dialog)).toHaveValue("https://sleepmon.app/s/new");
    expect(create).toHaveBeenCalledOnce();
    expect(ts.token).toHaveBeenCalledOnce();
  });

  it("closing and reopening mid-creation awaits the same request instead of creating a second link", async () => {
    let finish!: (s: ComparisonShare) => void;
    const create = vi.spyOn(api, "createComparisonShare").mockReturnValue(new Promise((r) => (finish = r)));
    let dialog = await openDialog();
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    dialog = await openDialog(false);
    expect(await within(section(dialog, "Link")).findByText("Creating link…")).toBeInTheDocument();
    finish(created);

    expect(await linkField(dialog)).toHaveValue("https://sleepmon.app/s/new");
    expect(create).toHaveBeenCalledOnce();
    expect(ts.token).toHaveBeenCalledOnce();
  });

  it("says it's creating the link even before the picture is drawn", async () => {
    let draw!: (c: HTMLCanvasElement) => void;
    vi.mocked(shareImage.drawSheet).mockReturnValueOnce(new Promise((r) => (draw = r)));
    vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    const dialog = await openDialog();

    expect(within(section(dialog, "Link")).getByText("Creating link…")).toBeInTheDocument();
    draw({} as HTMLCanvasElement);
    expect(await linkField(dialog)).toHaveValue("https://sleepmon.app/s/new");
  });

  it("hides the Link section when the picture can't be drawn", async () => {
    vi.mocked(shareImage.drawSheet).mockRejectedValueOnce(new Error("draw"));
    const create = vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    const dialog = await openDialog();

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/draw|picture|image/i);
    expect(within(dialog).queryByRole("group", { name: "Link" })).toBeNull();
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("announces the creating text and the copies to assistive tech", async () => {
    let finish!: (s: ComparisonShare) => void;
    vi.spyOn(api, "createComparisonShare").mockReturnValue(new Promise((r) => (finish = r)));
    const dialog = await openDialog();
    const link = section(dialog, "Link");
    expect(await within(link).findByText("Creating link…")).toHaveAttribute("role", "status");

    finish(created);
    await linkField(dialog);
    const live = link.querySelector(".sr-only[role='status']") as HTMLElement;
    expect(live).toHaveTextContent("");
    await userEvent.click(within(link).getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(live).toHaveTextContent("Copied!"));
    expect(live).toHaveAttribute("aria-live", "polite");

    const imageLive = section(dialog, "Image").querySelector(".sr-only[role='status']") as HTMLElement;
    await userEvent.click(within(section(dialog, "Image")).getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(imageLive).toHaveTextContent("Copied!"));
  });

  it("changing the map terms makes the next dialog create a new link", async () => {
    const create = vi
      .spyOn(api, "createComparisonShare")
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce({ ...share, id: "newer", url: "https://sleepmon.app/s/newer" });
    let dialog = await openDialog();
    await linkField(dialog);
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    await userEvent.click(screen.getByRole("button", { name: /Favorite berries/ }));
    await userEvent.click(screen.getByRole("button", { name: "Grepa" }));
    dialog = await openDialog(false);

    await waitFor(async () => expect(await linkField(dialog)).toHaveValue("https://sleepmon.app/s/newer"));
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0].favorites).toEqual([]);
  });

  it("a failed human check says so with Try again, which retries", async () => {
    ts.token.mockRejectedValueOnce(new Error("verification"));
    const create = vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    const dialog = await openDialog();
    const link = section(dialog, "Link");

    expect(await within(link).findByText("We couldn't verify you're not a bot.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    await userEvent.click(within(link).getByRole("button", { name: "Try again" }));

    expect(await linkField(dialog)).toHaveValue("https://sleepmon.app/s/new");
    expect(ts.token).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledOnce();
  });

  it("a 403 from the server reads as a failed check", async () => {
    vi.spyOn(api, "createComparisonShare").mockRejectedValue(new ApiError("verification failed", 403, null));
    const dialog = await openDialog();
    expect(await within(section(dialog, "Link")).findByText("We couldn't verify you're not a bot.")).toBeInTheDocument();
  });

  it("any other failure says the link couldn't be created; the image still works", async () => {
    vi.spyOn(api, "createComparisonShare").mockRejectedValue(new Error("500"));
    const dialog = await openDialog();
    const link = section(dialog, "Link");
    expect(await within(link).findByText("Couldn't create the link.")).toBeInTheDocument();
    expect(within(link).getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(within(section(dialog, "Image")).getByRole("button", { name: "Download" })).toBeEnabled();
  });

  it("no site key: asks to sign in, then creates the link without any human check", async () => {
    ts.key = "";
    const create = vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    const dialog = await openDialog();
    const signIn = await within(section(dialog, "Link")).findByRole("button", { name: "Sign in to create the link" });
    expect(create).not.toHaveBeenCalled();

    // The gate holds the action while the user signs in; it runs afterwards.
    let pending: (() => void) | undefined;
    gate.guard.mockImplementationOnce((f: () => void) => {
      pending = f;
    });
    await userEvent.click(signIn);
    expect(gate.guard).toHaveBeenCalledWith(expect.any(Function), "share_link");
    expect(create).not.toHaveBeenCalled();

    auth.status = "authenticated";
    pending!();

    expect(await linkField(dialog)).toHaveValue("https://sleepmon.app/s/new");
    expect(ts.token).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].verification_token).toBeNull();
    expect(within(dialog).queryByText(/verify/)).toBeNull();
  });

  it("the picture's strip names the sleep and sleepmon.app", async () => {
    vi.spyOn(api, "createComparisonShare").mockResolvedValue(created);
    await openDialog();
    const sheet = document.querySelector(".share-sheet") as HTMLElement;
    expect(within(sheet).getByText("Sleep 8:30")).toBeInTheDocument();
    expect(within(sheet).getByText("sleepmon.app")).toBeInTheDocument();
  });
});
