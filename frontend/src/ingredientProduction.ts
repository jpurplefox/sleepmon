import type { MemberProduction } from "./types";

// Producción combinada por ingrediente: mecánica normal (ingredients) + lo que
// aporta la main skill específica (skill_ingredients). NO incluye el total al azar
// (Ingredient Magnet), que no se asocia a un ingrediente puntual.
export function combinedIngredientTotals(prod: MemberProduction): Map<string, number> {
  const totals = new Map<string, number>();
  for (const s of prod.ingredients) totals.set(s.ingredient, (totals.get(s.ingredient) ?? 0) + s.amount);
  for (const s of prod.skill_ingredients)
    totals.set(s.ingredient, (totals.get(s.ingredient) ?? 0) + s.amount);
  return totals;
}

// Ingrediente principal: el de mayor producción combinada (base + skill). null si
// el Pokémon no produce ningún ingrediente específico.
export function mainIngredient(prod: MemberProduction): string | null {
  let best: string | null = null;
  let bestAmount = 0;
  for (const [ing, amount] of combinedIngredientTotals(prod)) {
    if (amount > bestAmount) {
      best = ing;
      bestAmount = amount;
    }
  }
  return best;
}

// Producción total de ingredientes/día: base + ingredientes específicos de la
// skill + ingredientes al azar de la skill (Ingredient Magnet).
export function totalIngredients(prod: MemberProduction): number {
  const base = prod.ingredients_total;
  const skill = prod.skill_ingredients.reduce((a, s) => a + s.amount, 0);
  const random = prod.skill_ingredient_total ?? 0;
  return base + skill + random;
}
