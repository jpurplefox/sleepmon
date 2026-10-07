import { useId } from "react";

import { berryIcon } from "../berries";
import type { EventEffect } from "../eventBonus";
import { useI18n } from "../i18n";
import type { MapSummary } from "../mapSummary";
import { RECIPE_TYPES, dishTypeLabelKey, recipeImage } from "../recipes";
import type { MealInput, Recipe } from "../types";
import { EventMarks } from "./EventMarks";
import { IconChevronDown } from "./icons";
import { ContextBar, ContextField } from "./ToolHeader";

/** The dialog each context field opens. */
export type TeamDialog = "map" | "event" | "meals";

interface Props {
  map: MapSummary;
  eventEffects: EventEffect[];
  goodCampTicket: boolean;
  onGoodCampTicket: (on: boolean) => void;
  onOpenDialog: (dialog: TeamDialog) => void;
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
  onOpenDialog,
  dishType,
  meals,
  onDishType,
}: Props) {
  const { t, berry } = useI18n();
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
