import { useI18n } from "../i18n";
import { GENERIC_CANDY_ICON } from "../skillIcons";

const SHARD_ICON = "/shard.png";
const fmtInt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** "Lv. 45 → Lv. 60" over its exact candies and shards: the Box's and Comparison's tooltips. */
export function LevelUpCostHead({ from, to, candies, shards }: { from: number; to: number; candies: number; shards: number }) {
  const { t } = useI18n();
  return (
    <>
      <span className="levelup-tip__span">{t("levelUp.spanFull", { from, to })}</span>
      <span className="levelup-tip__cost">
        <span className="levelup-tip__cost-item" aria-hidden="true">
          <img className="levelup-tip__img" src={GENERIC_CANDY_ICON} alt="" />
          <span>{fmtInt(candies)}</span>
        </span>
        <span className="levelup-tip__cost-item" aria-hidden="true">
          <img className="levelup-tip__img" src={SHARD_ICON} alt="" />
          <span>{fmtInt(shards)}</span>
        </span>
        <span className="sr-only">{t("levelUp.costFull", { candies: fmtInt(candies), shards: fmtInt(shards) })}</span>
      </span>
    </>
  );
}
