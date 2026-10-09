import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { LanguageProvider } from "../i18n";
import { AppFooter } from "./AppFooter";

function renderFooter(email?: string | null) {
  return render(
    <LanguageProvider>
      <AppFooter email={email} />
    </LanguageProvider>,
  );
}

describe("AppFooter", () => {
  beforeEach(() => localStorage.setItem("sleepmon.lang", "en"));

  it("links to the privacy page", () => {
    renderFooter("hi@example.com");
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });

  it("shows the contact email when configured", () => {
    renderFooter("hi@example.com");
    expect(screen.getByText("hi@example.com")).toBeInTheDocument();
  });

  it("omits the email and its dot when not configured", () => {
    const { container } = renderFooter(null);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it("shows the non-affiliation notice in English", () => {
    renderFooter(null);
    expect(
      screen.getByText(
        "sleepmon is a fan project, not affiliated with Nintendo, Creatures, GAME FREAK or The Pokémon Company. Pokémon and its names are trademarks of their respective owners.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the notice in Spanish", () => {
    localStorage.setItem("sleepmon.lang", "es");
    renderFooter(null);
    expect(screen.getByRole("link", { name: "Privacidad" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "sleepmon es un proyecto de fans, sin afiliación con Nintendo, Creatures, GAME FREAK ni The Pokémon Company. Pokémon y sus nombres son marcas de sus respectivos dueños.",
      ),
    ).toBeInTheDocument();
  });
});
