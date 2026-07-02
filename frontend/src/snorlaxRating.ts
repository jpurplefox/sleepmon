import type { Rating } from "./types";

export interface ResolvedRating {
  reached: Rating;
  next: Rating | null;
  remaining: number;
}

/**
 * Dado el total semanal y los 35 ratings de una isla (ascendentes), devuelve el
 * rating más alto alcanzado, el siguiente (o null en el tope) y cuánta fuerza
 * falta para el siguiente. `null` si no hay ratings.
 */
export function resolveRating(
  weeklyStrength: number,
  ratings: Rating[],
): ResolvedRating | null {
  if (ratings.length === 0) return null;
  let reachedIdx = 0;
  for (let i = 0; i < ratings.length; i++) {
    if (weeklyStrength >= ratings[i].required_strength) reachedIdx = i;
    else break;
  }
  const reached = ratings[reachedIdx];
  const next = reachedIdx + 1 < ratings.length ? ratings[reachedIdx + 1] : null;
  const remaining = next ? next.required_strength - weeklyStrength : 0;
  return { reached, next, remaining };
}
