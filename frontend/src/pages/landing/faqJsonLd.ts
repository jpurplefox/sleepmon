import { translate, type Lang } from "../../i18n";
import { FAQ_ITEMS } from "./content";

export interface FaqPage {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: { "@type": "Question"; name: string; acceptedAnswer: { "@type": "Answer"; text: string } }[];
}

/** The FAQ as schema.org FAQPage data, from the same copy the page shows. */
export function faqJsonLd(lang: Lang): FaqPage {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => {
      let text = translate(lang, `landing.faq.${item.id}.a`);
      if (item.link) text = text.split("{link}").join(`${translate(lang, item.link.labelKey)} (${item.link.href})`);
      return {
        "@type": "Question",
        name: translate(lang, `landing.faq.${item.id}.q`),
        acceptedAnswer: { "@type": "Answer", text },
      };
    }),
  };
}
