// App-level wiring for Account & privacy (PRD 0018): the footer on every screen, the
// /account gate, and where a successful deletion leaves the user. The tool pages are
// stubbed: their own suites cover them, here only the shell and its routes matter.
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const api = vi.hoisted(() => ({
  listMembers: vi.fn(),
  listSavedTeams: vi.fn(),
  getProgress: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock("./api/client", () => ({ api, __setRefreshHandler: vi.fn() }));

const authApi = vi.hoisted(() => ({
  postRefresh: vi.fn(),
  postGoogle: vi.fn(),
  postLogout: vi.fn(),
}));
vi.mock("./auth/authApi", () => authApi);

vi.mock("./pages/Production", () => ({ Production: () => <h1>Comparison tool</h1> }));
vi.mock("./pages/Teams", () => ({ Teams: () => <h1>Team Analysis tool</h1> }));
vi.mock("./pages/Team", () => ({ Team: () => <h1>Box tool</h1> }));
vi.mock("./pages/SavedTeams", () => ({ SavedTeams: () => <h1>Teams tool</h1> }));

import App from "./App";
import { LanguageProvider } from "./i18n";
import { EMPTY_PROGRESS } from "./progress";
import { HOME, ROUTES } from "./routes";
import { sessionHint, tokenStore } from "./auth/tokenStore";

const USER = { id: "u1", email: "ana@example.com", display_name: "Ana Perez", avatar_url: null };

function renderAt(path: string) {
  const loc = memoryLocation({ path, record: true });
  render(
    <LanguageProvider>
      <Router hook={loc.hook}>
        <App />
      </Router>
    </LanguageProvider>,
  );
  return loc;
}

const footer = () => screen.getByRole("contentinfo");

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("sleepmon.lang", "en");
  Object.values(api).forEach((f) => f.mockReset());
  Object.values(authApi).forEach((f) => f.mockReset());
});
afterEach(() => {
  localStorage.clear();
});

describe("App shell", () => {
  it("shows the footer on a tool", async () => {
    renderAt(ROUTES.compare);
    expect(await screen.findByRole("heading", { name: "Comparison tool" })).toBeInTheDocument();
    expect(within(footer()).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", ROUTES.privacy);
    expect(footer()).toHaveTextContent(/not affiliated with Nintendo/);
  });

  it("shows the footer under a gate card (/box signed out)", async () => {
    renderAt(ROUTES.box);
    expect(await screen.findByText("Your box is where your Pokémon live")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Box tool" })).not.toBeInTheDocument();
    expect(within(footer()).getByRole("link", { name: "Privacy" })).toBeInTheDocument();
  });

  it("shows the sign-in prompt instead of Your account when signed out", async () => {
    renderAt(ROUTES.account);
    expect(await screen.findByText("Your box is where your Pokémon live")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete my account…" })).not.toBeInTheDocument();
    expect(footer()).toBeInTheDocument();
  });

  it("after deleting the account lands on Comparison, signed out, with the confirmation", async () => {
    sessionHint.mark();
    authApi.postRefresh.mockResolvedValue({ access_token: "a-1", user: USER });
    api.listMembers.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);
    api.listSavedTeams.mockResolvedValue([{ id: "t1" }]);
    api.getProgress.mockResolvedValue(EMPTY_PROGRESS);
    api.deleteAccount.mockResolvedValue(undefined);
    const loc = renderAt(ROUTES.account);

    const entry = await screen.findByRole("button", { name: "Delete my account…" });
    await waitFor(() => expect(entry).toBeEnabled());
    await userEvent.click(entry);
    await userEvent.type(screen.getByLabelText(/To confirm, type your email/), USER.email);
    const boxReadsBefore = api.listMembers.mock.calls.length;
    const progressReadsBefore = api.getProgress.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    expect(await screen.findByRole("dialog", { name: "Account deleted" })).toBeInTheDocument();
    const history = loc.history ?? [];
    expect(history[history.length - 1]).toBe(HOME);
    expect(screen.getByRole("heading", { name: "Comparison tool" })).toBeInTheDocument();
    expect(api.deleteAccount).toHaveBeenCalledTimes(1);
    expect(tokenStore.get()).toBeNull();
    expect(sessionHint.present()).toBe(false);
    // Nothing re-reads the deleted Box while the app lands signed out (no 401 storm).
    expect(api.listMembers.mock.calls.length).toBe(boxReadsBefore);
    expect(api.getProgress.mock.calls.length).toBe(progressReadsBefore);
    expect(authApi.postRefresh).toHaveBeenCalledTimes(1);
  });
});
