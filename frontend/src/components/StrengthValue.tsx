import type React from "react";
import { useRef, useState } from "react";
import { useI18n } from "../i18n";
import { fdown } from "../utils/format";

interface StrengthValueProps {
  value: number;
  base: number;
  bonus: number; // fraction 0–0.85
}

// The tooltip min-width in CSS is 13rem. We use the same value here to decide
// which side to anchor: if the trigger is too close to the right edge, anchor
// the tooltip to the right instead of the left so it never overflows the viewport.
const TOOLTIP_MIN_WIDTH_PX = 13 * 16;

/**
 * Renders a strength number with an optional tooltip showing the base/with-bonus
 * breakdown. The tooltip only appears when the island bonus is active (bonus > 0)
 * and the base differs from the displayed value.
 *
 * Positioning: on mouseenter/focus we measure the trigger's bounding rect and
 * flip the anchor to `right: 0` when the trigger is within TOOLTIP_MIN_WIDTH_PX
 * of the right viewport edge, preventing overflow on either side. The CSS
 * `left: 0` fallback (before JS runs) is overridden by the inline style.
 *
 * Accessibility: the breakdown is available as a `title` attribute (native browser
 * tooltip) and as an `aria-label` on the wrapping element, so screen readers and
 * keyboard-only users can access the information.
 */
export function StrengthValue({ value, base, bonus }: StrengthValueProps) {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [anchorRight, setAnchorRight] = useState(false);

  // Product rule: show the breakdown only when the Area bonus is active AND
  // the bonus actually changes the displayed integer (i.e. the floor differs).
  // This prevents showing a tooltip on derived values or when the bonus rounds
  // away entirely. If bonus===0 or floor(base)===floor(value), render bare number.
  const hasBreakdown = bonus > 0 && Math.floor(base) !== Math.floor(value);

  if (!hasBreakdown) {
    return <>{fdown(value)}</>;
  }

  const bonusPct = Math.round(bonus * 100);
  const baseLabel = t("teams.strengthBase");
  const bonusDeltaLabel = t("teams.strengthBonusDelta", { bonus: String(bonusPct) });
  const tooltipText = `${baseLabel}: ${fdown(base)} · ${bonusDeltaLabel}: +${fdown(value - base)}`;

  const handleReveal = () => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    setAnchorRight(rect.left + TOOLTIP_MIN_WIDTH_PX > window.innerWidth - 16);
  };

  const tooltipStyle: React.CSSProperties = anchorRight
    ? { left: "auto", right: 0 }
    : { left: 0, right: "auto" };

  return (
    <span
      ref={wrapRef}
      className="strength-value--has-tooltip"
      title={tooltipText}
      aria-label={tooltipText}
      onMouseEnter={handleReveal}
      onFocus={handleReveal}
    >
      {fdown(value)}
      <span className="strength-value__tooltip" style={tooltipStyle} aria-hidden="true">
        <span className="strength-value__tooltip-row">
          <span className="strength-value__tooltip-label">{baseLabel}</span>
          <span className="strength-value__tooltip-val">{fdown(base)}</span>
        </span>
        <span className="strength-value__tooltip-row">
          <span className="strength-value__tooltip-label">{bonusDeltaLabel}</span>
          <span className="strength-value__tooltip-val">+{fdown(value - base)}</span>
        </span>
      </span>
    </span>
  );
}
