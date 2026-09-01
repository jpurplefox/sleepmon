import { useState } from "react";

import { useI18n } from "../i18n";
import { perMealPot } from "../pot";
import { potBounds, stepPot } from "../progress";
import { RECIPE_TYPES, dishTypeLabelKey } from "../recipes";
import type { Catalog, MealInput, Recipe, WeeklyBonus } from "../types";
import { IslandTab } from "./IslandTab";
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

type TabId = "island" | "meals";

interface Props {
  recipes: Recipe[];
  levelBonus: number[];
  meals: (MealInput | null)[];
  onChangeMeals: (m: (MealInput | null)[]) => void;
  onClose: () => void;
  potSize: number;
  onPotSizeChange: (n: number) => void;
  /** Total extra pot ingredients/day from cooking_ingredients skill effect (or 0). */
  cookingExtra: number;
  // Island tab props
  catalog: Catalog;
  selectedIsland: string | null;
  favoriteBerries: string[];
  islandBonus: number;
  bonusDisabled: boolean;
  goodCampTicket: boolean;
  mainFavorite: string | null;
  weeklyBonus: WeeklyBonus;
  onSelectIsland: (name: string | null) => void;
  onFavoriteBerries: (berries: string[]) => void;
  onIslandBonus: (bonus: number) => void;
  onGoodCampTicket: (value: boolean) => void;
  onMainFavorite: (berry: string | null) => void;
  onWeeklyBonus: (bonus: WeeklyBonus) => void;
  /** Active dish type for all 3 meal slots. null = unset (nothing chosen
   * yet); once a type is picked there is no UI path back to null. */
  dishType: Recipe["type"] | null;
  /** Raw setter for the dish type (see pickDishType below for the
   * favorite-replace behavior wrapped around it before it reaches IslandTab). */
  onDishTypeChange: (type: Recipe["type"] | null) => void;
  /** Effective level of a recipe: session override, else saved progress, else 1. */
  levelFor: (recipe: string) => number;
  onRecipeLevelChange: (recipe: string, level: number) => void;
  /** True when the shown pot size differs from what is saved in Player progress. */
  potUnsaved: boolean;
  /** The saved pot size, shown in the unsaved mark's tooltip. */
  savedPotSize: number;
  onSavePot: () => void;
  /** True when the shown area bonus differs from what is saved. */
  bonusUnsaved: boolean;
  /** The saved area bonus, in percentage points. */
  savedBonusPct: number;
  onSaveBonus: () => void;
  /** True when the shown level for one recipe differs from what is saved. */
  levelUnsaved: (recipe: string) => boolean;
  /** The saved level for one recipe, shown in the unsaved mark's tooltip. */
  savedLevelFor: (recipe: string) => number;
  onSaveLevel: (recipe: string) => void;
  /** The saved favorite recipe for a dish type, or null if none is set. */
  favoriteFor: (type: Recipe["type"]) => string | null;
  /** True when the last save attempt (any of the three) failed. */
  saveError?: boolean;
}

export function SettingsModal({
  recipes,
  levelBonus,
  meals,
  onChangeMeals,
  onClose,
  potSize,
  onPotSizeChange,
  cookingExtra,
  catalog,
  selectedIsland,
  favoriteBerries,
  islandBonus,
  bonusDisabled,
  goodCampTicket,
  mainFavorite,
  weeklyBonus,
  onSelectIsland,
  onFavoriteBerries,
  onIslandBonus,
  onGoodCampTicket,
  onMainFavorite,
  onWeeklyBonus,
  dishType,
  onDishTypeChange,
  levelFor,
  onRecipeLevelChange,
  potUnsaved,
  savedPotSize,
  onSavePot,
  bonusUnsaved,
  savedBonusPct,
  onSaveBonus,
  levelUnsaved,
  savedLevelFor,
  onSaveLevel,
  favoriteFor,
  saveError = false,
}: Props) {
  const { t } = useI18n();

  // Tab state: "island" is active by default.
  const [activeTab, setActiveTab] = useState<TabId>("island");

  // Text search.
  const [search, setSearch] = useState("");

  // PRD 0011: unlike Player progress's draft, these are session values the
  // user is analysing with — closing keeps every one, no question asked.

  // Effective pot = base pot + floor(cookingExtra / 3) (3 meals/day); with GCT: ceil(×1.5).
  const effectivePot = perMealPot(potSize, cookingExtra, goodCampTicket);

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

  // Picking a dish type gives you that type's day: it replaces all 3 meals
  // with its favorite recipe at the effective level, or empties the plan when
  // it has none saved (PRD 0006 / 0011) — a type change never leaves a plan
  // of the wrong type behind, and never leaves nothing to show for it.
  const pickDishType = (type: Recipe["type"] | null) => {
    onDishTypeChange(type);
    if (type === null) return;
    const favorite = favoriteFor(type);
    if (favorite === null) {
      onChangeMeals([null, null, null]);
      return;
    }
    const level = levelFor(favorite);
    onChangeMeals([
      { recipe: favorite, level },
      { recipe: favorite, level },
      { recipe: favorite, level },
    ]);
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
    <Modal title={t("teams.configure")} onClose={onClose} wide>
      {/* Tab bar */}
      <div className="settings-modal-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          id="settings-tab-island"
          aria-controls="settings-panel-island"
          aria-selected={activeTab === "island"}
          className={
            "specialty-toggle__btn" + (activeTab === "island" ? " is-on" : "")
          }
          onClick={() => setActiveTab("island")}
        >
          {t("teams.tabIsland")}
        </button>
        <button
          type="button"
          role="tab"
          id="settings-tab-meals"
          aria-controls="settings-panel-meals"
          aria-selected={activeTab === "meals"}
          className={
            "specialty-toggle__btn" + (activeTab === "meals" ? " is-on" : "")
          }
          onClick={() => setActiveTab("meals")}
        >
          {t("teams.tabMeals")}
        </button>
      </div>

      {/* Tab: Isla */}
      <div
        id="settings-panel-island"
        role="tabpanel"
        aria-labelledby="settings-tab-island"
        hidden={activeTab !== "island"}
        className="settings-modal-panel"
      >
        {saveError && (
          <p className="error" role="alert">
            {t("progress.saveError")}
          </p>
        )}
        <IslandTab
          catalog={catalog}
          selectedIsland={selectedIsland}
          favoriteBerries={favoriteBerries}
          islandBonus={islandBonus}
          bonusDisabled={bonusDisabled}
          goodCampTicket={goodCampTicket}
          mainFavorite={mainFavorite}
          weeklyBonus={weeklyBonus}
          bonusUnsaved={bonusUnsaved}
          savedBonusPct={savedBonusPct}
          onSelectIsland={onSelectIsland}
          onFavoriteBerries={onFavoriteBerries}
          onIslandBonus={onIslandBonus}
          onGoodCampTicket={onGoodCampTicket}
          onMainFavorite={onMainFavorite}
          onWeeklyBonus={onWeeklyBonus}
          onSaveBonus={onSaveBonus}
          dishType={dishType}
          onDishTypeChange={pickDishType}
        />
      </div>

      {/* Tab: Meals */}
      <div
        id="settings-panel-meals"
        role="tabpanel"
        aria-labelledby="settings-tab-meals"
        hidden={activeTab !== "meals"}
        className="settings-modal-panel"
      >
        {saveError && (
          <p className="error" role="alert">
            {t("progress.saveError")}
          </p>
        )}
        {/* Top bar: current dish type (chosen on the Map tab) + search.
            The type is no longer picked here, but the grid still filters
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
            </div>
            {goodCampTicket ? (
              <span className="meal-picker-pot__effective muted">
                = {effectivePot}
              </span>
            ) : cookingExtra > 0 ? (
              <span className="meal-picker-pot__effective muted">
                +{Math.floor(cookingExtra / 3)} ={" "}
                <strong>{effectivePot}</strong>
              </span>
            ) : (
              <span className="meal-picker-pot__effective muted">
                = {effectivePot}
              </span>
            )}
            <UnsavedMark
              unsaved={potUnsaved}
              savedLabel={String(savedPotSize)}
              onSave={onSavePot}
            />
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
              const fits = totalIngs <= effectivePot;
              const fillers = effectivePot - totalIngs;

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
      </div>
    </Modal>
  );
}
