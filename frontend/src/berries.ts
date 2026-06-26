// Íconos de bayas de PokéAPI (gratuitos, servidos desde GitHub). Cada baya mapea a
// su sprite de item por el slug "<nombre>-berry", p. ej. "Durin" -> durin-berry.png.
const BERRY_BASE =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/berries";

export function berryIcon(name: string): string {
  return `${BERRY_BASE}/${name.toLowerCase()}-berry.png`;
}
