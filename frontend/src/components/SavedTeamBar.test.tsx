import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import { SavedTeamBar } from "./SavedTeamBar";

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
});

function renderBar(props: Partial<Parameters<typeof SavedTeamBar>[0]> = {}) {
  render(
    <LanguageProvider>
      <SavedTeamBar
        teamName={null}
        unsaved={false}
        saving={false}
        canSave
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onRename={vi.fn()}
        onClose={vi.fn()}
        {...props}
      />
    </LanguageProvider>,
  );
}

describe("SavedTeamBar", () => {
  it("offers Save team for a team not yet saved", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Save team" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Save as…" })).not.toBeInTheDocument();
  });

  it("can't save a team with no members", () => {
    renderBar({ canSave: false });
    expect(screen.getByRole("button", { name: "Save team" })).toBeDisabled();
  });

  it("shows the open team, and Save only once it is unsaved", () => {
    renderBar({ teamName: "Cyan curry" });
    expect(screen.getByRole("button", { name: "Rename “Cyan curry”" })).toHaveTextContent("Cyan curry");
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save as…" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Close team" })).toBeInTheDocument();
  });

  it("marks an open team with changes as unsaved", () => {
    renderBar({ teamName: "Cyan curry", unsaved: true });
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });
});
