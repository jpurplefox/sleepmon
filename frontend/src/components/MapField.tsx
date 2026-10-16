import { useId } from "react";

import { berryIcon } from "../berries";
import { useI18n } from "../i18n";
import type { MapSummary } from "../mapSummary";
import { statIcon } from "../natures";
import { GENERIC_BERRY_ICON } from "../skillIcons";
import type { WeeklyBonus } from "../types";
import { IconChevronDown } from "./icons";
import { ContextField } from "./ToolHeader";

// The weekly bonus as a mark: the effect's icon and value, named in full for its tooltip
// and accessible name. Values are formatted like the event marks beside it in the bar.
const WEEKLY_MARK: Record<WeeklyBonus, { icon: string; op: "×" | "+"; n: number; labelKey: string }> = {
  berry_strength: { icon: GENERIC_BERRY_ICON, op: "×", n: 2.4, labelKey: "teams.weeklyBerryStrength" },
  ingredient: { icon: statIcon("Ingredient Finding"), op: "+", n: 1, labelKey: "teams.weeklyIngredient" },
  skill_trigger: { icon: statIcon("Main Skill Chance"), op: "×", n: 1.25, labelKey: "teams.weeklySkillTrigger" },
};
const MAX_AREA_PCT = 85;

interface Props {
  map: MapSummary;
  /** Every map's name, so the field can reserve room for the longest one. */
  mapNames: string[];
  onOpen: () => void;
  /** False where a map is always set (Comparison): no "No map" to make room for. */
  allowNone?: boolean;
  /** False where the area bonus isn't a setting (Comparison): no room kept for its mark. */
  withArea?: boolean;
}

/** The context bar's Map field: the map, its favorites and marks; opens the map dialog. */
export function MapField({ map, mapNames, onOpen, allowNone = true, withArea = true }: Props) {
  const { t, berry, lang } = useI18n();
  const btnId = useId();
  const weekly = map.weeklyBonus ? WEEKLY_MARK[map.weeklyBonus] : null;
  const numberLocale = lang === "es" ? "es-AR" : "en-US";
  const weeklyMark = (w: (typeof WEEKLY_MARK)[WeeklyBonus], decorative = false) => (
    <span
      className="metric-mark metric-mark--good"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : t(w.labelKey)}
      title={decorative ? undefined : t(w.labelKey)}
    >
      <img className="metric-mark__icon" src={w.icon} alt="" />
      {w.op}
      {w.n.toLocaleString(numberLocale)}
    </span>
  );
  // The area bonus as a bare "+X%" chip; its full name stays in the tooltip and label.
  const areaMark = (pct: number, decorative = false) => (
    <span
      className="metric-mark metric-mark--good"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : t("ctx.area", { pct })}
      title={decorative ? undefined : t("ctx.area", { pct })}
    >
      +{pct}%
    </span>
  );
  // The widest extras any map can show: three berries, the widest weekly mark, the top area.
  const widestWeekly = WEEKLY_MARK.skill_trigger;
  const sizerNames = allowNone ? [t("ctx.noMap"), ...mapNames] : mapNames;

  return (
    <ContextField label={t("ctx.map")}>
      {(labelId) => (
        <button
          type="button"
          id={btnId}
          aria-labelledby={`${labelId} ${btnId}`}
          className="filter-btn"
          aria-haspopup="dialog"
          onClick={onOpen}
        >
          {/* The value and one invisible sizer per map share a grid cell, so the field is
              as wide as the longest possible map line and never resizes. */}
          <span className="ctx-map">
            <span className="filter-btn__value">
              <span className="ctx-map__name">{map.name ?? t("ctx.noMap")}</span>
              {map.name !== null && (
                <span className="filter-btn__icons">
                  {/* Each slot in its place; an open one reads "?", like the map picker's own list. */}
                  {[0, 1, 2].map((i) => {
                    const b = map.berries[i];
                    return b ? (
                      <img key={i} className="mini-icon" src={berryIcon(b)} alt={berry(b)} title={berry(b)} />
                    ) : (
                      <span key={i} className="island-tab__berry-icon--unknown" aria-hidden="true">
                        ?
                      </span>
                    );
                  })}
                </span>
              )}
              {weekly && weeklyMark(weekly)}
              {withArea && map.areaPct !== null && areaMark(map.areaPct)}
            </span>
            {sizerNames.map((name) => (
              <span key={name} className="filter-btn__value ctx-map__sizer" aria-hidden="true">
                <span>{name}</span>
                <span className="filter-btn__icons">
                  {/* Widest berry line: three "?" (they don't overlap like berry icons do). */}
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="island-tab__berry-icon--unknown">
                      ?
                    </span>
                  ))}
                </span>
                {weeklyMark(widestWeekly, true)}
                {withArea && areaMark(MAX_AREA_PCT, true)}
              </span>
            ))}
          </span>
          <IconChevronDown className="filter-btn__chevron" />
        </button>
      )}
    </ContextField>
  );
}
