import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActionMenu } from "./ActionMenu";
import { IconOpen, IconTrash } from "./icons";

function renderMenu() {
  const onOpen = vi.fn();
  const onDelete = vi.fn();
  render(
    <ActionMenu
      label="Actions for Cyan curry"
      items={[
        { label: "Open in Analysis", icon: <IconOpen />, onSelect: onOpen },
        {
          label: "Delete",
          icon: <IconTrash />,
          tone: "danger",
          separated: true,
          ariaLabel: "Delete Cyan curry",
          onSelect: onDelete,
        },
      ]}
    />,
  );
  return { onOpen, onDelete };
}

describe("ActionMenu", () => {
  it("opens on its trigger and focuses the first item", async () => {
    renderMenu();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Actions for Cyan curry" }));
    expect(screen.getByRole("menuitem", { name: "Open in Analysis" })).toHaveFocus();
  });

  it("sets a destructive item apart and runs it, closing the menu", async () => {
    const { onDelete } = renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Actions for Cyan curry" }));
    expect(screen.getByRole("separator")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete Cyan curry" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Actions for Cyan curry" });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("moves between items with the arrows", async () => {
    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Actions for Cyan curry" }));
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Delete Cyan curry" })).toHaveFocus();
  });
});
