import type { ReactNode } from "react";

import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { recipeImage, recipeStrengthAtLevel } from "../recipes";
import { CHARGE_STRENGTH_ICON } from "../skillIcons";
import type { Recipe } from "../types";
import { LevelStepperInput } from "./LevelStepperInput";

/** Search normalization: no case, no accents. */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

interface Props {
  recipe: Recipe;
  level: number;
  levelBonus: number[];
  onLevelChange: (level: number) => void;
  /** Meal-plan extras (pot fit, the three moment toggles). Absent in Player progress. */
  footer?: ReactNode;
}

export function RecipeCard({ recipe, level, levelBonus, onLevelChange, footer }: Props) {
  const { t } = useI18n();
  const strength = recipeStrengthAtLevel(recipe.base_strength, level, levelBonus);

  return (
    <div className="meal-picker-card">
      <div className="meal-picker-card__img-wrap">
        <img
          className="meal-picker-card__img"
          src={recipeImage(recipe.name)}
          alt={recipe.name}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>

      <div className="meal-picker-card__header">
        <span className="meal-picker-card__name">{recipe.name}</span>
        <span className="meal-picker-card__type-badge">{recipe.type}</span>
      </div>

      <div className="meal-picker-card__strength">
        <img className="mini-icon" src={CHARGE_STRENGTH_ICON} alt="" style={{ width: 14, height: 14 }} />{" "}
        {strength.toLocaleString()}
      </div>

      <div className="meal-picker-card__ings">
        {recipe.ingredients.map((ic) => (
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

      {footer}

      <div className="level-stepper meal-picker-card__stepper">
        <LevelStepperInput
          value={level}
          onChange={onLevelChange}
          min={1}
          max={70}
          ariaLabels={{
            down: t("teams.levelDown"),
            input: t("teams.recipeLevel"),
            up: t("teams.levelUp"),
          }}
        />
      </div>
    </div>
  );
}
