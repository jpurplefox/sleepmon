// Íconos de sub skills (los mismos que RaenonX), servidos desde /public/subskill.
// En el juego el ícono es por *familia/concepto* (Helping Speed S y M comparten
// ícono), así que mapeamos cada sub skill a su concepto.
const CONCEPT: Record<string, string> = {
  "Sleep EXP Bonus": "exp",
  "Research EXP Bonus": "research",
  "Skill Level Up S": "skillLevel",
  "Skill Level Up M": "skillLevel",
  "Helping Bonus": "helper",
  "Energy Recovery Bonus": "stamina",
  "Dream Shard Bonus": "shard",
  "Berry Finding S": "berryCount",
  "Skill Trigger S": "mainSkillProbability",
  "Skill Trigger M": "mainSkillProbability",
  "Ingredient Finder S": "ingredientProbability",
  "Ingredient Finder M": "ingredientProbability",
  "Helping Speed S": "frequency",
  "Helping Speed M": "frequency",
  "Inventory Up S": "inventory",
  "Inventory Up M": "inventory",
  "Inventory Up L": "inventory",
};

export function subSkillIcon(name: string): string {
  const concept = CONCEPT[name] ?? "exp";
  return `/subskill/${concept}.png`;
}
