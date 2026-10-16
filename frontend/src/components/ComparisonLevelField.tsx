import type React from "react";

import { COMPARISON_LEVELS, type ComparisonLevel } from "../comparisonLevel";
import { useI18n } from "../i18n";
import { ContextField } from "./ToolHeader";
import { Tooltip } from "./Tooltip";

const OPTIONS: readonly (ComparisonLevel | null)[] = [null, ...COMPARISON_LEVELS];

interface Props {
  value: ComparisonLevel | null;
  onChange: (level: ComparisonLevel | null) => void;
}

/** Comparison's "Compare at level" field: a radio group of level chips, "—" for off. */
export function ComparisonLevelField({ value, onChange }: Props) {
  const { t } = useI18n();
  const pick = (level: ComparisonLevel | null) => {
    if (level !== value) onChange(level);
  };
  // Roving selection, as a native radio group: arrows pick the neighbour and focus it.
  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = OPTIONS[Math.min(OPTIONS.length - 1, Math.max(0, OPTIONS.indexOf(value) + step))];
    pick(next);
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[OPTIONS.indexOf(next)]?.focus();
  };

  return (
    <ContextField label={t("ctx.compareLevel")}>
      {(labelId) => (
        <span className="ctx-levels" role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}>
          {OPTIONS.map((level) => {
            const label = level === null ? t("ctx.compareLevelOff") : t("ctx.compareLevelChip", { level: String(level) });
            const chip = (
              <button
                key={level ?? "off"}
                type="button"
                role="radio"
                aria-checked={level === value}
                aria-label={label}
                tabIndex={level === value ? 0 : -1}
                className={"level-chip" + (level === value ? " level-chip--active" : "")}
                onClick={() => pick(level)}
              >
                {level ?? "—"}
              </button>
            );
            // A dash doesn't name itself: its tooltip says what it means.
            return level === null ? (
              <Tooltip key="off" content={label}>
                {chip}
              </Tooltip>
            ) : (
              chip
            );
          })}
        </span>
      )}
    </ContextField>
  );
}
