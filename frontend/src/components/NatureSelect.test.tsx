import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { LanguageProvider } from "../i18n";
import type { Nature } from "../types";
import { NatureSelect } from "./NatureSelect";

const natures: Nature[] = [
  { name: "Hardy", neutral: true, increased: null, decreased: null },
  { name: "Brave", neutral: false, increased: "Speed of Help", decreased: "EXP Gains" },
];

beforeEach(() => {
  localStorage.setItem("sleepmon.lang", "en");
});

describe("NatureSelect", () => {
  it("shows the chosen nature's name outside its effects-only pill", () => {
    render(
      <LanguageProvider>
        <NatureSelect natures={natures} value="Brave" onChange={() => {}} />
      </LanguageProvider>,
    );
    const trigger = screen.getByRole("button");
    const pill = trigger.querySelector(".nature-pill");
    expect(trigger).toHaveTextContent("Brave");
    expect(pill).not.toBeNull();
    expect(pill).not.toHaveTextContent("Brave");
    expect(screen.getByRole("img", { name: "Raises: Speed of Help" })).toBeInTheDocument();
  });
});
