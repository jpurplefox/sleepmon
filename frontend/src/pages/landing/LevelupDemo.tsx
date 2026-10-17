import { useEffect, useState } from "react";

import { useI18n } from "../../i18n";
import { shotUrl } from "./content";
import { MARKS, Pointer, aim, box, prefersReducedMotion } from "./demo";

const ROW_MS = 450;
export const LEVELUP_LOOP_MS = 9000;

/** Phases in ms: 1 pointer to the level-up cell, 2 tap, 3 the gains open, then one per gain row lit. */
export function levelupTimes(rows: number): number[] {
  return [600, 1600, 1900, ...Array.from({ length: rows }, (_, k) => 2500 + k * ROW_MS)];
}

/** The level-up tile's loop: a phone Box entry opens what the next unlock costs and gains. */
export function LevelupDemo() {
  const { t, lang } = useI18n();
  const { levelupCell: cell, levelupRows: rows } = MARKS[lang];
  const times = levelupTimes(rows.length);
  const [still] = useState(prefersReducedMotion);
  const [loop, setLoop] = useState(0);
  const [reached, setReached] = useState({ loop: 0, phase: 0 });
  const phase = still ? times.length : reached.loop === loop ? reached.phase : 0;
  const at = (n: number) => phase >= n;

  useEffect(() => {
    if (still) return;
    const ids = times.map((ms, k) => window.setTimeout(() => setReached({ loop, phase: k + 1 }), ms));
    ids.push(window.setTimeout(() => setLoop((l) => l + 1), LEVELUP_LOOP_MS));
    return () => ids.forEach((id) => window.clearTimeout(id));
    // `times` follows from the marks, fixed per language.
  }, [loop, still]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // One description for the whole animation; its pieces are decoration.
    <div className="landing-levelup" role="img" aria-label={t("landing.case.levelup.alt")}>
      <div className="landing-demo">
        <img className="landing-stage__shot landing-demo__base" src={shotUrl("levelup-entry", lang)} alt="" loading="lazy" decoding="async" />
        <span className={"landing-demo__target" + (at(1) && !at(3) ? " is-on" : "")} style={box(cell)} />
        {/* The gains open just above the tapped cell, as on a phone. */}
        <div className={"landing-levelup__tip" + (at(3) ? " is-on" : "")} style={{ bottom: `${100 - cell.y + 1}%` }}>
          <img className="landing-stage__shot" src={shotUrl("levelup-tip", lang)} alt="" loading="lazy" decoding="async" />
          {rows.map((r, k) => (
            <span key={k} className={"landing-levelup__row" + (at(4 + k) ? " is-on" : "")} style={box(r)} />
          ))}
        </div>
        <Pointer style={at(1) ? aim(cell) : { left: "80%", top: "112%" }} clicking={at(2) && !at(3)} gone={at(3)} />
      </div>
    </div>
  );
}
