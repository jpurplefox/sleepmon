import { useState } from "react";

import { useI18n } from "../i18n";
import { recipeLevelOf } from "../progress";
import { RECIPE_TYPES } from "../recipes";
import { useDebouncedSave } from "../useDebouncedSave";
import type { PlayerProgress, ProgressPatch, Recipe } from "../types";
import { Placeholder } from "./Placeholder";
import { RecipeCard, normalizeSearch } from "./RecipeCard";

// One row's local, debounced level — so a burst of stepper clicks collapses
// into a single save instead of each click recomputing from a stale level.
function RecipeLevelCard({
  recipe,
  level,
  levelBonus,
  onSave,
}: {
  recipe: Recipe;
  level: number;
  levelBonus: number[];
  onSave: (level: number) => void;
}) {
  const [value, handleChange] = useDebouncedSave(level, onSave);
  return (
    <RecipeCard
      recipe={recipe}
      level={value}
      levelBonus={levelBonus}
      onLevelChange={handleChange}
    />
  );
}

interface Props {
  progress: PlayerProgress;
  recipes: Recipe[];
  levelBonus: number[];
  onSave: (patch: ProgressPatch) => void;
}

export function ProgressRecipesTab({ progress, recipes, levelBonus, onSave }: Props) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<Recipe["type"] | null>(null);

  const q = normalizeSearch(search.trim());
  const shown = recipes
    .filter((r) => (type === null || r.type === type) && (!q || normalizeSearch(r.name).includes(q)))
    .sort((a, b) => {
      const ta = RECIPE_TYPES.indexOf(a.type);
      const tb = RECIPE_TYPES.indexOf(b.type);
      return ta !== tb ? ta - tb : b.base_strength - a.base_strength;
    });

  return (
    <>
      <h3 className="progress-section__head">{t("progress.recipeLevels")}</h3>
      <div className="meal-picker-topbar">
        <div className="meal-picker-dish-type">
          <span className="meal-picker-dish-type__label muted">{t("teams.dishType")}:</span>
          <div className="specialty-toggle" role="group" aria-label={t("teams.dishType")}>
            <button
              type="button"
              className={"specialty-toggle__btn" + (type === null ? " is-on" : "")}
              aria-pressed={type === null}
              onClick={() => setType(null)}
            >
              {t("teams.allTypes")}
            </button>
            {RECIPE_TYPES.map((rt) => (
              <button
                key={rt}
                type="button"
                className={"specialty-toggle__btn" + (type === rt ? " is-on" : "")}
                aria-pressed={type === rt}
                onClick={() => setType(rt)}
              >
                {rt}
              </button>
            ))}
          </div>
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
      </div>

      <div className="meal-picker-grid">
        {shown.length === 0 ? (
          <Placeholder>{t("teams.noResults")}</Placeholder>
        ) : (
          shown.map((r) => (
            <RecipeLevelCard
              key={r.name}
              recipe={r}
              level={recipeLevelOf(progress, r.name)}
              levelBonus={levelBonus}
              onSave={(level) => onSave({ recipe_levels: { [r.name]: level } })}
            />
          ))
        )}
      </div>
    </>
  );
}
