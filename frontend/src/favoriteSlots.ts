/**
 * Favorite berries as three positional slots, shared by Comparison and Team Analysis.
 * An open slot is "" so a removed berry leaves its place empty instead of the rest
 * shifting over it; the next pick fills the first open slot. On an expert map slot 1
 * is the main favorite, so emptying it leaves the main vacant, like any other slot.
 */
export const MAX_FAVORITES = 3;

/** The picked berries, without the open slots (what the backend and saved teams get). */
export function pickedFavorites(slots: readonly string[]): string[] {
  return slots.filter(Boolean);
}

/** The berry in slot 1, the main favorite on an expert map; null when it's open. */
export function slotOne(slots: readonly string[]): string | null {
  return slots[0] || null;
}

export function toggleFavoriteSlot(slots: readonly string[], berry: string): string[] {
  const at = slots.indexOf(berry);
  let next: string[];
  if (at >= 0) {
    next = slots.map((b, i) => (i === at ? "" : b));
  } else {
    if (pickedFavorites(slots).length >= MAX_FAVORITES) return [...slots];
    const open = slots.indexOf("");
    next = open >= 0 ? slots.map((b, i) => (i === open ? berry : b)) : [...slots, berry];
  }
  // Open slots at the end carry no place to keep.
  while (next.length > 0 && next[next.length - 1] === "") next.pop();
  return next;
}

/** Slots from a saved list and its main: the main in slot 1, the rest after it. */
export function slotsWithMainFirst(favorites: readonly string[], main: string | null): string[] {
  const picked = pickedFavorites(favorites);
  if (main === null || !picked.includes(main)) return picked;
  return [main, ...picked.filter((b) => b !== main)];
}
