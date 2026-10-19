import { describe, expect, it } from "vitest";

import { UI } from "../../i18n/ui";
import { FAQ_ITEMS, REPO_URL } from "./content";
import { faqJsonLd } from "./faqJsonLd";

describe("faqJsonLd", () => {
  it("lists every FAQ question in order, in the given language", () => {
    const data = faqJsonLd("en");
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity.map((q) => q.name)).toEqual(FAQ_ITEMS.map((i) => UI.en[`landing.faq.${i.id}.q`]));
    expect(data.mainEntity[0].acceptedAnswer.text).toBe(UI.en["landing.faq.why.a"]);
  });

  it("writes an answer's link as its label and URL", () => {
    const free = faqJsonLd("en").mainEntity[FAQ_ITEMS.length - 1].acceptedAnswer.text;
    expect(free).not.toContain("{link}");
    expect(free).toContain(`${UI.en["landing.faq.free.link"]} (${REPO_URL})`);
  });
});
