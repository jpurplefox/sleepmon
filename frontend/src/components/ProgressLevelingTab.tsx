import { MIN_TARGET_LEVELS } from "../constants";
import { useI18n } from "../i18n";
import type { PlayerProgress, ProgressPatch } from "../types";

interface Props {
  /** The in-memory draft being edited (PRD 0011) — nothing here is saved yet. */
  draft: PlayerProgress;
  onChange: (patch: ProgressPatch) => void;
}

const OPTIONS: (number | null)[] = [null, ...MIN_TARGET_LEVELS];

// PRD 0021: the level every Box Pokémon is aimed at, at the least. A radio group of
// level chips — None or an unlock level, nothing in between.
export function ProgressLevelingTab({ draft, onChange }: Props) {
  const { t } = useI18n();
  const current = draft.min_target_level ?? null;

  const select = (lv: number | null) => onChange({ min_target_level: lv ?? 0 });

  // Arrows move selection and focus along the row (no wrap), per the radio-group pattern.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    e.preventDefault();
    const idx = OPTIONS.indexOf(current);
    const next = Math.min(Math.max(idx + step, 0), OPTIONS.length - 1);
    select(OPTIONS[next]);
    e.currentTarget
      .querySelectorAll<HTMLElement>('[role="radio"]')
      [next]?.focus();
  };

  return (
    <div className="progress-section">
      <h3 className="progress-section__head" id="min-target-head">
        {t("progress.minTarget")}
      </h3>
      <div
        className="level-shortcuts"
        role="radiogroup"
        aria-labelledby="min-target-head"
        onKeyDown={onKeyDown}
      >
        {OPTIONS.map((lv) => (
          <button
            key={lv ?? "none"}
            type="button"
            role="radio"
            aria-checked={current === lv}
            tabIndex={current === lv ? 0 : -1}
            className={
              "level-chip" + (current === lv ? " level-chip--active" : "")
            }
            onClick={() => select(lv)}
          >
            {lv === null ? t("progress.minTargetNone") : lv}
          </button>
        ))}
      </div>
      <p className="progress-hint">{t("progress.minTargetHint")}</p>
    </div>
  );
}
