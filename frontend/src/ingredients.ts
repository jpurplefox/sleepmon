// Íconos de ingredientes. Por ahora son emojis (aproximación libre, sin hostear
// assets); se pueden cambiar por las imágenes reales del juego más adelante.
const ICONS: Record<string, string> = {
  "Large Leek": "🥬",
  "Tasty Mushroom": "🍄",
  "Fancy Egg": "🥚",
  "Soft Potato": "🥔",
  "Fancy Apple": "🍎",
  "Fiery Herb": "🌶️",
  "Bean Sausage": "🌭",
  "Moomoo Milk": "🥛",
  Honey: "🍯",
  "Pure Oil": "🫗",
  "Warming Ginger": "🫚",
  "Snoozy Tomato": "🍅",
  "Soothing Cacao": "🍫",
  "Slowpoke Tail": "🍢",
  "Greengrass Soybeans": "🫘",
  "Greengrass Corn": "🌽",
  "Rousing Coffee": "☕",
  "Plump Pumpkin": "🎃",
  "Glossy Avocado": "🥑",
};

export function ingredientIcon(name: string): string {
  return ICONS[name] ?? "❓";
}
