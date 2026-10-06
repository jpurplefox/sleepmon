// Pokémon type icons (Scarlet/Violet small set, PokeAPI), keyed by the backend's Type value.
const TYPE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/types/generation-ix/scarlet-violet/small";

export const TYPE_IDS: Record<string, number> = {
  Normal: 1,
  Fighting: 2,
  Flying: 3,
  Poison: 4,
  Ground: 5,
  Rock: 6,
  Bug: 7,
  Ghost: 8,
  Steel: 9,
  Fire: 10,
  Water: 11,
  Grass: 12,
  Electric: 13,
  Psychic: 14,
  Ice: 15,
  Dragon: 16,
  Dark: 17,
  Fairy: 18,
};

export function typeIcon(type: string): string {
  return `${TYPE_BASE}/${TYPE_IDS[type] ?? 1}.png`;
}
