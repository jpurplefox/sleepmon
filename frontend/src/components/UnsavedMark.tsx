import { useEffect, useRef, useState } from "react";

import { useI18n } from "../i18n";
import { Tooltip } from "./Tooltip";

interface Props {
  /** False renders nothing at all — no pill, no placeholder, no reserved space. */
  unsaved: boolean;
  /** The saved value, already formatted (e.g. "35%"). Shown in the tooltip. */
  savedLabel: string;
  onSave: () => void;
}

/** Long enough to outlast `leave-out` (0.15s), short enough not to linger. */
const EXIT_MS = 200;

/**
 * Marks a value changed but not saved into Player progress, and offers to save it.
 * The saved value lives in the tooltip rather than beside the control: the same mark
 * repeats across nine areas and seventy recipes.
 *
 * It outlives its own `unsaved` by one animation: React dropping it the instant a
 * save landed made it — and the line it sits on — vanish without a frame of
 * transition. While leaving it is inert: not clickable, not focusable, not read out.
 */
export function UnsavedMark({ unsaved, savedLabel, onSave }: Props) {
  const { t } = useI18n();
  const [leaving, setLeaving] = useState(false);
  const wasUnsaved = useRef(unsaved);

  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (unsaved) {
      setLeaving(false);
    } else if (wasUnsaved.current && !reduced) {
      setLeaving(true);
    }
    wasUnsaved.current = unsaved;
  }, [unsaved]);

  // A timer rather than `animationend`: the event never arrives when the animation
  // is suppressed or its clock is frozen (a hidden tab), which would strand the mark.
  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(() => setLeaving(false), EXIT_MS);
    return () => window.clearTimeout(id);
  }, [leaving]);

  if (!unsaved && !leaving) return null;

  return (
    <Tooltip
      content={
        <Tooltip.Row>
          <Tooltip.Label>{t("progress.savedValue")}</Tooltip.Label>
          <Tooltip.Value>{savedLabel}</Tooltip.Value>
        </Tooltip.Row>
      }
      // `content` is not a string, so the accessible name has to be given explicitly.
      label={`${t("progress.savedValue")}: ${savedLabel}`}
    >
      <span
        className={"progress-diff" + (leaving ? " progress-diff--leaving" : "")}
        aria-hidden={leaving || undefined}
      >
        <span className="progress-diff__label">{t("progress.unsaved")}</span>
        <button
          type="button"
          className="progress-diff__save"
          disabled={leaving}
          onClick={onSave}
        >
          {t("progress.save")}
        </button>
      </span>
    </Tooltip>
  );
}
