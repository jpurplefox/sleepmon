import { useEffect, useState } from "react";

import { useI18n } from "../../i18n";
import { shotUrl, type ShotName } from "./content";
import { MARKS, Pointer, aim, box, prefersReducedMotion, type LevelupMark } from "./demo";

const ROW_MS = 400;
// After its last gain lights up, a card's gains stay open this long before closing.
const HOLD_MS = 1600;
// The pause between one card closing and the next one's pointer setting off.
const GAP_MS = 500;

/**
 * One card's phases, in ms from `start`: 1 pointer to its level-up cell, 2 tap, 3 the gains
 * open, then one per gain row lit; the card closes `HOLD_MS` after the last.
 */
function cardTimes(start: number, rows: number): number[] {
  return [start + 1200, start + 2100, start + 2400, ...Array.from({ length: rows }, (_, k) => start + 2900 + k * ROW_MS)];
}

/** Both cards' phases one after the other, with a "close" phase between; and the loop's length. */
export function levelupSchedule(rowCounts: readonly number[]) {
  const times: number[] = [];
  const firstPhase: number[] = [];
  let start = 0;
  for (const rows of rowCounts) {
    firstPhase.push(times.length);
    const own = cardTimes(start, rows);
    times.push(...own);
    const close = own[own.length - 1] + HOLD_MS;
    times.push(close);
    start = close + GAP_MS - 1200;
  }
  return { times, firstPhase, loopMs: times[times.length - 1] + 1200 };
}

function LevelupCard({ n, mark, phase, closed }: { n: number; mark: LevelupMark; phase: number; closed: boolean }) {
  const { lang } = useI18n();
  const at = (k: number) => !closed && phase >= k;
  // One band per row, all as wide as the widest: rows differ only by their delta pill.
  const left = Math.min(...mark.rows.map((r) => r.x));
  const right = Math.max(...mark.rows.map((r) => r.x + r.w));
  const src = (name: ShotName) => shotUrl(name, lang);
  return (
    <div className="landing-levelup">
      <div className="landing-demo">
        <img className="landing-stage__shot landing-demo__base" src={src(n === 1 ? "levelup-entry-1" : "levelup-entry-2")} alt="" loading="lazy" decoding="async" />
        <span className={"landing-demo__target" + (at(1) && !at(3) ? " is-on" : "")} style={box(mark.cell)} />
        {/* The gains open just above the tapped cell, as on a phone. */}
        <div className={"landing-levelup__tip" + (at(3) ? " is-on" : "")} style={{ bottom: `${100 - mark.cell.y + 1}%` }}>
          <img className="landing-stage__shot" src={src(n === 1 ? "levelup-tip-1" : "levelup-tip-2")} alt="" loading="lazy" decoding="async" />
          {mark.rows.map((r, k) => (
            <span key={k} className={"landing-levelup__row" + (at(4 + k) ? " is-on" : "")} style={box({ ...r, x: left, w: right - left })} />
          ))}
        </div>
        {/* Hidden until its card's turn, so only one pointer is ever on screen; it fades in as it sets off. */}
        <Pointer style={at(1) ? aim(mark.cell) : { left: "80%", top: "112%" }} clicking={at(2) && !at(3)} gone={!at(1) || at(3)} />
      </div>
    </div>
  );
}

/** The level-up tile's loop: two phone Box entries, each opening what its next unlock costs and gains. */
export function LevelupDemo() {
  const { t, lang } = useI18n();
  const cards = MARKS[lang].levelup;
  const { times, firstPhase, loopMs } = levelupSchedule(cards.map((c) => c.rows.length));
  const [still] = useState(prefersReducedMotion);
  const [loop, setLoop] = useState(0);
  const [reached, setReached] = useState({ loop: 0, phase: 0 });
  const phase = still ? Infinity : reached.loop === loop ? reached.phase : 0;

  useEffect(() => {
    if (still) return;
    const ids = times.map((ms, k) => window.setTimeout(() => setReached({ loop, phase: k + 1 }), ms));
    ids.push(window.setTimeout(() => setLoop((l) => l + 1), loopMs));
    return () => ids.forEach((id) => window.clearTimeout(id));
    // `times` follows from the marks, fixed per language.
  }, [loop, still]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // One description for the whole animation; its pieces are decoration.
    <div className="landing-levelup-pair" role="img" aria-label={t("landing.case.levelup.alt")}>
      {cards.map((mark, i) => {
        // Each card counts its own phases; it closes once the next card's run begins.
        const own = phase - firstPhase[i];
        const closeAt = mark.rows.length + 4;
        return (
          <LevelupCard
            key={i}
            n={i + 1}
            mark={mark}
            phase={still ? closeAt - 1 : Math.max(0, own)}
            closed={!still && own >= closeAt}
          />
        );
      })}
    </div>
  );
}
