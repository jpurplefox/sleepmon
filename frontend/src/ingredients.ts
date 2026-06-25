// Íconos reales del juego, servidos por nosotros desde /public/ingredients
// (descargados de Bulbagarden Archives). Cada ingrediente mapea a su PNG por el
// slug de su nombre, p. ej. "Bean Sausage" -> /ingredients/bean-sausage.png.
function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export function ingredientIcon(name: string): string {
  return `/ingredients/${slug(name)}.png`;
}
