import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import { Modal } from "./Modal";

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
});

function renderModal(dirty: boolean) {
  const onClose = vi.fn();
  render(
    <LanguageProvider>
      <Modal title="Add" onClose={onClose} dirty={dirty}>
        <input aria-label="Field" defaultValue="typed" />
      </Modal>
    </LanguageProvider>,
  );
  return { onClose };
}

const overlay = () => document.querySelector(".modal-overlay")!;

describe("Modal", () => {
  it("closes straight away when nothing was changed", () => {
    const { onClose } = renderModal(false);
    fireEvent.click(overlay());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe("with unsaved changes", () => {
    it("asks before closing from a tap outside, Escape or ✕, and keeps the form behind", () => {
      const { onClose } = renderModal(true);
      for (const leave of [
        () => fireEvent.click(overlay()),
        () => fireEvent.click(screen.getByRole("button", { name: "Close" })),
      ]) {
        leave();
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole("alertdialog", { name: /discard your changes/i })).toBeInTheDocument();
        // The form stays mounted, so keeping on editing loses nothing.
        expect(screen.getByDisplayValue("typed")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
        expect(screen.queryByRole("alertdialog")).toBeNull();
      }
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });

    it("Escape on the question keeps editing; Discard closes", () => {
      const { onClose } = renderModal(true);
      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(onClose).not.toHaveBeenCalled();

      fireEvent.click(overlay());
      fireEvent.click(screen.getByRole("button", { name: "Discard" }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("gives focus back to its opener on close without scrolling it into view", () => {
    // The opener can live in a swiped deck (the "+" slide): scrolling to it on
    // close would hide the card that was just added.
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const focus = vi.spyOn(opener, "focus");

    const { unmount } = render(
      <LanguageProvider>
        <Modal title="Add" onClose={() => {}}>
          <button type="button">Inside</button>
        </Modal>
      </LanguageProvider>,
    );
    expect(opener).not.toHaveFocus();

    unmount();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
