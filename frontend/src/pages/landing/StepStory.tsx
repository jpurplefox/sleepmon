import { useEffect, useState, type ReactNode } from "react";

import { prefersReducedMotion } from "./demo";

/** One step of a story: its label, how long it shows, when its phases start, and how it draws at a phase. */
export interface Step {
  id: string;
  label: string;
  durationMs: number;
  // ms from the step's start at which each phase begins; the phase is how many have passed.
  times: readonly number[];
  render: (phase: number) => ReactNode;
}

/**
 * A landing story: numbered steps beside a stage that plays the active step's phases, then moves
 * on by itself; any step can be picked with a click. Reduced motion opens on the last step, every
 * step drawn at its final phase, and never advances on its own.
 */
export function StepStory({ steps }: { steps: readonly Step[] }) {
  const last = steps.length - 1;
  const [still] = useState(prefersReducedMotion);
  const [active, setActive] = useState(still ? last : 0);
  // Bumped on every click, so picking the current step also restarts it.
  const [round, setRound] = useState(0);
  // A phase belongs to one run of one step, so a new run paints from phase 0.
  const run = `${active}-${round}`;
  const [reached, setReached] = useState({ run, phase: 0 });

  const step = steps[active];
  const phase = still ? step.times.length : reached.run === run ? reached.phase : 0;

  useEffect(() => {
    if (still) return;
    const ids = step.times.map((ms, k) => window.setTimeout(() => setReached({ run, phase: k + 1 }), ms));
    ids.push(window.setTimeout(() => setActive((a) => (a + 1) % steps.length), step.durationMs));
    return () => ids.forEach((t) => window.clearTimeout(t));
    // `step` follows from `run`.
  }, [run, still]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (i: number) => {
    setActive(i);
    setRound((r) => r + 1);
  };

  return (
    <>
      <ol className="landing-steps">
        {steps.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className="landing-steps__item"
              aria-current={i === active ? "step" : undefined}
              onClick={() => pick(i)}
            >
              <span className="landing-steps__num">{i + 1}</span>
              <span className="landing-steps__label">{s.label}</span>
              {/* Keyed per run so its fill restarts with the step. */}
              {i === active && !still && (
                <span key={run} className="landing-steps__progress" style={{ animationDuration: `${s.durationMs}ms` }} aria-hidden="true" />
              )}
            </button>
          </li>
        ))}
      </ol>
      <div className="landing-stage">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={`landing-stage__frame landing-stage__frame--${s.id}` + (i === active ? " is-active" : "")}
            data-phase={i === active ? phase : undefined}
            aria-hidden={i === active ? undefined : true}
          >
            {/* Remounted per run, so a restarted step begins from its first pose instead of rewinding. */}
            <div key={i === active ? run : "idle"} className="landing-stage__content">
              {s.render(i === active ? phase : 0)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
