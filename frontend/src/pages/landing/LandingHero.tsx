import { Link } from "wouter";

import { useAuth } from "../../auth/AuthContext";
import { GoogleSignInButton } from "../../auth/GoogleSignInButton";
import { IconCheck } from "../../components/icons";
import { useI18n } from "../../i18n";
import { ROUTES } from "../../routes";
import { spriteUrl } from "../../sprites";
import { shotUrl } from "./content";

const SNORLAX_DEX = 143;
const FACTS = ["landing.fact.noAccount", "landing.fact.sleep", "landing.fact.languages"];

/** Pitch, the two ways in, and three Comparison cards fanned like a hand. */
export function LandingHero() {
  const { t, lang } = useI18n();
  const { status } = useAuth();
  return (
    <section className="landing-hero">
      <div className="landing-hero__copy">
        <span className="landing-eyebrow">
          <img src={spriteUrl(SNORLAX_DEX)} alt="" width={22} height={22} />
          {t("landing.eyebrow")}
        </span>
        <h1 className="landing-hero__title">
          {t("landing.title.lead")} <span className="landing-hero__accent">{t("landing.title.accent")}</span>
        </h1>
        <p className="landing-hero__lead">{t("landing.lead")}</p>
        <div className="landing-hero__actions">
          <Link href={ROUTES.compare} className="btn btn--primary landing-btn">
            {t("landing.cta.compare")}
          </Link>
          {status === "authenticated" ? (
            <Link href={ROUTES.box} className="btn btn--ghost landing-btn">
              {t("landing.cta.box")}
            </Link>
          ) : status === "checking" ? (
            <div className="auth-slot-placeholder" aria-hidden="true" />
          ) : (
            <GoogleSignInButton reason="landing" />
          )}
        </div>
        <ul className="landing-facts">
          {FACTS.map((key) => (
            <li key={key}>
              <IconCheck aria-hidden="true" />
              {t(key)}
            </li>
          ))}
        </ul>
      </div>
      <div className="landing-fan" aria-hidden="true">
        <img className="landing-shot landing-fan__side landing-fan__left" src={shotUrl("hero-card-1", lang)} alt="" />
        <img className="landing-shot landing-fan__center" src={shotUrl("hero-card-2", lang)} alt="" />
        <img className="landing-shot landing-fan__side landing-fan__right" src={shotUrl("hero-card-3", lang)} alt="" />
        <span className="landing-callout landing-fan__callout">
          <span className="landing-callout__up">▲</span>
          {t("landing.callout.delta")}
        </span>
      </div>
    </section>
  );
}
