// The three specialties a filter or count can pick; mythicals ("All") count as each.
export const SPECIALTIES = ["Berries", "Ingredients", "Skills"] as const;

export const matchesSpecialty = (specialty: string | undefined, filter: string): boolean =>
  !filter || specialty === filter || specialty === "All";
