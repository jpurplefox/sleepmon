import type { CSSProperties } from "react";

import { useI18n } from "../../i18n";
import { CATCH_STEPS, shotUrl } from "./content";

// Each step's index drives its slot in the shared animation cycle (styles.css).
const at = (i: number) => ({ "--i": i }) as CSSProperties;

/** The catch tile's story: the steps as text, and a stage that plays their captures in turn. */
export function CatchSteps() {
  const { t, lang } = useI18n();
  const last = CATCH_STEPS.length - 1;
  return (
    <>
      <ol className="landing-steps">
        {CATCH_STEPS.map((s, i) => (
          <li key={s.id} className="landing-steps__item" style={at(i)}>
            <span className="landing-steps__num">{i + 1}</span>
            {t(`landing.catch.step.${s.id}`)}
          </li>
        ))}
      </ol>
      <div className="landing-stage">
        {CATCH_STEPS.map((s, i) => (
          <div key={s.id} className={`landing-stage__frame landing-stage__frame--${s.id}`} style={at(i)}>
            {s.shots.map((name) => (
              <img
                key={name}
                className={`landing-stage__shot landing-stage__shot--${name}`}
                src={shotUrl(name, lang)}
                // The last frame is the outcome; the steps above already narrate the rest.
                alt={i === last ? t("landing.case.catch.alt") : ""}
                loading="lazy"
                decoding="async"
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
