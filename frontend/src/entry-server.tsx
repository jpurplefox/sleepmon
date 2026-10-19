// Server entry for the build-time prerender of "/" (ADR-0013); never shipped to browsers.
import { renderToString } from "react-dom/server";
import { Router } from "wouter";

import App from "./App";
import { LanguageProvider, type Lang } from "./i18n";
import { faqJsonLd } from "./pages/landing/faqJsonLd";

export const PRERENDER_LANG: Lang = "en";

export function render(): { html: string; jsonLd: string } {
  const html = renderToString(
    <LanguageProvider initialLang={PRERENDER_LANG}>
      <Router ssrPath="/">
        <App />
      </Router>
    </LanguageProvider>,
  );
  // "<" escaped so the data can never close its <script>.
  const jsonLd = JSON.stringify(faqJsonLd(PRERENDER_LANG)).replace(/</g, "\\u003c");
  return { html, jsonLd };
}
