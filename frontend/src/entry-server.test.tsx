// @vitest-environment node
// No DOM here: anything rendered at "/" touching window, document or localStorage throws (ADR-0013).
import { describe, expect, it } from "vitest";

import { render } from "./entry-server";
import { UI } from "./i18n/ui";
import { ACCESS_ROWS, FAQ_ITEMS, USE_CASES } from "./pages/landing/content";

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

describe("render (no DOM)", () => {
  it("writes the whole landing in English", () => {
    const page = text(render().html);
    const has = (key: string) => expect(page).toContain(UI.en[key].split("{link}")[0].trim());
    has("landing.title.lead");
    USE_CASES.forEach((c) => has(`landing.case.${c.id}.title`));
    ACCESS_ROWS.forEach((r) => has(`landing.access.row.${r.id}`));
    FAQ_ITEMS.forEach((i) => {
      has(`landing.faq.${i.id}.q`);
      has(`landing.faq.${i.id}.a`);
    });
  });

  it("escapes the FAQ data for an inline script", () => {
    const { jsonLd } = render();
    expect(jsonLd).not.toContain("<");
    expect(JSON.parse(jsonLd)["@type"]).toBe("FAQPage");
  });
});
