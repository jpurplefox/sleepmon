import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import { Modal } from "./Modal";

describe("Modal", () => {
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
