import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { LanguageProvider } from "../i18n";
import { Privacy } from "./Privacy";

function renderPage(email?: string | null) {
  return render(
    <LanguageProvider>
      <Privacy email={email} />
    </LanguageProvider>,
  );
}

describe("Privacy", () => {
  beforeEach(() => localStorage.setItem("sleepmon.lang", "en"));

  it("renders the title, the date and five sections in English", () => {
    renderPage("hi@example.com");
    expect(screen.getByRole("heading", { level: 1, name: "Privacy" })).toBeInTheDocument();
    expect(screen.getByText("Last updated: October 9, 2026")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5);
  });

  it("formats the date in Spanish", () => {
    localStorage.setItem("sleepmon.lang", "es");
    renderPage("hi@example.com");
    expect(screen.getByRole("heading", { level: 1, name: "Privacidad" })).toBeInTheDocument();
    expect(screen.getByText("Última actualización: 9 de octubre de 2026")).toBeInTheDocument();
  });

  it("shows the email when given and links to the account page", () => {
    renderPage("hi@example.com");
    expect(screen.getAllByText(/hi@example\.com/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Your account" })).toHaveAttribute("href", "/account");
  });

  it("omits email sentences when none is configured", () => {
    renderPage(null);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it.each(["en", "es"])("words the cookie, the deletion and sent reports accurately (%s)", (lang) => {
    localStorage.setItem("sleepmon.lang", lang);
    const { container } = renderPage("hi@example.com");
    const text = container.textContent ?? "";
    // The refresh cookie lasts for weeks: a sign-in cookie, not a session cookie.
    expect(text).toMatch(lang === "en" ? /a sign-in cookie/ : /una cookie de inicio de sesión/);
    expect(text).not.toMatch(/session cookie|cookie de sesión/);
    // Already-sent metrics stay with the providers, tied to an orphaned id.
    expect(text).toMatch(
      lang === "en"
        ? /already sent stay with those providers, tied to an id that no longer belongs to anyone/
        : /ya enviados quedan en esas herramientas, asociados a un identificador que ya no corresponde a nadie/,
    );
    // No "…." where the button label ends a sentence.
    expect(text).not.toMatch(/…\./);
  });
});
