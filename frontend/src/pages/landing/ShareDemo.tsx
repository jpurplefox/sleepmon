import { useEffect, useState } from "react";

import { useI18n } from "../../i18n";
import { shotUrl } from "./content";
import { MARKS, Pointer, aim, box, prefersReducedMotion } from "./demo";

/** Phases in ms from the loop's start: 1 pointer to Copy, 2 click, 3 copied, 4 the link lands in a chat. */
export const SHARE_TIMES = [700, 1800, 2100, 3100] as const;
export const SHARE_LOOP_MS = 7500;
const FINAL = SHARE_TIMES.length;
// The demo's link, as the capture script mocks it.
const LINK = "sleepmon.app/c/k3f9xq";

/** The share tile's loop: the real dialog copies its link, which shows up in a chat with its preview. */
export function ShareDemo() {
  const { t, lang } = useI18n();
  const copy = MARKS[lang].shareCopy;
  const [still] = useState(prefersReducedMotion);
  const [loop, setLoop] = useState(0);
  const [reached, setReached] = useState({ loop: 0, phase: 0 });
  const phase = still ? FINAL : reached.loop === loop ? reached.phase : 0;
  const at = (n: number) => phase >= n;

  useEffect(() => {
    if (still) return;
    const ids = SHARE_TIMES.map((ms, k) => window.setTimeout(() => setReached({ loop, phase: k + 1 }), ms));
    ids.push(window.setTimeout(() => setLoop((l) => l + 1), SHARE_LOOP_MS));
    return () => ids.forEach((t) => window.clearTimeout(t));
  }, [loop, still]);

  const img = (name: "share-dialog" | "share-copied" | "share-preview", className = "") => (
    <img className={`landing-stage__shot landing-stage__shot--${name} ${className}`} src={shotUrl(name, lang)} alt="" loading="lazy" decoding="async" />
  );

  return (
    // One description for the whole animation; its pieces are decoration.
    <div className="landing-share" role="img" aria-label={t("landing.case.share.alt")}>
      <div className="landing-demo">
        {img("share-dialog", "landing-demo__base")}
        {img("share-copied", "landing-demo__over" + (at(3) ? " is-on" : ""))}
        <span className={"landing-demo__target" + (at(1) && !at(3) ? " is-on" : "")} style={box(copy)} />
        <Pointer style={at(1) ? aim(copy) : { left: "70%", top: "125%" }} clicking={at(2) && !at(3)} gone={at(4)} />
      </div>
      {/* A generic chat bubble: the link and the preview a messaging app would unfurl. */}
      <div className={"landing-chat" + (at(4) ? " is-on" : "")}>
        {img("share-preview", "landing-chat__preview")}
        <span className="landing-chat__site">sleepmon</span>
        <span className="landing-chat__link">{LINK}</span>
      </div>
    </div>
  );
}
