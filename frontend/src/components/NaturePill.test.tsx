import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { LanguageProvider } from "../i18n";
import type { Nature } from "../types";
import { NaturePill } from "./NaturePill";

const brave: Nature = { name: "Brave", neutral: false, increased: "Speed of Help", decreased: "EXP Gains" };
const hardy: Nature = { name: "Hardy", neutral: true, increased: null, decreased: null };

const renderPill = (nature: Nature | undefined, name?: string) =>
  render(
    <LanguageProvider>
      <NaturePill nature={nature} name={name} />
    </LanguageProvider>,
  );

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
});

describe("NaturePill", () => {
  it("names the raised and lowered stats, then the nature", () => {
    renderPill(brave, "Brave");
    expect(screen.getByRole("img", { name: "Raises: Speed of Help" })).toHaveAttribute("src", "/nature/speed.svg");
    expect(screen.getByRole("img", { name: "Lowers: EXP Gains" })).toHaveAttribute("src", "/nature/exp.svg");
    expect(screen.getByText("Brave")).toBeInTheDocument();
  });

  it("marks a neutral nature as having no effect on either side", () => {
    renderPill(hardy);
    expect(screen.getAllByTitle("No effect")).toHaveLength(2);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("keeps its shape without a nature, so rows stay aligned", () => {
    const { container } = renderPill(undefined);
    expect(container.querySelector(".nature-pill--empty")).not.toBeNull();
    expect(container.querySelectorAll(".nature-pill__mark")).toHaveLength(2);
  });
});
