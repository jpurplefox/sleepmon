import type React from "react";
import { useRef, useState } from "react";

interface TooltipProps {
  /** Content shown in the bubble — a plain string or rich nodes (`Tooltip.Row`). */
  content: React.ReactNode;
  /** Accessible text. Defaults to `content` when it's a string. */
  label?: string;
  /** The trigger. */
  children: React.ReactNode;
  /** Extra class on the trigger wrapper (e.g. a cursor/underline cue). */
  className?: string;
}

// Keep the bubble this many px away from either viewport edge.
const VIEWPORT_MARGIN = 8;

/**
 * The single tooltip in the app: a bubble above its trigger, revealed on hover
 * and keyboard focus. It centers over the trigger and clamps to the viewport so
 * it never overflows on either edge, for any bubble width. Rich content uses the
 * `Tooltip.Row` / `Tooltip.Label` / `Tooltip.Value` helpers.
 */
export function Tooltip({ content, label, children, className }: TooltipProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [left, setLeft] = useState<number | null>(null);

  const ariaLabel = label ?? (typeof content === "string" ? content : undefined);

  // On reveal, measure the trigger and the bubble and pick a left offset (relative
  // to the trigger) that centers the bubble but stays inside the viewport.
  const position = () => {
    const wrap = wrapRef.current;
    const bubble = bubbleRef.current;
    if (!wrap || !bubble) return;
    const t = wrap.getBoundingClientRect();
    const width = bubble.offsetWidth;
    let x = t.width / 2 - width / 2;
    const vpLeft = t.left + x;
    if (vpLeft < VIEWPORT_MARGIN) x += VIEWPORT_MARGIN - vpLeft;
    const vpRight = t.left + x + width;
    if (vpRight > window.innerWidth - VIEWPORT_MARGIN) {
      x -= vpRight - (window.innerWidth - VIEWPORT_MARGIN);
    }
    setLeft(x);
  };

  return (
    <span
      ref={wrapRef}
      className={className ? `tooltip ${className}` : "tooltip"}
      aria-label={ariaLabel}
      onMouseEnter={position}
      onFocus={position}
    >
      {children}
      <span
        ref={bubbleRef}
        className="tooltip__bubble"
        style={left != null ? { left: `${left}px` } : undefined}
        aria-hidden="true"
      >
        {content}
      </span>
    </span>
  );
}

/** A label/value row for a rich tooltip (e.g. a base/with-bonus breakdown). */
Tooltip.Row = function TooltipRow({ children }: { children: React.ReactNode }) {
  return <span className="tooltip__row">{children}</span>;
};

Tooltip.Label = function TooltipLabel({ children }: { children: React.ReactNode }) {
  return <span className="tooltip__label">{children}</span>;
};

Tooltip.Value = function TooltipValue({ children }: { children: React.ReactNode }) {
  return <span className="tooltip__val">{children}</span>;
};
