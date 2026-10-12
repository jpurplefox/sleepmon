import { INGREDIENT_UNLOCK_LEVELS } from "../constants";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import type { Species } from "../types";

interface Props {
  species: Species | undefined;
  level: number;
  value: string[];
  onChange: (ingredients: string[]) => void;
}

export function IngredientSlots({ species, level, value, onChange }: Props) {
  const { t, ingredient } = useI18n();
  if (!species) return <EmptySlots />;

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
            <span className="ingredient-slot__label">{t("ingSlots.slot", { unlock })}</span>
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
                      title={ingredient(ing)}
                      aria-label={ingredient(ing)}
                      aria-pressed={value[i] === ing}
                    >
                      <img
                        className="ingredient-icon__img"
                        src={ingredientIcon(ing)}
                        alt={ingredient(ing)}
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

// Before a species is picked: the three slots, disabled, with a placeholder per option.
function EmptySlots() {
  const { t } = useI18n();
  return (
    <div className="ingredient-slots ingredient-slots--empty">
      {INGREDIENT_UNLOCK_LEVELS.map((unlock, i) => (
        <div key={unlock} className="ingredient-slot">
          <span className="ingredient-slot__label">{t("ingSlots.slot", { unlock })}</span>
          <div className="ingredient-slot__options">
            {Array.from({ length: i + 1 }, (_, j) => (
              <span key={j} className="ingredient-icon ingredient-icon--placeholder" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
