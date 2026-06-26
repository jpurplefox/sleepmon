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
            {locked && (
              <span className="muted ingredient-slot__lock">
                Lv {unlock} para desbloquear
              </span>
            )}
            <div className="ingredient-slot__options">
              {options.map((ing, j) => {
                // Cantidad de ESTE ingrediente en este slot (depende del ingrediente).
                const amount = species.ingredient_amounts[i]?.[j];
                return (
                  <div key={ing} className="ingredient-option">
                    <button
                      type="button"
                      className={
                        "ingredient-icon" +
                        (value[i] === ing ? " ingredient-icon--active" : "")
                      }
                      onClick={() => setSlot(i, ing)}
                      title={ing}
                      aria-label={ing}
                      aria-pressed={value[i] === ing}
                    >
                      <img
                        className="ingredient-icon__img"
                        src={ingredientIcon(ing)}
                        alt={ing}
                        loading="lazy"
                      />
                    </button>
                    {amount != null && (
                      <span className="ingredient-option__amount">×{amount}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
