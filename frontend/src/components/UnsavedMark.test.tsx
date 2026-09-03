import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider } from "../i18n";
import { UnsavedMark } from "./UnsavedMark";

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderMark(unsaved: boolean) {
  return render(
    <LanguageProvider>
      <UnsavedMark unsaved={unsaved} savedLabel="33" onSave={vi.fn()} />
    </LanguageProvider>,
  );
}

describe("UnsavedMark — leaving", () => {
  it("outlives a save so its exit can play, then drops itself", () => {
    const { rerender } = renderMark(true);
    expect(screen.getByText("unsaved")).toBeInTheDocument();

    act(() => {
      rerender(
        <LanguageProvider>
          <UnsavedMark unsaved={false} savedLabel="36" onSave={vi.fn()} />
        </LanguageProvider>,
      );
    });
    // Still there, but inert: nothing to click, nothing to read out.
    expect(screen.getByText("unsaved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save", hidden: true })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
  });

  it("renders nothing when it was never unsaved", () => {
    renderMark(false);
    expect(screen.queryByText("unsaved")).not.toBeInTheDocument();
  });
});
