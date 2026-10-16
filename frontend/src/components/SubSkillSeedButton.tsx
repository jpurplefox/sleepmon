import { useI18n } from "../i18n";
import type { SeedMode } from "../useSeedShortcut";
import { IconUndo } from "./icons";
import { Tooltip } from "./Tooltip";

interface Props {
  mode: SeedMode;
  /** Seeds the next apply would spend. */
  seeds: number;
  onClick: () => void;
}

// Applies every seed in one click, then undoes it (PRD 0003).
export function SubSkillSeedButton({ mode, seeds, onClick }: Props) {
  const { t } = useI18n();
  const label =
    mode === "undo"
      ? t("seed.undo")
      : mode === "none"
        ? t("seed.maxed")
        : seeds === 1
          ? t("seed.applyOne")
          : t("seed.apply", { n: seeds });
  return (
    <Tooltip content={label}>
      {/* aria-disabled, not disabled: a disabled button would swallow the tooltip's hover. */}
      <button
        type="button"
        className="seed-btn"
        aria-label={label}
        aria-disabled={mode === "none" || undefined}
        onClick={() => mode !== "none" && onClick()}
      >
        <img className="seed-btn__icon" src="/sub-skill-seed.png" alt="" />
        {mode === "apply" && <span className="seed-btn__badge">{seeds}</span>}
        {mode === "undo" && (
          <span className="seed-btn__badge seed-btn__badge--undo">
            <IconUndo width={11} height={11} strokeWidth={2.6} />
          </span>
        )}
      </button>
    </Tooltip>
  );
}
