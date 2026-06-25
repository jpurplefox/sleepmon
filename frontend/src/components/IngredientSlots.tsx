import { INGREDIENT_UNLOCK_LEVELS } from "../constants";
import { ingredientIcon } from "../ingredients";
import type { Species } from "../types";

interface Props {
  species: Species | undefined;
  level: number;
  value: string[];
  onChange: (ingredients: string[]) => void;
}

export function IngredientSlots({ species, level, value, onChange }: Props) {
  if (!species) return null;

  const setSlot = (slot: number, ingredient: string) => {
    const next = [...value];
    next[slot] = ingredient;
    onChange(next);
  };

  return (
    <div className="ingredient-slots">
      {species.ingredient_slots.map((options, i) => {
        const unlock = INGREDIENT_UNLOCK_LEVELS[i] ?? 1;
        const locked = level < unlock;
        return (
          <div
            key={i}
            className={"ingredient-slot" + (locked ? " ingredient-slot--locked" : "")}
          >
            <span className="ingredient-slot__label">Lv {unlock}</span>
            <div className="ingredient-slot__options">
              {options.map((ing) => (
                <button
                  type="button"
                  key={ing}
                  className={
                    "ingredient-icon" + (value[i] === ing ? " ingredient-icon--active" : "")
                  }
                  onClick={() => setSlot(i, ing)}
                  title={ing}
                  aria-label={ing}
                  aria-pressed={value[i] === ing}
                >
                  <span className="ingredient-icon__emoji">{ingredientIcon(ing)}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
