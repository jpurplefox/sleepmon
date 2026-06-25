// Sprites de PokéAPI (gratuitos, servidos desde GitHub) por número de Pokédex.
const SPRITE_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

export function spriteUrl(dex: number): string {
  return `${SPRITE_BASE}/${dex}.png`;
}
