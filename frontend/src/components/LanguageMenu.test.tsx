import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LanguageProvider } from "../i18n";
import { recordEvents } from "../telemetry/testing";
import { LanguageMenu } from "./LanguageMenu";

let rec: ReturnType<typeof recordEvents>;
beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "es");
  rec = recordEvents();
});
afterEach(() => rec.restore());

describe("LanguageMenu", () => {
  it("shows the current language and switches to the one picked", async () => {
    render(
      <LanguageProvider>
        <LanguageMenu />
      </LanguageProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Idioma" });
    expect(trigger).toHaveTextContent("ES");

    await userEvent.click(trigger);
    expect(screen.getByRole("option", { name: "Español" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("option", { name: "English" }));

    expect(document.documentElement.lang).toBe("en");
    expect(localStorage.getItem("sleepmon.lang")).toBe("en");
    expect(screen.getByRole("button", { name: "Language" })).toHaveTextContent("EN");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(rec.events).toEqual([{ name: "language_changed", props: { language: "en" } }]);
  });

  it("records nothing when the current language is chosen again", async () => {
    render(
      <LanguageProvider>
        <LanguageMenu />
      </LanguageProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Idioma" }));
    await userEvent.click(screen.getByRole("option", { name: "Español" }));

    expect(rec.events).toEqual([]);
  });
});
