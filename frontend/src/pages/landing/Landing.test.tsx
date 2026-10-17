import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

const auth = vi.hoisted(() => ({ status: "unauthenticated" as "unauthenticated" | "authenticated" | "checking" }));
vi.mock("../../auth/AuthContext", () => ({ useAuth: () => ({ status: auth.status }) }));
vi.mock("../../auth/GoogleSignInButton", () => ({
  GoogleSignInButton: ({ reason }: { reason: string }) => <button type="button">Sign in ({reason})</button>,
}));

import { LanguageProvider } from "../../i18n";
import { Landing } from "./Landing";

function renderLanding(lang: "es" | "en" = "en") {
  localStorage.setItem("sleepmon.lang", lang);
  const loc = memoryLocation({ path: "/" });
  return render(
    <LanguageProvider>
      <Router hook={loc.hook}>
        <Landing />
      </Router>
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  auth.status = "unauthenticated";
});

describe("Landing", () => {
  it("leads to Comparison and offers sign-in when signed out", () => {
    renderLanding();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Analyze your Pokémon Sleep team and decide with data.");
    expect(screen.getByRole("link", { name: "Start comparing" })).toHaveAttribute("href", "/compare");
    expect(screen.getByRole("button", { name: "Sign in (landing)" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Go to my box" })).not.toBeInTheDocument();
  });

  it("offers the box instead of sign-in when signed in", () => {
    auth.status = "authenticated";
    renderLanding();
    expect(screen.getByRole("link", { name: "Go to my box" })).toHaveAttribute("href", "/box");
    expect(screen.queryByRole("button", { name: /Sign in/ })).not.toBeInTheDocument();
  });

  it("links each use case to its tool and marks the ones that need an account", () => {
    renderLanding();
    const cases = screen.getAllByRole("article");
    expect(cases).toHaveLength(4);
    expect(cases.map((c) => within(c).getByRole("link").getAttribute("href"))).toEqual([
      "/compare", "/compare", "/team-analysis", "/box",
    ]);
    expect(cases.map((c) => within(c).queryByText("with an account") !== null)).toEqual([true, false, false, true]);
  });

  it("lists nine closed FAQ questions that open on touch", async () => {
    renderLanding();
    const faq = screen.getByRole("region", { name: "Frequently asked questions" });
    const groups = faq.querySelectorAll("details");
    expect(groups).toHaveLength(9);
    groups.forEach((d) => expect(d.open).toBe(false));
    await userEvent.click(within(faq).getByText("How is energy taken into account?"));
    expect(groups[1].open).toBe(true);
  });

  it("links the account answer to the privacy page", () => {
    renderLanding();
    expect(screen.getByRole("link", { name: "privacy page" })).toHaveAttribute("href", "/privacy");
  });

  it("speaks Spanish and shows the Spanish captures", () => {
    renderLanding("es");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Analizá tu equipo de Pokémon Sleep y decidí con datos.");
    expect(screen.getByText("¿Cómo se tiene en cuenta la energía?")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Se copia el link de una comparación y llega a un chat con su vista previa" })).toBeInTheDocument();
    expect(screen.getByAltText("El costo de subir de nivel y lo que gana un Pokémon de la caja")).toHaveAttribute(
      "src",
      "/landing/es/levelup-tip.jpg",
    );
    expect(document.title).toBe("sleepmon — Analizá tu equipo de Pokémon Sleep");
  });
});
