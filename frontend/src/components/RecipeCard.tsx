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
  /** Content rendered above the level stepper (e.g. the pot-fit line). Absent in Player progress. */
  beforeStepper?: ReactNode;
  /** Content rendered below the level stepper (e.g. the moment toggles). Absent in Player progress. */
  afterStepper?: ReactNode;
  /** The unsaved mark for this recipe's level. Absent in Player progress, where every edit is already saved. */
  mark?: ReactNode;
}

export function RecipeCard({
  recipe,
  level,
  levelBonus,
  onLevelChange,
  beforeStepper,
  afterStepper,
  mark,
}: Props) {
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

      {beforeStepper}

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

      {mark}

      {afterStepper}
    </div>
  );
}
