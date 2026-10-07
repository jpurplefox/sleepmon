import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { LanguageProvider } from "../i18n";
import { LanguageMenu } from "./LanguageMenu";

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "es");
});

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
  });
});
