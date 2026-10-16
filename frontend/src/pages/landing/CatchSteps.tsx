import { Fragment, useEffect, useState } from "react";

import { useI18n } from "../../i18n";
import { CATCH_STEPS, shotUrl } from "./content";

/** How long each step shows before the next one. */
export const STEP_MS = 5000;

const LAST = CATCH_STEPS.length - 1;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** The catch tile's story: numbered steps that play their captures in turn, or on click. */
export function CatchSteps() {
  const { t, lang } = useI18n();
  const [still] = useState(prefersReducedMotion);
  // Reduced motion opens on the outcome and never advances by itself.
  const [active, setActive] = useState(still ? LAST : 0);
  // Bumped on every click, so picking the current step also restarts its time.
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (still) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % CATCH_STEPS.length), STEP_MS);
    return () => window.clearTimeout(id);
  }, [active, round, still]);

  const pick = (i: number) => {
    setActive(i);
    setRound((r) => r + 1);
  };

  return (
    <>
      <ol className="landing-steps">
        {CATCH_STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className="landing-steps__item"
              aria-current={i === active ? "step" : undefined}
              onClick={() => pick(i)}
            >
              <span className="landing-steps__num">{i + 1}</span>
              {t(`landing.catch.step.${s.id}`)}
              {/* Keyed per round so its fill restarts with the step's time. */}
              {i === active && !still && <span key={round} className="landing-steps__progress" aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ol>
      <div className="landing-stage">
        {CATCH_STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`landing-stage__frame landing-stage__frame--${s.id}` + (i === active ? " is-active" : "")}
            aria-hidden={i === active ? undefined : true}
          >
            {s.shots.map((name, j) => (
              <Fragment key={name}>
                {/* Evolving shows a before and an after. */}
                {s.id === "evolve" && j > 0 && (
                  <span className="landing-stage__arrow" aria-hidden="true">
                    ↓
                  </span>
                )}
                <img
                  className={`landing-stage__shot landing-stage__shot--${name}`}
                  src={shotUrl(name, lang)}
                  // The last frame is the outcome; the steps already narrate the rest.
                  alt={i === LAST ? t("landing.case.catch.alt") : ""}
                  loading="lazy"
                  decoding="async"
                />
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
