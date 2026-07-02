// Cálculo del pote de cocina. El pote es puramente frontend (el backend no lo
// calcula). El Good Camp Ticket lo hace 50% más grande, redondeado hacia arriba,
// contando la base y el extra por skill; el redondeo ocurre por comida.

/** Pote efectivo por comida (base + parte del extra por skill del equipo). */
export function perMealPot(
  potSize: number,
  cookingExtra: number,
  goodCampTicket: boolean,
): number {
  if (goodCampTicket) {
    return Math.ceil((potSize + cookingExtra / 3) * 1.5);
  }
  return potSize + Math.floor(cookingExtra / 3);
}

/** Capacidad diaria total del pote (3 comidas). */
export function dailyPotCapacity(
  potSize: number,
  cookingExtra: number,
  goodCampTicket: boolean,
): number {
  if (goodCampTicket) {
    return perMealPot(potSize, cookingExtra, goodCampTicket) * 3;
  }
  return potSize * 3 + cookingExtra;
}
