import "@fontsource-variable/sora";

import { useI18n } from "../../i18n";
import { useDocumentMeta } from "../../useDocumentMeta";
import { FAQ_ID } from "./content";
import { Faq } from "./Faq";
import { LandingHero } from "./LandingHero";
import { UseCases } from "./UseCases";
import { useHashScroll } from "./useHashScroll";

/** The public page at "/" (PRD 0023): what sleepmon is for, and its FAQ. */
export function Landing() {
  const { t } = useI18n();
  useDocumentMeta({ title: t("landing.meta.title"), description: t("landing.meta.description") });
  useHashScroll(FAQ_ID);
  return (
    <div className="landing">
      <div className="landing__inner">
        <LandingHero />
        <UseCases />
        <Faq />
      </div>
    </div>
  );
}
