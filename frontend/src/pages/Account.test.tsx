import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listSavedTeams: vi.fn(),
  getProgress: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock("../api/client", () => ({ api }));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u1", display_name: "Ana Perez", email: "ana@example.com", avatar_url: null },
    clearSession: vi.fn(),
  }),
}));

import { ComparisonSessionProvider } from "../comparisonSession";
import { LanguageProvider } from "../i18n";
import { EMPTY_PROGRESS } from "../progress";
import { TeamSessionProvider } from "../teamSession";
import { Account } from "./Account";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <ComparisonSessionProvider>
          <TeamSessionProvider>
            <Account onDeleted={vi.fn()} />
          </TeamSessionProvider>
        </ComparisonSessionProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe("Account", () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.listMembers.mockResolvedValue(Array.from({ length: 23 }, (_, i) => ({ id: String(i) })));
    api.listSavedTeams.mockResolvedValue([{}, {}, {}, {}]);
    api.getProgress.mockResolvedValue({ ...EMPTY_PROGRESS, pot_size: 40 });
  });

  it("shows the identity and what is saved", async () => {
    renderPage();
    expect(screen.getByText("Ana Perez")).toBeInTheDocument();
    expect(screen.getByText(/ana@example\.com/)).toBeInTheDocument();
    expect(await screen.findByText("23 Pokémon")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveAttribute("href", "/privacy");
  });

  it("reads Empty / None / Not saved for a brand-new account", async () => {
    api.listMembers.mockResolvedValue([]);
    api.listSavedTeams.mockResolvedValue([]);
    api.getProgress.mockResolvedValue(EMPTY_PROGRESS);
    renderPage();
    expect(await screen.findByText("Empty")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.getByText("Not saved")).toBeInTheDocument();
  });

  it("shows a dash, an error and a retry when the counts fail to load", async () => {
    api.listMembers.mockRejectedValueOnce(new Error("boom"));
    renderPage();
    expect(await screen.findByText("Couldn't load your data.")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(1);
    expect(screen.getByText("4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("23 Pokémon")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load your data.")).not.toBeInTheDocument();
  });

  it("opens the delete dialog from the delete entry", async () => {
    renderPage();
    await screen.findByText("23 Pokémon");
    expect(screen.queryByText("Delete your account", { selector: "h1, h2" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete my account…" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByRole("dialog")).toHaveTextContent("Delete your account");
    expect(screen.getByRole("dialog")).toHaveTextContent("23 Pokémon");
  });

  const deleteEntry = () => screen.getByRole("button", { name: "Delete my account…" });
  const NEEDS_DATA = "Load your data to delete your account.";

  it.each([
    ["the Box", () => api.listMembers.mockReturnValue(new Promise(() => {}))],
    ["the saved teams", () => api.listSavedTeams.mockReturnValue(new Promise(() => {}))],
    ["the Player profile", () => api.getProgress.mockReturnValue(new Promise(() => {}))],
  ])("keeps the delete entry disabled while loading %s", async (_label, hang) => {
    hang();
    renderPage();
    expect(deleteEntry()).toBeDisabled();
    // The two other queries settle; the entry still waits for the third.
    await waitFor(() => expect(screen.getAllByText("…")).toHaveLength(1));
    expect(deleteEntry()).toBeDisabled();
    expect(screen.queryByText(NEEDS_DATA)).not.toBeInTheDocument();
    fireEvent.click(deleteEntry());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["the Box", () => api.listMembers.mockRejectedValueOnce(new Error("boom"))],
    ["the saved teams", () => api.listSavedTeams.mockRejectedValueOnce(new Error("boom"))],
    ["the Player profile", () => api.getProgress.mockRejectedValueOnce(new Error("boom"))],
  ])("disables the delete entry with a hint when loading %s fails, until Retry loads it", async (_label, fail) => {
    fail();
    renderPage();
    expect(await screen.findByText(NEEDS_DATA)).toBeInTheDocument();
    expect(deleteEntry()).toBeDisabled();
    expect(deleteEntry()).toHaveAccessibleDescription(NEEDS_DATA);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(deleteEntry()).toBeEnabled());
    expect(screen.queryByText(NEEDS_DATA)).not.toBeInTheDocument();
    fireEvent.click(deleteEntry());
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("23 Pokémon"));
    expect(screen.getByRole("dialog")).toHaveTextContent("your 4 saved teams");
  });
});
