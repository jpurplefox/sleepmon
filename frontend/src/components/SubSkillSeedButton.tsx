import { useI18n } from "../i18n";
import { Tooltip } from "./Tooltip";

interface Props {
  /** Seeds the shortcut would spend; 0 shows the maxed state. */
  seeds: number;
  onSeed: () => void;
}

// One click raises every sub skill to its highest free tier (PRD 0003).
export function SubSkillSeedButton({ seeds, onSeed }: Props) {
  const { t } = useI18n();
  const label = seeds > 0 ? t("seed.apply", { n: seeds }) : t("seed.maxed");
  return (
    <Tooltip content={label}>
      {/* aria-disabled, not disabled: a disabled button would swallow the tooltip's hover. */}
      <button
        type="button"
        className="seed-btn"
        aria-label={label}
        aria-disabled={seeds === 0 || undefined}
        onClick={() => seeds > 0 && onSeed()}
      >
        <img className="seed-btn__icon" src="/sub-skill-seed.png" alt="" />
        {seeds > 0 && <span className="seed-btn__badge">{seeds}</span>}
      </button>
    </Tooltip>
  );
}
