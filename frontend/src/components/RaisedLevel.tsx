import { useI18n } from "../i18n";
import type { ComparisonRaise } from "../types";
import { LevelUpCostHead } from "./LevelUpCostHead";
import { Tooltip } from "./Tooltip";

const fmtInt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** A card raised by Comparison's level: "Lv. 45 → 60", its cost a hover or tap away. */
export function RaisedLevel({ raise }: { raise: ComparisonRaise }) {
  const { t } = useI18n();
  return (
    <Tooltip
      wide
      content={
        <span className="levelup-tip">
          <span className="levelup-tip__head levelup-tip__head--bare">
            <LevelUpCostHead from={raise.from_level} to={raise.to_level} candies={raise.candies} shards={raise.dream_shards} />
          </span>
        </span>
      }
    >
      <span
        className="raised-lv"
        tabIndex={0}
        role="img"
        aria-label={t("card.raisedLevelAria", {
          from: raise.from_level,
          to: raise.to_level,
          candies: fmtInt(raise.candies),
          shards: fmtInt(raise.dream_shards),
        })}
      >
        <span className="raised-lv__set strength-value__cue">{t("common.level", { level: raise.from_level })}</span>
        <span className="muted"> → </span>
        <span className="raised-lv__used strength-value__cue">{raise.to_level}</span>
      </span>
    </Tooltip>
  );
}
