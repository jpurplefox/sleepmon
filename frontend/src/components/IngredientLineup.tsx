import { INGREDIENT_UNLOCK_LEVELS } from "../constants";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";

interface Props {
  // Nivel del ejemplar: define qué slots están desbloqueados (los bloqueados se
  // pintan atenuados, mismo lenguaje que el picker).
  level: number;
  ingredients: string[];
}

// Fila de solo lectura con los íconos de los ingredientes equipados y su estado
// "bloqueado por nivel". Extraída para compartirla entre la config del picker
// (MemberConfig) y la columna propia de ingredientes de la Caja (BoxEntry), sin
// duplicar la lógica de locked. (No confundir con IngredientSlots, que es el editor
// del formulario.)
export function IngredientLineup({ level, ingredients }: Props) {
  const { ingredient } = useI18n();
  return (
    <span className="ingredient-row">
      {ingredients.map((ing, idx) => {
        const locked = level < (INGREDIENT_UNLOCK_LEVELS[idx] ?? 1);
        return (
          <img
            key={`${ing}-${idx}`}
            className={"ingredient-row__icon" + (locked ? " ingredient-row__icon--locked" : "")}
            src={ingredientIcon(ing)}
            alt={ingredient(ing)}
            title={ingredient(ing)}
            loading="lazy"
          />
        );
      })}
    </span>
  );
}
