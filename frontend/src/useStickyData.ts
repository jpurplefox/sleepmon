import { useRef } from "react";

/**
 * Each item's last loaded data, kept while its query reloads under a new key.
 * `useQueries` can't keep previous data (a new key is a new query), so without
 * this every card blanks to "Calculating…" and back on each map change: a flicker.
 * Items are matched by key, so a reorder never shows one card's data on another;
 * a removed item's data is dropped.
 */
export function useStickyData<T>(keys: string[], data: (T | undefined)[]): (T | undefined)[] {
  const last = useRef(new Map<string, T>());
  const next = new Map<string, T>();
  const shown = keys.map((key, i) => {
    const value = data[i] ?? last.current.get(key);
    if (value !== undefined) next.set(key, value);
    return value;
  });
  last.current = next;
  return shown;
}
