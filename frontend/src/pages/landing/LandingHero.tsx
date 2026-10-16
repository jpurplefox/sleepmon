import { Link } from "wouter";

import { useAuth } from "../../auth/AuthContext";
import { GoogleSignInButton } from "../../auth/GoogleSignInButton";
import { IconCheck } from "../../components/icons";
import { useI18n } from "../../i18n";
import { ROUTES } from "../../routes";
import { shotUrl } from "./content";

const FACTS = ["landing.fact.compare", "landing.fact.teams", "landing.fact.screenshot", "landing.fact.candies"];

/** Pitch, the two ways in, and three Comparison cards fanned like a hand. */
export function LandingHero() {
  const { t, lang } = useI18n();
  const { status } = useAuth();
  return (
    <section className="landing-hero">
      <div className="landing-hero__copy">
        <h1 className="landing-hero__title">
          {t("landing.title.lead")} <span className="landing-hero__accent">{t("landing.title.accent")}</span>
        </h1>
        <p className="landing-hero__lead">{t("landing.lead")}</p>
        <div className="landing-hero__actions">
          <Link href={ROUTES.compare} className="btn btn--primary">
            {t("landing.cta.compare")}
          </Link>
          {status === "authenticated" ? (
            <Link href={ROUTES.box} className="btn btn--ghost">
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
      </div>
    </section>
  );
}
