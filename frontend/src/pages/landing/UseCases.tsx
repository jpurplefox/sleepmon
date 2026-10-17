import { Link } from "wouter";

import { IconUser } from "../../components/icons";
import { useI18n } from "../../i18n";
import { CatchSteps } from "./CatchSteps";
import { LevelupDemo } from "./LevelupDemo";
import { ShareDemo } from "./ShareDemo";
import { USE_CASES, shotUrl, type ShotName, type UseCaseId } from "./content";

// Each tile's captures: the first carries the case's alt text, the rest are decoration.
// The catch, share and level-up tiles play their own animated demos instead.
const SHOTS: Record<UseCaseId, readonly ShotName[]> = {
  catch: [],
  share: [],
  plan: ["team-totals", "team-card-1", "team-card-2", "team-card-3"],
  levelup: [],
};

/** The bento: four things a player wants to know, each shown with real captures. */
export function UseCases() {
  const { t, lang } = useI18n();
  return (
    <section className="landing-cases" aria-labelledby="landing-cases-title">
      <div className="landing-section-head">
        <h2 id="landing-cases-title">{t("landing.cases.title")}</h2>
        <span>{t("landing.cases.subtitle")}</span>
      </div>
      <div className="landing-bento">
        {USE_CASES.map((c) => (
          <article key={c.id} className={`landing-tile landing-tile--${c.id}`}>
            <div className="landing-tile__copy">
              {c.needsAccount && (
                <span className="landing-account">
                  <IconUser aria-hidden="true" />
                  {t("landing.withAccount")}
                </span>
              )}
              <h3>{t(`landing.case.${c.id}.title`)}</h3>
              <p>{t(`landing.case.${c.id}.body`)}</p>
              <Link href={c.to} className="landing-tile__go">
                {t(c.linkKey)}
              </Link>
            </div>
            {SHOTS[c.id].map((name, i) => (
              <img
                key={name}
                className={`landing-shot landing-shot--${name}`}
                src={shotUrl(name, lang)}
                alt={i === 0 ? t(`landing.case.${c.id}.alt`) : ""}
                loading="lazy"
                decoding="async"
              />
            ))}
            {c.id === "catch" && <CatchSteps />}
            {c.id === "share" && <ShareDemo />}
            {c.id === "levelup" && <LevelupDemo />}
          </article>
        ))}
      </div>
    </section>
  );
}
