// Imágenes oficiales de los Good-Night Ribbons (extraídas del juego, vía
// nerolis-lab), servidas desde /public/ribbon. El índice coincide con el nivel del
// listón (1=200h, 2=500h, 3=1000h, 4=2000h); el 0 (sin listón) reusa el nivel 1 en
// gris.
export function ribbonIcon(index: number): string {
  const level = Math.max(1, Math.min(4, index));
  return `/ribbon/ribbon${level}.png`;
}
