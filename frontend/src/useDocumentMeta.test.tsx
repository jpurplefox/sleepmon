import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LanguageProvider, useI18n, type Lang } from "./i18n";
import { UI } from "./i18n/ui";
import { useSiteMeta } from "./useDocumentMeta";

let setLang: (l: Lang) => void = () => {};
function Probe() {
  useSiteMeta();
  setLang = useI18n().setLang;
  return null;
}
const desc = () => document.querySelector('meta[name="description"]')?.getAttribute("content");

afterEach(() => {
  localStorage.clear();
  document.head.querySelectorAll('meta[name="description"]').forEach((m) => m.remove());
});

describe("useSiteMeta", () => {
  it("keeps the title, description and <html lang> in the active language", () => {
    localStorage.setItem("sleepmon.lang", "en");
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    expect(document.title).toBe(UI.en["meta.title"]);
    expect(desc()).toBe(UI.en["meta.description"]);
    expect(document.documentElement.lang).toBe("en");

    act(() => setLang("es"));
    expect(document.title).toBe(UI.es["meta.title"]);
    expect(desc()).toBe(UI.es["meta.description"]);
    expect(document.documentElement.lang).toBe("es");
  });
});
