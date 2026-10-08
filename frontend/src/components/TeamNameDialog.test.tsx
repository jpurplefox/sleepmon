import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import { newEntry } from "../roster";
import type { MemberInput, SavedTeam } from "../types";
import { TeamNameDialog } from "./TeamNameDialog";

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
});

const config: MemberInput = {
  species: "Pikachu",
  level: 30,
  nature: "",
  ingredients: ["Fancy Apple", "Warming Ginger", "Fancy Egg"],
  sub_skills: [],
  ribbon: "",
  skill_level: 1,
};

const existing = { id: "t1", name: "Cyan curry" } as SavedTeam;

function renderDialog(props: Partial<Parameters<typeof TeamNameDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  render(
    <LanguageProvider>
      <TeamNameDialog
        title="Save team"
        initialName=""
        teams={[existing]}
        ownId={null}
        confirmLabel="Save"
        pending={false}
        serverError={null}
        onConfirm={onConfirm}
        onClose={vi.fn()}
        {...props}
      />
    </LanguageProvider>,
  );
  return { onConfirm };
}

describe("TeamNameDialog", () => {
  it("refuses an empty name", async () => {
    const { onConfirm } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a name.");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("refuses a name another team uses, ignoring case", async () => {
    const { onConfirm } = renderDialog();
    await userEvent.type(screen.getByLabelText("Name"), "CYAN curry");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("You already have a team with that name.");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("accepts the team's own name when renaming", async () => {
    const { onConfirm } = renderDialog({ initialName: "Cyan curry", ownId: "t1" });
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onConfirm).toHaveBeenCalledWith("Cyan curry");
  });

  it("lists what goes to the Box before saving", () => {
    renderDialog({
      writes: [
        { entry: newEntry(config), kind: "new" },
        { entry: newEntry({ ...config, species: "Bulbasaur" }, "b"), kind: "update" },
      ],
    });
    expect(screen.getByText("To save the team, these Pokémon go to your Box:")).toBeInTheDocument();
    expect(screen.getByText("Pikachu").nextSibling).toHaveTextContent("new");
    expect(screen.getByText("Bulbasaur").nextSibling).toHaveTextContent("update");
  });

  it("hides the name field when saving over the open team", async () => {
    const { onConfirm } = renderDialog({ initialName: null, ownId: "t1" });
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
