import { useI18n } from "../i18n";
import { fdown } from "../utils/format";

interface StrengthValueProps {
  value: number;
  base: number;
  bonus: number; // fraction 0–0.85
}

/**
 * Renders a strength number with an optional tooltip showing the base/with-bonus
 * breakdown. The tooltip only appears when the island bonus is active (bonus > 0)
 * and the base differs from the displayed value.
 *
 * Accessibility: the breakdown is available as a `title` attribute (native browser
 * tooltip) and as an `aria-label` on the wrapping element, so screen readers and
 * keyboard-only users can access the information.
 */
export function StrengthValue({ value, base, bonus }: StrengthValueProps) {
  const { t } = useI18n();

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

  return (
    <span
      className="strength-value--has-tooltip"
      title={tooltipText}
      aria-label={tooltipText}
    >
      {fdown(value)}
      <span className="strength-value__tooltip" aria-hidden="true">
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
