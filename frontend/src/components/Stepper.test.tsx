import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Stepper } from "./Stepper";

function renderStepper(props: Partial<React.ComponentProps<typeof Stepper>> = {}) {
  const onPrev = vi.fn();
  const onNext = vi.fn();
  render(
    <Stepper
      onPrev={onPrev}
      onNext={onNext}
      prevLabel="Previous"
      nextLabel="Next"
      primary="Charge Strength"
      {...props}
    />,
  );
  return { onPrev, onNext };
}

describe("Stepper", () => {
  it("renders the leading visual, primary and secondary lines", () => {
    render(
      <Stepper
        onPrev={vi.fn()}
        onNext={vi.fn()}
        prevLabel="Previous"
        nextLabel="Next"
        leading={<span data-testid="badge">7</span>}
        primary="Charge Strength"
        secondary="+1 energy"
      />,
    );
    expect(screen.getByTestId("badge")).toHaveTextContent("7");
    expect(screen.getByText("Charge Strength")).toBeInTheDocument();
    expect(screen.getByText("+1 energy")).toBeInTheDocument();
  });

  it("omits the secondary line when none is given", () => {
    renderStepper();
    expect(document.querySelector(".stepper__secondary")).toBeNull();
  });

  it("calls onPrev / onNext when the nav buttons are clicked", () => {
    const { onPrev, onNext } = renderStepper();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPrev).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("disables the buttons at each bound", () => {
    renderStepper({ disablePrev: true, disableNext: false });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });
});
