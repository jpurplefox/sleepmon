import { useState } from "react";

import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { recipeImage, recipeStrengthAtLevel } from "../recipes";
import type { Catalog, MealInput, Recipe } from "../types";
import { IslandTab } from "./IslandTab";
import { LevelStepperInput } from "./LevelStepperInput";
import { Modal } from "./Modal";

const RECIPE_TYPES: Recipe["type"][] = ["Curry", "Salad", "Dessert"];

type TabId = "island" | "meals";

// Normaliza para búsqueda: sin mayúsculas ni acentos.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

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
  onSelectIsland: (name: string | null) => void;
  onFavoriteBerries: (berries: string[]) => void;
  onIslandBonus: (bonus: number) => void;
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
  onSelectIsland,
  onFavoriteBerries,
  onIslandBonus,
}: Props) {
  const { t } = useI18n();

  // Tab state: "island" is active by default.
  const [activeTab, setActiveTab] = useState<TabId>("island");

  // Type filter: null = all.
  const [typeFilter, setTypeFilter] = useState<Recipe["type"] | null>(null);
  // Text search.
  const [search, setSearch] = useState("");

  // Per-recipe levels: initialized from meals so existing selections show their level.
  const [recipeLevels, setRecipeLevels] = useState<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const meal of meals) {
      if (meal) m.set(meal.recipe, meal.level);
    }
    return m;
  });

  // Effective pot = base pot + floor(cookingExtra / 3) (3 meals/day).
  const effectivePot = potSize + Math.floor(cookingExtra / 3);

  const getLevelFor = (name: string) => recipeLevels.get(name) ?? 1;

  const setLevelFor = (name: string, level: number) => {
    const clamped = Math.max(1, Math.min(70, level));
    setRecipeLevels((prev) => new Map(prev).set(name, clamped));
    // Update every meal slot that holds this recipe.
    const next = meals.map((m) =>
      m?.recipe === name ? { recipe: name, level: clamped } : m,
    );
    onChangeMeals(next);
  };

  const toggleMoment = (recipe: Recipe, momentIdx: number) => {
    const level = getLevelFor(recipe.name);
    const next = meals.map((m, i) => {
      if (i !== momentIdx) return m;
      // Clicking the same recipe on the same moment clears it.
      if (m?.recipe === recipe.name) return null;
      return { recipe: recipe.name, level };
    });
    onChangeMeals(next);
  };

  // Filter recipes.
  const q = normalize(search.trim());
  const filtered = recipes.filter((r) => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (q && !normalize(r.name).includes(q)) return false;
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
    <Modal title={t("teams.mealPickerTitle")} onClose={onClose} wide>
      {/* Tab bar */}
      <div className="settings-modal-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          id="settings-tab-island"
          aria-controls="settings-panel-island"
          aria-selected={activeTab === "island"}
          className={"specialty-toggle__btn" + (activeTab === "island" ? " is-on" : "")}
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
          className={"specialty-toggle__btn" + (activeTab === "meals" ? " is-on" : "")}
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
        <IslandTab
          catalog={catalog}
          selectedIsland={selectedIsland}
          favoriteBerries={favoriteBerries}
          islandBonus={islandBonus}
          onSelectIsland={onSelectIsland}
          onFavoriteBerries={onFavoriteBerries}
          onIslandBonus={onIslandBonus}
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
        {/* Top bar: type filter + search */}
        <div className="meal-picker-topbar">
          <div className="specialty-toggle" role="group" aria-label={t("teams.recipeType")}>
            <button
              type="button"
              className={"specialty-toggle__btn" + (typeFilter === null ? " is-on" : "")}
              aria-pressed={typeFilter === null}
              onClick={() => setTypeFilter(null)}
            >
              {t("teams.allTypes")}
            </button>
            {RECIPE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={"specialty-toggle__btn" + (typeFilter === type ? " is-on" : "")}
                aria-pressed={typeFilter === type}
                onClick={() => setTypeFilter(type)}
              >
                {type}
              </button>
            ))}
          </div>

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
            <span className="meal-picker-pot__label muted">{t("teams.potSize")}</span>
            <div className="level-stepper meal-picker-pot__stepper">
              <LevelStepperInput
                value={potSize}
                onChange={onPotSizeChange}
                min={1}
                max={150}
                ariaLabels={{
                  down: "−",
                  input: t("teams.potSize"),
                  up: "+",
                }}
              />
            </div>
            {cookingExtra > 0 && (
              <span className="meal-picker-pot__effective muted">
                +{Math.floor(cookingExtra / 3)} = <strong>{effectivePot}</strong>
              </span>
            )}
            {cookingExtra === 0 && (
              <span className="meal-picker-pot__effective muted">= {effectivePot}</span>
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
            <p className="muted" style={{ gridColumn: "1/-1", textAlign: "center" }}>
              {t("teams.noResults")}
            </p>
          ) : (
            sorted.map((r) => {
              const level = getLevelFor(r.name);
              const strength = recipeStrengthAtLevel(r.base_strength, level, levelBonus);

              const totalIngs = r.ingredients.reduce((s, ic) => s + ic.count, 0);
              const fits = totalIngs <= effectivePot;
              const fillers = effectivePot - totalIngs;

              return (
                <div key={r.name} className="meal-picker-card">
                  {/* Dish image */}
                  <div className="meal-picker-card__img-wrap">
                    <img
                      className="meal-picker-card__img"
                      src={recipeImage(r.name)}
                      alt={r.name}
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>

                  {/* Name + type badge */}
                  <div className="meal-picker-card__header">
                    <span className="meal-picker-card__name">{r.name}</span>
                    <span className="meal-picker-card__type-badge">{r.type}</span>
                  </div>

                  {/* Strength at current level */}
                  <div className="meal-picker-card__strength">
                    {strength.toLocaleString()}
                  </div>

                  {/* Ingredient icons row */}
                  <div className="meal-picker-card__ings">
                    {r.ingredients.map((ic) => (
                      <span key={ic.ingredient} className="meal-picker-card__ing">
                        <img
                          src={ingredientIcon(ic.ingredient)}
                          alt={ic.ingredient}
                          title={ic.ingredient}
                          style={{ width: 16, height: 16 }}
                        />
                        <span className="meal-picker-card__ing-count">×{ic.count}</span>
                      </span>
                    ))}
                  </div>

                  {/* Pot fit indicator */}
                  <div className={`meal-picker-card__pot-fit ${fits ? "meal-picker-card__pot-fit--ok" : "meal-picker-card__pot-fit--no"}`}>
                    <img src="/pot.webp" alt="" className="meal-picker-pot__icon" />
                    {fits
                      ? <span>{t("teams.potFits")} · {t("teams.fillers", { n: String(fillers) })}</span>
                      : <span>{t("teams.potNoFit")} ({totalIngs}/{effectivePot})</span>
                    }
                  </div>

                  {/* Level stepper */}
                  <div className="level-stepper meal-picker-card__stepper">
                    <LevelStepperInput
                      value={level}
                      onChange={(n) => setLevelFor(r.name, n)}
                      min={1}
                      max={70}
                      ariaLabels={{
                        down: t("teams.levelDown"),
                        input: t("teams.recipeLevel"),
                        up: t("teams.levelUp"),
                      }}
                    />
                  </div>

                  {/* 3 moment toggles */}
                  <div className="meal-picker-card__moments">
                    {MOMENT_LABELS.map((label, idx) => {
                      const isActive = meals[idx]?.recipe === r.name;
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={
                            "meal-picker-card__moment-btn" + (isActive ? " is-active" : "")
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
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
