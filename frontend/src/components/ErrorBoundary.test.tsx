import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));
vi.mock("../telemetry/sentry", () => ({ reportError }));

import { LanguageProvider } from "../i18n";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): never {
  throw new Error("render failed");
}

describe("ErrorBoundary", () => {
  it("reports the error once and shows the fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <LanguageProvider>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </LanguageProvider>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "render failed" }), expect.objectContaining({ componentStack: expect.any(String) }));
  });
});
