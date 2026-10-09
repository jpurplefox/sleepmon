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
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    // jsdom re-reports errors thrown during render as uncaught window errors,
    // which it prints to the console. Cancelling the event keeps output quiet.
    const silenceWindowError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", silenceWindowError);
    try {
      render(
        <LanguageProvider>
          <ErrorBoundary>
            <Boom />
          </ErrorBoundary>
        </LanguageProvider>,
      );
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "render failed" }),
        expect.objectContaining({ componentStack: expect.any(String) }),
      );
    } finally {
      window.removeEventListener("error", silenceWindowError);
      consoleError.mockRestore();
    }
  });
});
