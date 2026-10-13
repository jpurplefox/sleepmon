import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { InfoNotice } from "./InfoNotice";

describe("InfoNotice", () => {
  it("shows its text and closes with ×", async () => {
    const onDismiss = vi.fn();
    render(
      <InfoNotice icon={<svg data-testid="icon" />} onDismiss={onDismiss} dismissLabel="Dismiss">
        Hello
      </InfoNotice>,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
