import { useState } from "react";

import { useI18n } from "../i18n";
import { potBounds, stepPot } from "../progress";
import { RECIPE_TYPES, dishTypeLabelKey } from "../recipes";
import type { Catalog, MealInput, Recipe } from "../types";
import { Modal } from "./Modal";
import { RecipeCard, normalizeSearch } from "./RecipeCard";
import { UnsavedMark } from "./UnsavedMark";

interface PotLadderStepperProps {
  value: number;
  ladder: number[];
  onChange: (n: number) => void;
  ariaLabels: { down: string; input: string; up: string };
}

// Same markup/classes as LevelStepperInput (so it inherits its CSS), but steps
// through the game's actual pot ladder instead of accepting any typed value.
function PotLadderStepper({
  value,
  ladder,
  onChange,
  ariaLabels,
}: PotLadderStepperProps) {
  const { atMin, atMax } = potBounds(ladder, value);
  return (
    <>
      <button
        type="button"
        className="level-stepper__btn"
        disabled={atMin}
        aria-label={ariaLabels.down}
        onClick={() => onChange(stepPot(ladder, value, -1))}
      >
        −
      </button>
      <input
        type="text"
        className="level-stepper__input"
        inputMode="numeric"
        readOnly
        value={value}
        aria-label={ariaLabels.input}
      />
      <button
        type="button"
        className="level-stepper__btn"
        disabled={atMax}
        aria-label={ariaLabels.up}
        onClick={() => onChange(stepPot(ladder, value, 1))}
      >
        +
      </button>
    </>
  );
}

interface Props {
  recipes: Recipe[];
  levelBonus: number[];
  catalog: Catalog;
  meals: (MealInput | null)[];
  onChangeMeals: (m: (MealInput | null)[]) => void;
  onClose: () => void;
  potSize: number;
  onPotSizeChange: (n: number) => void;
  /** Per-meal pot from the backend (base + skill share, × ticket/event); null while unknown. */
  effectivePot: number | null;
  /** floor(skill expansion / 3), shown as "+N" beside the stepper; null while unknown. */
  skillPerMeal: number | null;
  // True when the shown pot carries a multiplier (ticket and/or event).
  potMultiplied: boolean;
  /** Active dish type for all 3 meal slots; null = not chosen yet. */
  dishType: Recipe["type"] | null;
  /** Used only to lock in the type when the first recipe lands on an empty plan. */
  onDishTypeChange: (type: Recipe["type"] | null) => void;
  /** Effective level of a recipe: session override, else saved progress, else 1. */
  levelFor: (recipe: string) => number;
  onRecipeLevelChange: (recipe: string, level: number) => void;
  /** True when the shown pot size differs from what is saved in Player progress. */
  potUnsaved: boolean;
  /** The saved pot size, shown in the unsaved mark's tooltip. */
  savedPotSize: number;
  onSavePot: () => void;
  /** True when the shown level for one recipe differs from what is saved. */
  levelUnsaved: (recipe: string) => boolean;
  /** The saved level for one recipe, shown in the unsaved mark's tooltip. */
  savedLevelFor: (recipe: string) => number;
  onSaveLevel: (recipe: string) => void;
  /** True when the last save attempt (any of the three) failed. */
  saveError?: boolean;
}

export function MealsModal({
  recipes,
  levelBonus,
  catalog,
  meals,
  onChangeMeals,
  onClose,
  potSize,
  onPotSizeChange,
  effectivePot,
  skillPerMeal,
  potMultiplied,
  dishType,
  onDishTypeChange,
  levelFor,
  onRecipeLevelChange,
  potUnsaved,
  savedPotSize,
  onSavePot,
  levelUnsaved,
  savedLevelFor,
  onSaveLevel,
  saveError = false,
}: Props) {
  const { t } = useI18n();

  // Text search.
  const [search, setSearch] = useState("");

  // PRD 0011: these are session values the user is analysing with — closing
  // keeps every one, no question asked.

  const setLevelFor = (name: string, level: number) => {
    const clamped = Math.max(1, Math.min(70, level));
    onRecipeLevelChange(name, clamped);
    // Keep every meal slot holding this recipe in step with its new level.
    onChangeMeals(
      meals.map((m) =>
        m?.recipe === name ? { recipe: name, level: clamped } : m,
      ),
    );
  };

  const toggleMoment = (recipe: Recipe, momentIdx: number) => {
    const level = levelFor(recipe.name);
    const isRemoving = meals[momentIdx]?.recipe === recipe.name;
    const next = meals.map((m, i) => {
      if (i !== momentIdx) return m;
      // Clicking the same recipe on the same moment clears it.
      if (isRemoving) return null;
      return { recipe: recipe.name, level };
    });
    onChangeMeals(next);
    // Auto-set dishType when adding the first recipe to a fully empty plan.
    // This locks in the type so subsequent slots are restricted to the same type.
    if (!isRemoving && dishType === null && meals.every((m) => m === null)) {
      onDishTypeChange(recipe.type);
    }
  };

  // Filter recipes. When dishType is set, only show recipes of that type.
  const q = normalizeSearch(search.trim());
  const filtered = recipes.filter((r) => {
    if (dishType && r.type !== dishType) return false;
    if (q && !normalizeSearch(r.name).includes(q)) return false;
    return true;
  });

  // Sort: by base_strength desc within each type group, respecting type order.
  const sorted = [...filtered].sort((a, b) => {
    const ta = RECIPE_TYPES.indexOf(a.type);
    const tb = RECIPE_TYPES.indexOf(b.type);
    if (ta !== tb) return ta - tb;
    return b.base_strength - a.base_strength;
  });

  const MOMENT_LABELS = [
    t("teams.breakfast"),
    t("teams.midday"),
    t("teams.dinner"),
  ];

  return (
    <Modal title={t("teams.tabMeals")} onClose={onClose} wide>
      {saveError && (
        <p className="error" role="alert">
          {t("progress.saveError")}
        </p>
      )}
      {/* The type is chosen in the context bar, but the grid still filters
          by it, so its name stays visible while browsing recipes. */}
      <div className="meal-picker-topbar">
        <span className="meal-picker-dish-type__label muted">
          {t("teams.dishType")}:{" "}
          {dishType === null
            ? t("teams.dishTypeUnset")
            : t(dishTypeLabelKey(dishType))}
        </span>

        <input
          data-autofocus
          type="search"
          className="meal-picker-search"
          placeholder={t("teams.recipeSearchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t("teams.recipeSearchPlaceholder")}
        />

        {/* Pot size control */}
        <div className="meal-picker-pot">
          <img src="/pot.webp" alt="" className="meal-picker-pot__icon" />
          <span className="meal-picker-pot__label muted">
            {t("teams.potSize")}
          </span>
          <div className="level-stepper meal-picker-pot__stepper">
            <PotLadderStepper
              value={potSize}
              ladder={catalog.pot_ladder}
              onChange={onPotSizeChange}
              ariaLabels={{
                down: "−",
                input: t("teams.potSize"),
                up: "+",
              }}
            />
            {/* Anchored to the stepper so it hangs under the buttons rather than
                under the label, and out of the flow so it stays out of the toolbar's
                line: the search box there is the only item that flexes, and a mark
                sharing that line took its width out of the search and slid the
                stepper ~141px left, mid-click (styles.css). */}
            <UnsavedMark
              unsaved={potUnsaved}
              savedLabel={String(savedPotSize)}
              onSave={onSavePot}
            />
          </div>
          {potMultiplied || skillPerMeal === null || skillPerMeal <= 0 ? (
            <span className="meal-picker-pot__effective muted">
              = {effectivePot ?? t("common.dash")}
            </span>
          ) : (
            <span className="meal-picker-pot__effective muted">
              +{skillPerMeal} ={" "}
              <strong>{effectivePot ?? t("common.dash")}</strong>
            </span>
          )}
        </div>

        <button
          type="button"
          className="btn btn--ghost meal-picker-clear"
          onClick={() => onChangeMeals([null, null, null])}
        >
          {t("teams.clearMeals")}
        </button>
      </div>

      {/* Recipe card grid */}
      <div className="meal-picker-grid">
        {sorted.length === 0 ? (
          <p
            className="muted"
            style={{ gridColumn: "1/-1", textAlign: "center" }}
          >
            {t("teams.noResults")}
          </p>
        ) : (
          sorted.map((r) => {
            const level = levelFor(r.name);

            const totalIngs = r.ingredients.reduce(
              (s, ic) => s + ic.count,
              0,
            );
            const fits = effectivePot !== null && totalIngs <= effectivePot;
            const fillers = effectivePot === null ? 0 : effectivePot - totalIngs;

            return (
              <RecipeCard
                key={r.name}
                recipe={r}
                level={level}
                levelBonus={levelBonus}
                onLevelChange={(n) => setLevelFor(r.name, n)}
                mark={
                  <UnsavedMark
                    unsaved={levelUnsaved(r.name)}
                    savedLabel={String(savedLevelFor(r.name))}
                    onSave={() => onSaveLevel(r.name)}
                  />
                }
                beforeStepper={
                  effectivePot === null ? undefined : (
                  <div
                    className={`meal-picker-card__pot-fit ${fits ? "meal-picker-card__pot-fit--ok" : "meal-picker-card__pot-fit--no"}`}
                  >
                    <img
                      src="/pot.webp"
                      alt=""
                      className="meal-picker-pot__icon"
                    />
                    {fits ? (
                      <span>
                        {t("teams.potFits")} ·{" "}
                        {t("teams.fillers", { n: String(fillers) })}
                      </span>
                    ) : (
                      <span>
                        {t("teams.potNoFit")} ({totalIngs}/{effectivePot})
                      </span>
                    )}
                  </div>
                  )
                }
                afterStepper={
                  <div className="meal-picker-card__moments">
                    {MOMENT_LABELS.map((label, idx) => {
                      const isActive = meals[idx]?.recipe === r.name;
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={
                            "meal-picker-card__moment-btn" +
                            (isActive ? " is-active" : "")
                          }
                          aria-pressed={isActive}
                          onClick={() => toggleMoment(r, idx)}
                          title={label}
                        >
                          {label.slice(0, 2)}
                        </button>
                      );
                    })}
                  </div>
                }
              />
            );
          })
        )}
      </div>
    </Modal>
  );
}
