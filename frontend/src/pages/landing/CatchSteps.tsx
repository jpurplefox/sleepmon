import { useEffect, useState } from "react";

import { useI18n } from "../../i18n";
import { CATCH_STEPS, shotUrl, type CatchStepId, type ShotName } from "./content";
import { MARKS, Pointer, aim, box, prefersReducedMotion } from "./demo";

/** How long each step shows before the next one; the animated ones get more time. */
export const STEP_DURATIONS: Record<CatchStepId, number> = {
  upload: 5000,
  evolve: 6000,
  pick: 5500,
  settings: 8000,
  compare: 8000,
};

const HOVER_MS = 450;

/** When each phase of a step starts, in ms from the step's start; the phase is how many have passed. */
export function timeline(id: CatchStepId, mapTarget: number): number[] {
  switch (id) {
    // 1 first screenshot spins in, 2 the second, 3 the reading sweeps over them.
    case "upload":
      return [300, 1000, 1900];
    // 1 pointer to the evolve button, 2 click, 3 evolved.
    case "evolve":
      return [400, 1600, 2000];
    // 1 pointer to the Box suggestion, 2 hover, 3 click, 4 picked.
    case "pick":
      return [400, 1500, 1900, 2300];
    // One phase per map the pointer passes on its way down to the target, then click, then applied.
    case "settings": {
      const hovers = Array.from({ length: mapTarget }, (_, k) => 900 + k * HOVER_MS);
      const atTarget = 900 + mapTarget * HOVER_MS;
      return [...hovers, atTarget + 300, atTarget + 900];
    }
    // 1 the newcomer slides in, 2 strength lights up, 3 it takes the front.
    case "compare":
      return [700, 1900, 3400];
    default:
      return [];
  }
}

const LAST = CATCH_STEPS.length - 1;

/** The catch tile's story: numbered steps that play their captures in turn, or on click. */
export function CatchSteps() {
  const { t, lang } = useI18n();
  const marks = MARKS[lang];
  const [still] = useState(prefersReducedMotion);
  // Reduced motion opens on the outcome, every step at its final phase, and never advances.
  const [active, setActive] = useState(still ? LAST : 0);
  // Bumped on every click, so picking the current step also restarts it.
  const [round, setRound] = useState(0);
  // A phase belongs to one run of one step, so a new run paints from phase 0.
  const run = `${active}-${round}`;
  const [reached, setReached] = useState({ run, phase: 0 });

  const id = CATCH_STEPS[active].id;
  const times = timeline(id, marks.maps.target);
  const phase = still ? times.length : reached.run === run ? reached.phase : 0;

  useEffect(() => {
    if (still) return;
    const ids = times.map((ms, k) => window.setTimeout(() => setReached({ run, phase: k + 1 }), ms));
    ids.push(window.setTimeout(() => setActive((a) => (a + 1) % CATCH_STEPS.length), STEP_DURATIONS[id]));
    return () => ids.forEach((t) => window.clearTimeout(t));
    // `times` and `id` follow from `run`.
  }, [run, still]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (i: number) => {
    setActive(i);
    setRound((r) => r + 1);
  };

  const img = (name: ShotName, className = "", alt = "") => (
    <img
      className={`landing-stage__shot landing-stage__shot--${name} ${className}`}
      src={shotUrl(name, lang)}
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  );

  // One frame per step, drawn at phase `p` (inactive frames wait at 0).
  const frame = (step: CatchStepId, p: number) => {
    const at = (n: number) => p >= n;
    switch (step) {
      case "upload":
        return (
          <div className={"landing-upload" + [1, 2, 3].map((n) => (at(n) ? ` is-p${n}` : "")).join("")}>
            {img("game-1")}
            {img("game-2")}
            <span className="landing-upload__scan" aria-hidden="true" />
          </div>
        );
      case "evolve":
        return (
          <div className="landing-demo">
            {img("catch-evolve-before", "landing-demo__base")}
            {img("catch-evolve-after", "landing-demo__over" + (at(3) ? " is-on" : ""))}
            <span className={"landing-demo__target" + (at(1) && !at(3) ? " is-on" : "")} style={box(marks.evolve)} aria-hidden="true" />
            <Pointer style={at(1) ? aim(marks.evolve) : { left: "88%", top: "118%" }} clicking={at(2) && !at(3)} gone={at(3)} />
          </div>
        );
      case "pick":
        return (
          <div className="landing-demo">
            {img("catch-pick", "landing-demo__base")}
            <span
              className={"landing-demo__row" + (at(2) ? " is-hover" : "") + (at(4) ? " is-picked" : "")}
              style={box(marks.pick)}
              aria-hidden="true"
            />
            <span
              className={"landing-demo__check" + (at(4) ? " is-on" : "")}
              style={{ left: `${marks.pick.x + marks.pick.w - 7}%`, top: `${marks.pick.y + 6}%` }}
              aria-hidden="true"
            >
              ✓
            </span>
            <Pointer style={at(1) ? aim(marks.pick) : { left: "92%", top: "125%" }} clicking={at(3) && !at(4)} gone={at(4)} />
          </div>
        );
      case "settings": {
        const { options, target } = marks.maps;
        const hover = options[Math.min(p, target)];
        const applied = at(target + 2);
        return (
          <>
            <div className={"landing-demo landing-stage__layer" + (applied ? " is-off" : "")}>
              {img("catch-map-list", "landing-demo__base")}
              <span className={"landing-demo__hover" + (at(target + 1) ? " is-picked" : "")} style={box(hover)} aria-hidden="true" />
              <Pointer style={aim(hover)} clicking={at(target + 1) && !applied} />
            </div>
            <div className={"landing-stage__layer landing-stage__layer--column" + (applied ? "" : " is-off")}>
              {img("catch-map")}
              {img("catch-settings")}
            </div>
          </>
        );
      }
      case "compare":
        return (
          <div className={"landing-duel" + [1, 2, 3].map((n) => (at(n) ? ` is-p${n}` : "")).join("")}>
            <div className="landing-duel__card landing-duel__card--rival">
              {img("catch-card-rival")}
              <span className="landing-duel__glow landing-duel__glow--down" style={box(marks.rivalStrength)} aria-hidden="true" />
            </div>
            <div className="landing-duel__card landing-duel__card--base">
              {/* The outcome; the steps already narrate the rest. */}
              {img("catch-card-base", "", t("landing.case.catch.alt"))}
              <span className="landing-duel__glow landing-duel__glow--up" style={box(marks.baseStrength)} aria-hidden="true" />
            </div>
          </div>
        );
    }
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
              {/* Keyed per run so its fill restarts with the step. */}
              {i === active && !still && (
                <span
                  key={run}
                  className="landing-steps__progress"
                  style={{ animationDuration: `${STEP_DURATIONS[s.id]}ms` }}
                  aria-hidden="true"
                />
              )}
            </button>
          </li>
        ))}
      </ol>
      <div className="landing-stage">
        {CATCH_STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`landing-stage__frame landing-stage__frame--${s.id}` + (i === active ? " is-active" : "")}
            data-phase={i === active ? phase : undefined}
            aria-hidden={i === active ? undefined : true}
          >
            {/* Remounted per run, so a restarted step begins from its first pose instead of rewinding. */}
            <div key={i === active ? run : "idle"} className="landing-stage__content">
              {frame(s.id, i === active ? phase : 0)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
