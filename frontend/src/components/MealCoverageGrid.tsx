import { useI18n } from "../i18n";
import { POT_EXPANSION_ICON } from "../skillIcons";
import type { CoverageOdds, MealCoverage } from "../types";
import { Tooltip } from "./Tooltip";

const wholePct = (n: number) => `${Math.round(n * 100)}%`;

/** Meal coverage read-out: rows per procs per meal, columns day, then week (no misses / at most one miss) (PRD 0024). */
export function MealCoverageGrid({ coverage }: { coverage: MealCoverage }) {
  const { t } = useI18n();
  const rows: [string, CoverageOdds][] = [[t("card.mealOneProc"), coverage.one_proc]];
  if (coverage.two_procs) rows.push([t("card.mealTwoProcs"), coverage.two_procs]);
  return (
    <div className="night-grid night-grid--meals">
      <span />
      <span />
      <span className="night-grid__h night-grid__group">{t("card.mealWeek")}</span>
      <span />
      <Tooltip content={t("card.mealDayTitle")} className="tooltip--inline night-grid__h">
        {t("card.mealDay")}
      </Tooltip>
      <Tooltip content={t("card.mealPerfectTitle")} className="tooltip--inline night-grid__h">
        {t("card.mealPerfect")}
      </Tooltip>
      <Tooltip content={t("card.mealOneMissTitle")} className="tooltip--inline night-grid__h">
        {t("card.mealOneMiss")}
      </Tooltip>
      {rows.map(([label, odds]) => (
        <div key={label} className="night-grid__row">
          <span className="night-grid__who">
            <img className="night-grid__icon" src={POT_EXPANSION_ICON} alt="" />
            <span className="muted">{label}</span>
          </span>
          <span>{wholePct(odds.day)}</span>
          <span>{wholePct(odds.week)}</span>
          <span>{wholePct(odds.week_one_miss)}</span>
        </div>
      ))}
    </div>
  );
}
