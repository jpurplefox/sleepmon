import { useId } from "react";

import { berryIcon } from "../berries";
import type { EventEffect } from "../eventBonus";
import { useI18n } from "../i18n";
import type { MapSummary } from "../mapSummary";
import { RECIPE_TYPES, dishTypeLabelKey, recipeImage } from "../recipes";
import type { MealInput, Recipe } from "../types";
import { EventMarks } from "./EventMarks";
import { IconChevronDown } from "./icons";
import type { SettingsTab } from "./SettingsModal";
import { ContextBar, ContextField } from "./ToolHeader";

interface Props {
  map: MapSummary;
  eventEffects: EventEffect[];
  goodCampTicket: boolean;
  onGoodCampTicket: (on: boolean) => void;
  onOpenSettings: (tab: SettingsTab) => void;
  dishType: Recipe["type"] | null;
  meals: (MealInput | null)[];
  onDishType: (type: Recipe["type"]) => void;
}

/** Team Analysis's context: map, meals, event and camp ticket, always visible (PRD 0014). */
export function TeamContextBar({
  map,
  eventEffects,
  goodCampTicket,
  onGoodCampTicket,
  onOpenSettings,
  dishType,
  meals,
  onDishType,
}: Props) {
  const { t, berry } = useI18n();
  const mapBtnId = useId();
  const eventBtnId = useId();
  const mealsBtnId = useId();
  const chosenMeals = meals.filter((m): m is MealInput => m !== null);
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
            onClick={() => onOpenSettings("island")}
          >
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
              {map.areaPct !== null && (
                <span className="ctx-sub">
                  {t("ctx.area", { pct: map.areaPct })}
                </span>
              )}
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
              onClick={() => onOpenSettings("meals")}
            >
              <span className="filter-btn__value">
                {chosenMeals.length > 0 ? (
                  <span className="ctx-recipes">
                    {chosenMeals.map((m, i) => (
                      <img
                        key={i}
                        className="ctx-recipe"
                        src={recipeImage(m.recipe)}
                        alt={m.recipe}
                        title={m.recipe}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="muted">{t("ctx.noMeals")}</span>
                )}
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
            onClick={() => onOpenSettings("event")}
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
