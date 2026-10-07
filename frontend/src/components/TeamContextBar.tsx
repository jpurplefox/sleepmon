import { useId } from "react";

import { berryIcon } from "../berries";
import type { EventEffect } from "../eventBonus";
import { useI18n } from "../i18n";
import type { MapSummary } from "../mapSummary";
import { statIcon } from "../natures";
import { RECIPE_TYPES, dishTypeLabelKey, recipeImage } from "../recipes";
import { GENERIC_BERRY_ICON } from "../skillIcons";
import type { MealInput, Recipe, WeeklyBonus } from "../types";
import { EventMarks } from "./EventMarks";
import { IconChevronDown } from "./icons";
import { ContextBar, ContextField } from "./ToolHeader";

/** The dialog each context field opens. */
export type TeamDialog = "map" | "event" | "meals";

// The weekly bonus as a mark: the effect's icon and value, named in full for its tooltip
// and accessible name. Values are formatted like the event marks beside it in the bar.
const WEEKLY_MARK: Record<WeeklyBonus, { icon: string; op: "×" | "+"; n: number; labelKey: string }> = {
  berry_strength: { icon: GENERIC_BERRY_ICON, op: "×", n: 2.4, labelKey: "teams.weeklyBerryStrength" },
  ingredient: { icon: statIcon("Ingredient Finding"), op: "+", n: 1, labelKey: "teams.weeklyIngredient" },
  skill_trigger: { icon: statIcon("Main Skill Chance"), op: "×", n: 1.25, labelKey: "teams.weeklySkillTrigger" },
};

interface Props {
  map: MapSummary;
  eventEffects: EventEffect[];
  goodCampTicket: boolean;
  onGoodCampTicket: (on: boolean) => void;
  onOpenDialog: (dialog: TeamDialog) => void;
  dishType: Recipe["type"] | null;
  meals: (MealInput | null)[];
  onDishType: (type: Recipe["type"]) => void;
  /** Every map's name, so the Map field can reserve room for the longest one. */
  mapNames: string[];
}

/** Team Analysis's context: map, meals, event and camp ticket, always visible (PRD 0014). */
export function TeamContextBar({
  map,
  eventEffects,
  goodCampTicket,
  onGoodCampTicket,
  onOpenDialog,
  dishType,
  meals,
  onDishType,
  mapNames,
}: Props) {
  const { t, berry, lang } = useI18n();
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
  // The widest extras any map can show: three berries, the widest weekly mark, the top area.
  const widestWeekly = WEEKLY_MARK.skill_trigger;
  const MAX_AREA_PCT = 85;
  const mapBtnId = useId();
  const eventBtnId = useId();
  const mealsBtnId = useId();
  const noMeals = meals.every((m) => m === null);
  const toggle = (on: boolean) => {
    if (on !== goodCampTicket) onGoodCampTicket(on);
  };

  return (
    <ContextBar>
      <ContextField label={t("ctx.map")}>
        {(labelId) => (
          <button
            type="button"
            id={mapBtnId}
            aria-labelledby={`${labelId} ${mapBtnId}`}
            className="filter-btn"
            aria-haspopup="dialog"
            onClick={() => onOpenDialog("map")}
          >
            {/* The value and one invisible sizer per map share a grid cell, so the field is
                as wide as the longest possible map line and never resizes. */}
            <span className="ctx-map">
              <span className="filter-btn__value">
                {map.name ?? t("ctx.noMap")}
                {map.berries.length > 0 && (
                  <span className="filter-btn__icons">
                    {map.berries.map((b) => (
                      <img
                        key={b}
                        className="mini-icon"
                        src={berryIcon(b)}
                        alt={berry(b)}
                        title={berry(b)}
                      />
                    ))}
                  </span>
                )}
                {weekly && weeklyMark(weekly)}
                {map.areaPct !== null && (
                  <span className="ctx-sub">{t("ctx.area", { pct: map.areaPct })}</span>
                )}
              </span>
              {[t("ctx.noMap"), ...mapNames].map((name) => (
                <span key={name} className="filter-btn__value ctx-map__sizer" aria-hidden="true">
                  <span>{name}</span>
                  <span className="filter-btn__icons">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="mini-icon" />
                    ))}
                  </span>
                  {weeklyMark(widestWeekly, true)}
                  <span className="ctx-sub">{t("ctx.area", { pct: MAX_AREA_PCT })}</span>
                </span>
              ))}
            </span>
            <IconChevronDown className="filter-btn__chevron" />
          </button>
        )}
      </ContextField>

      <ContextField label={t("teams.tabMeals")}>
        {(labelId) => (
          <>
            <div className="specialty-toggle" role="group" aria-label={t("teams.dishType")}>
              {RECIPE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={"specialty-toggle__btn" + (dishType === type ? " is-on" : "")}
                  aria-pressed={dishType === type}
                  onClick={() => {
                    if (type !== dishType) onDishType(type);
                  }}
                >
                  {t(dishTypeLabelKey(type))}
                </button>
              ))}
            </div>
            <button
              type="button"
              id={mealsBtnId}
              aria-labelledby={`${labelId} ${mealsBtnId}`}
              className="filter-btn"
              aria-haspopup="dialog"
              onClick={() => onOpenDialog("meals")}
            >
              <span className="filter-btn__value">
                {/* Text and the three places share one grid cell, so the field is as wide
                    as the wider of the two and never resizes as dishes are chosen. */}
                <span className="ctx-meals">
                  <span className="ctx-recipes" aria-hidden={noMeals || undefined}>
                    {meals.map((m, i) =>
                      m ? (
                        <img
                          key={i}
                          className="ctx-recipe"
                          src={recipeImage(m.recipe)}
                          alt={m.recipe}
                          title={m.recipe}
                        />
                      ) : (
                        <span key={i} className="ctx-recipe ctx-recipe--empty" aria-hidden="true" />
                      ),
                    )}
                  </span>
                  <span className="ctx-meals__none muted" aria-hidden={!noMeals || undefined}>
                    {t("ctx.noMeals")}
                  </span>
                </span>
              </span>
              <IconChevronDown className="filter-btn__chevron" />
            </button>
          </>
        )}
      </ContextField>

      <ContextField label={t("ctx.event")}>
        {(labelId) => (
          <button
            type="button"
            id={eventBtnId}
            aria-labelledby={`${labelId} ${eventBtnId}`}
            className="filter-btn"
            aria-haspopup="dialog"
            onClick={() => onOpenDialog("event")}
          >
            <span className="filter-btn__value">
              {eventEffects.length > 0 ? (
                <EventMarks effects={eventEffects} />
              ) : (
                <span className="muted">{t("ctx.noEvent")}</span>
              )}
            </span>
            <IconChevronDown className="filter-btn__chevron" />
          </button>
        )}
      </ContextField>

      <ContextField label={t("ctx.gct")}>
        <div
          className="specialty-toggle"
          role="group"
          aria-label={t("ctx.gct")}
        >
          {[false, true].map((on) => (
            <button
              key={String(on)}
              type="button"
              className={
                "specialty-toggle__btn" +
                (goodCampTicket === on ? " is-on" : "")
              }
              aria-pressed={goodCampTicket === on}
              onClick={() => toggle(on)}
            >
              {on ? t("common.yes") : t("common.no")}
            </button>
          ))}
        </div>
      </ContextField>
    </ContextBar>
  );
}
