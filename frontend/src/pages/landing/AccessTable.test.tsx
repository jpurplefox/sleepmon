import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ status: "anonymous" as "anonymous" | "authenticated" | "checking" }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ status: auth.status }) }));
vi.mock("../../auth/GoogleSignInButton", () => ({
  GoogleSignInButton: ({ reason }: { reason: string }) => <button type="button">Sign in ({reason})</button>,
}));

import { LanguageProvider } from "../../i18n";
import { AccessTable } from "./AccessTable";

function renderTable() {
  localStorage.setItem("sleepmon.lang", "en");
  render(
    <LanguageProvider>
      <AccessTable />
    </LanguageProvider>,
  );
}

const cells = (feature: string) => {
  const row = screen.getByRole("row", { name: new RegExp(feature) });
  return within(row).getAllByRole("cell").map((c) => c.textContent);
};

beforeEach(() => {
  localStorage.clear();
  auth.status = "anonymous";
});

describe("AccessTable", () => {
  it("marks what works without an account and what needs one", () => {
    renderTable();
    expect(screen.getByRole("columnheader", { name: "Without an account" })).toBeInTheDocument();
    expect(cells("Compare Pokémon")).toEqual(["Included", "Included"]);
    expect(cells("Load Pokémon from screenshots")).toEqual(["Not included", "Included"]);
    expect(cells("Save teams")).toEqual(["Not included", "Included"]);
  });

  it("offers to sign in when signed out, and not when signed in", () => {
    renderTable();
    expect(screen.getByRole("button", { name: "Sign in (landing)" })).toBeInTheDocument();
  });

  it("drops the sign-in when there is already a session", () => {
    auth.status = "authenticated";
    renderTable();
    expect(screen.queryByRole("button", { name: /Sign in/ })).not.toBeInTheDocument();
  });
});
