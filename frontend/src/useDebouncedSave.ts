import { useEffect, useRef, useState } from "react";

// A drag/click burst fires many updates in a row; wait for it to settle before
// saving, so one gesture produces one PATCH instead of one per step.
const SAVE_DEBOUNCE_MS = 300;

/**
 * A locally-editable value layered over one that only moves once its save
 * round-trips. Every edit updates the shown value immediately and restarts the
 * debounce, so a rapid burst collapses into a single save of the last value
 * instead of each step recomputing from a still-stale server value.
 */
export function useDebouncedSave<T>(
  saved: T,
  onSave: (value: T) => void,
): [T, (next: T) => void] {
  const [value, setValue] = useState(saved);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow the saved value once nothing is pending; a local edit not yet sent
  // must not be clobbered by an unrelated cache refresh.
  useEffect(() => {
    if (timerRef.current === null) setValue(saved);
  }, [saved]);

  // Cancel an armed debounce if the caller unmounts before it fires.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (next: T): void => {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onSave(next);
    }, SAVE_DEBOUNCE_MS);
  };

  return [value, handleChange];
}
