import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AccountSummary } from "../account";
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
  clearSession.mockClear();
});
afterEach(() => {
  rec.restore();
  vi.restoreAllMocks();
});

function renderDialog(summary: AccountSummary = FULL) {
  const onClose = vi.fn();
  const onDeleted = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LanguageProvider>
        <DeleteAccountDialog email={EMAIL} summary={summary} onClose={onClose} onDeleted={onDeleted} />
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
      "This deletes your account, your Box (empty) and no saved teams.",
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

  it("deletes, records the event, then clears the session and calls onDeleted", async () => {
    const del = vi.spyOn(api, "deleteAccount").mockResolvedValue(undefined);
    const { onDeleted } = renderDialog();
    await userEvent.type(field(), EMAIL);
    await userEvent.click(confirmButton());
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(del).toHaveBeenCalledTimes(1);
    expect(rec.events).toEqual([{ name: "account_deleted", props: { box_size: 23, saved_teams: 4 } }]);
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it("shows an error and keeps the value when deletion fails", async () => {
    vi.spyOn(api, "deleteAccount").mockRejectedValue(new Error("boom"));
    const { onDeleted } = renderDialog();
    await userEvent.type(field(), EMAIL);
    await userEvent.click(confirmButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't delete the account. Check your connection and try again; nothing was deleted.",
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

  it("Cancel closes without calling the API", async () => {
    const del = vi.spyOn(api, "deleteAccount");
    const { onClose } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
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
});
