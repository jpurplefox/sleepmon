import type React from "react";

/**
 * The favorite slots as a bar: one segment per slot, filled when the slot holds a
 * berry (an open slot stays empty where it is, like the "?" in the summaries), and
 * the "done" color once all are filled. The bar is the count: no figures beside it.
 */
export function BerryCount({
  slots,
  max,
  label,
}: {
  /** Positional slots ("" is open, see favoriteSlots). */
  slots: readonly string[];
  max: number;
  /** Accessible name of the bar (what is being counted). */
  label: string;
}) {
  const count = slots.filter(Boolean).length;
  const full = count >= max;
  return (
    <div className={"berry-count" + (full ? " berry-count--full" : "")}>
      <div
        className="berry-count__bar"
        style={{ "--segments": max } as React.CSSProperties}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={count}
        aria-valuetext={`${count} / ${max}`}
      >
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={"berry-count__seg" + (slots[i] ? " is-filled" : "")} />
        ))}
      </div>
    </div>
  );
}
