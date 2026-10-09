import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

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

// The horizontal room the bubble may use: the viewport, narrowed to the nearest
// ancestor that clips sideways (e.g. the swiped card deck on a phone), so the
// bubble isn't cut off by a container that ends before the screen does.
function horizontalBounds(el: HTMLElement): { min: number; max: number } {
  // Not innerWidth: on mobile it grows to fit the overflowing bubble itself.
  let min = 0;
  let max = document.documentElement.clientWidth;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (getComputedStyle(p).overflowX !== "visible") {
      const r = p.getBoundingClientRect();
      min = Math.max(min, r.left);
      max = Math.min(max, r.right);
      break;
    }
  }
  return { min: min + VIEWPORT_MARGIN, max: max - VIEWPORT_MARGIN };
}

/**
 * The single tooltip in the app: a bubble above its trigger, revealed on mouse
 * hover, keyboard focus, or a tap (which toggles it; a tap elsewhere or Escape
 * closes it). It centers over the trigger and clamps to the viewport (or a clipping
 * ancestor, when one ends sooner) so it never overflows on either edge, for any bubble width. Rich content uses the
 * `Tooltip.Row` / `Tooltip.Label` / `Tooltip.Value` helpers.
 */
export function Tooltip({ content, label, children, className }: TooltipProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [left, setLeft] = useState<number | null>(null);
  // React owns reveal/hide (no CSS :hover/:focus-within): each way in is tracked
  // on its own and OR'd, so the bubble stays open while any is true.
  // Hover counts only for a real mouse: a touch's emulated hover would stick.
  const [hovered, setHovered] = useState(false);
  // Focus counts only from the keyboard: a tapped button keeps focus, and would too.
  const [focused, setFocused] = useState(false);
  const [tapped, setTapped] = useState(false);
  const lastPointer = useRef("mouse");
  const open = hovered || focused || tapped;

  // A tapped bubble stays until a tap elsewhere or Escape.
  useEffect(() => {
    if (!tapped) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setTapped(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTapped(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [tapped]);

  const ariaLabel = label ?? (typeof content === "string" ? content : undefined);

  // Measure the trigger and the bubble and pick a left offset (relative to the
  // trigger) that centers the bubble but stays inside the viewport.
  const position = () => {
    const wrap = wrapRef.current;
    const bubble = bubbleRef.current;
    if (!wrap || !bubble) return;
    const t = wrap.getBoundingClientRect();
    const width = bubble.offsetWidth;
    let x = t.width / 2 - width / 2;
    const { min, max } = horizontalBounds(wrap);
    const vpLeft = t.left + x;
    if (vpLeft < min) x += min - vpLeft;
    const vpRight = t.left + x + width;
    if (vpRight > max) x -= vpRight - max;
    setLeft(x);
  };

  // Runs after the bubble commits as open but before the browser paints, so the
  // measured `left` lands in the same paint as the reveal — never a jump from
  // the CSS resting position (left: 0).
  useLayoutEffect(() => {
    if (open) position();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={className ? `tooltip ${className}` : "tooltip"}
      aria-label={ariaLabel}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
      onPointerDown={(e) => (lastPointer.current = e.pointerType)}
      onClick={() => lastPointer.current !== "mouse" && setTapped((t) => !t)}
      onFocus={(e) => setFocused(e.target.matches(":focus-visible"))}
      onBlur={() => setFocused(false)}
    >
      {children}
      <span
        ref={bubbleRef}
        className="tooltip__bubble"
        style={{ display: open ? "flex" : "none", ...(left != null ? { left: `${left}px` } : {}) }}
        aria-hidden="true"
      >
        {content}
      </span>
    </span>
  );
}

/** A label/value row for a rich tooltip (e.g. a base/with-bonus breakdown). */
Tooltip.Row = function TooltipRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={className ? `tooltip__row ${className}` : "tooltip__row"}>{children}</span>;
};

Tooltip.Label = function TooltipLabel({ children }: { children: React.ReactNode }) {
  return <span className="tooltip__label">{children}</span>;
};

Tooltip.Value = function TooltipValue({ children }: { children: React.ReactNode }) {
  return <span className="tooltip__val">{children}</span>;
};
