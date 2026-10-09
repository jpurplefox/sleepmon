import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountSummary } from "../account";
import { ComparisonSessionProvider, useComparisonSession, type ComparisonSession } from "../comparisonSession";
import { newEntry } from "../roster";
import { TeamSessionProvider, useTeamSession, type TeamSession } from "../teamSession";
import type { MemberInput } from "../types";
import { api } from "../api/client";
import { LanguageProvider } from "../i18n";
import { recordEvents } from "../telemetry/testing";
import { AccountDeletedDialog } from "./AccountDeletedDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

const clearSession = vi.fn();
vi.mock("../auth/AuthContext", () => ({ useAuth: () => ({ clearSession }) }));

const EMAIL = "ana@example.com";
const FULL: AccountSummary = { boxSize: 23, savedTeams: 4, hasProfile: true };

let rec: ReturnType<typeof recordEvents>;
beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
  rec = recordEvents();
  clearSession.mockReset();
});
afterEach(() => {
  rec.restore();
  vi.restoreAllMocks();
});

// Exposes both tool sessions, so a test can seed Box-linked entries and read them back.
const sessions: { comparison?: ComparisonSession; team?: TeamSession } = {};
function SessionProbe() {
  sessions.comparison = useComparisonSession();
  sessions.team = useTeamSession();
  return null;
}

function renderDialog(summary: AccountSummary = FULL, client = new QueryClient()) {
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <ComparisonSessionProvider>
          <TeamSessionProvider>
            <SessionProbe />
            <DeleteAccountDialog email={EMAIL} summary={summary} onClose={onClose} onDeleted={onDeleted} />
          </TeamSessionProvider>
        </ComparisonSessionProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  );
  return { onClose, onDeleted };
}

const confirmButton = () => screen.getByRole("button", { name: "Delete permanently" });
const field = () => screen.getByLabelText(/To confirm, type your email/);

describe("DeleteAccountDialog", () => {
  it("lists what is lost, with counts", () => {
    renderDialog();
    expect(
      screen.getByText(/This deletes your account, the/).textContent,
    ).toBe("This deletes your account, the 23 Pokémon in your Box, your 4 saved teams and your Player profile.");
    expect(screen.getByText("23 Pokémon").tagName).toBe("STRONG");
    expect(screen.getByText("It cannot be undone.")).toBeInTheDocument();
  });

  it("uses the singular for one Pokémon and one team", () => {
    renderDialog({ boxSize: 1, savedTeams: 1, hasProfile: true });
    expect(screen.getByText(/This deletes your account/).textContent).toBe(
      "This deletes your account, the 1 Pokémon in your Box, your 1 saved team and your Player profile.",
    );
  });

  it("words an empty account without counts or a profile", () => {
    renderDialog({ boxSize: 0, savedTeams: 0, hasProfile: false });
    expect(screen.getByText(/This deletes your account/).textContent).toBe(
      "This deletes your account, your Box (empty) and your saved teams (none).",
    );
  });

  it("enables the confirm button only once the typed email matches", async () => {
    renderDialog();
    expect(confirmButton()).toBeDisabled();
    await userEvent.type(field(), "ana@exam");
    expect(confirmButton()).toBeDisabled();
    await userEvent.clear(field());
    await userEvent.type(field(), "  Ana@Example.com ");
    expect(confirmButton()).toBeEnabled();
  });

  it("deletes, records the event, clears the session, then the cache, and calls onDeleted", async () => {
    const del = vi.spyOn(api, "deleteAccount").mockResolvedValue(undefined);
    const client = new QueryClient();
    client.setQueryData(["members"], [{ id: "m1" }]);
    const order: string[] = [];
    clearSession.mockImplementation(() => {
      order.push(`clearSession(events=${rec.events.length},cached=${client.getQueryCache().getAll().length})`);
    });
    const { onDeleted } = renderDialog(FULL, client);
    onDeleted.mockImplementation(() => order.push("onDeleted"));
    await userEvent.type(field(), EMAIL);
    await userEvent.click(confirmButton());
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(del).toHaveBeenCalledTimes(1);
    expect(rec.events).toEqual([{ name: "account_deleted", props: { box_size: 23, saved_teams: 4 } }]);
    expect(clearSession).toHaveBeenCalledTimes(1);
    // The event was recorded before the session went away; the cache is emptied after it.
    expect(order).toEqual(["clearSession(events=1,cached=1)", "onDeleted"]);
    expect(client.getQueryData(["members"])).toBeUndefined();
  });

  it("keeps what is on screen in Comparison and Team Analysis, no longer linked to the Box", async () => {
    vi.spyOn(api, "deleteAccount").mockResolvedValue(undefined);
    const config = { species: "Pikachu" } as unknown as MemberInput;
    const { onDeleted } = renderDialog();
    act(() => {
      sessions.comparison!.setEntries([newEntry(config, "box-1"), newEntry(config)]);
      sessions.team!.setSlots([{ entries: [newEntry(config, "box-2"), newEntry(config, "box-3")], share: 0.5 }]);
      sessions.team!.setOpenTeamId("team-1");
    });
    await userEvent.type(field(), EMAIL);
    await userEvent.click(confirmButton());
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));

    const cards = sessions.comparison!.entries;
    expect(cards).toHaveLength(2);
    expect(cards.every((e) => !("sourceId" in e))).toBe(true);
    const slot = sessions.team!.slots[0];
    expect(slot.share).toBe(0.5);
    expect(slot.entries).toHaveLength(2);
    expect(slot.entries.every((e) => !("sourceId" in e))).toBe(true);
    expect(sessions.team!.openTeamId).toBeNull();
  });

  it("leaves the Box links in place when deletion fails", async () => {
    vi.spyOn(api, "deleteAccount").mockRejectedValue(new Error("boom"));
    const config = { species: "Pikachu" } as unknown as MemberInput;
    renderDialog();
    act(() => {
      sessions.comparison!.setEntries([newEntry(config, "box-1")]);
      sessions.team!.setOpenTeamId("team-1");
    });
    await userEvent.type(field(), EMAIL);
    await userEvent.click(confirmButton());
    await screen.findByRole("alert");
    expect(sessions.comparison!.entries[0].sourceId).toBe("box-1");
    expect(sessions.team!.openTeamId).toBe("team-1");
  });

  it("shows an error and keeps the value when deletion fails", async () => {
    vi.spyOn(api, "deleteAccount").mockRejectedValue(new Error("boom"));
    const { onDeleted } = renderDialog();
    await userEvent.type(field(), EMAIL);
    await userEvent.click(confirmButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't confirm the deletion. Check your connection and try again.",
    );
    expect(field()).toHaveValue(EMAIL);
    expect(confirmButton()).toBeEnabled();
    expect(rec.events).toEqual([]);
    expect(clearSession).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("does not close while deleting", async () => {
    let finish: () => void = () => {};
    vi.spyOn(api, "deleteAccount").mockReturnValue(new Promise<void>((r) => (finish = r)));
    const { onClose } = renderDialog();
    await userEvent.type(field(), EMAIL);
    await userEvent.click(confirmButton());
    expect(await screen.findByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(clearSession).toHaveBeenCalled());
  });

  it.each([
    ["Cancel", async () => userEvent.click(screen.getByRole("button", { name: "Cancel" }))],
    ["the close button", async () => userEvent.click(screen.getByRole("button", { name: "Close" }))],
    ["Escape", async () => userEvent.keyboard("{Escape}")],
  ])("%s closes without calling the API", async (_label, close) => {
    const del = vi.spyOn(api, "deleteAccount");
    const { onClose } = renderDialog();
    await userEvent.type(field(), "ana@");
    await close();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();
  });
});

describe("AccountDeletedDialog", () => {
  it("confirms the deletion and closes with Got it", async () => {
    const onClose = vi.fn();
    render(
      <LanguageProvider>
        <AccountDeletedDialog onClose={onClose} />
      </LanguageProvider>,
    );
    expect(screen.getByRole("dialog", { name: "Account deleted" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["the close button", async () => userEvent.click(screen.getByRole("button", { name: "Close" }))],
    ["Escape", async () => userEvent.keyboard("{Escape}")],
  ])("closes with %s", async (_label, act) => {
    const onClose = vi.fn();
    render(
      <LanguageProvider>
        <AccountDeletedDialog onClose={onClose} />
      </LanguageProvider>,
    );
    await act();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
