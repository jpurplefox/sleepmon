import { useEffect, useRef, useState } from "react";

import { useI18n } from "../i18n";

const EXIT_MS = 200;

/** "No leído": a field a screenshot import couldn't read (design-system §6). */
export function UnreadMark({ unread }: { unread: boolean }) {
  const { t } = useI18n();
  const [leaving, setLeaving] = useState(false);
  const wasUnread = useRef(unread);
  // Marks present on the first paint don't animate in.
  const [entered] = useState(unread);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (unread) setLeaving(false);
    else if (wasUnread.current && !reduced) setLeaving(true);
    wasUnread.current = unread;
  }, [unread]);

  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(() => setLeaving(false), EXIT_MS);
    return () => window.clearTimeout(id);
  }, [leaving]);

  if (!unread && !leaving) return null;
  return (
    <span
      className={
        "progress-diff unread-mark" +
        (entered ? " unread-mark--static" : "") +
        (leaving ? " progress-diff--leaving" : "")
      }
      aria-hidden={leaving || undefined}
    >
      <span className="progress-diff__label">{t("import.unread")}</span>
    </span>
  );
}
