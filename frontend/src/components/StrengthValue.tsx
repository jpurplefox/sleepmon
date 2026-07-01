import { useI18n } from "../i18n";

interface StrengthValueProps {
  value: number;
  base: number;
  bonus: number; // fraction 0–0.85
}

// Formateo idéntico al de Teams.tsx: floor hacia abajo, locale en-US.
const fdown = (n: number) => Math.floor(n).toLocaleString("en-US");

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

  const hasBreakdown = bonus > 0 && Math.floor(base) !== Math.floor(value);

  if (!hasBreakdown) {
    return <>{fdown(value)}</>;
  }

  const bonusPct = Math.round(bonus * 100);
  const baseLabel = t("teams.strengthBase");
  const withBonusLabel = t("teams.strengthWithBonus", { bonus: String(bonusPct) });
  const tooltipText = `${baseLabel}: ${fdown(base)} · ${withBonusLabel}: ${fdown(value)}`;

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
          <span className="strength-value__tooltip-label">{withBonusLabel}</span>
          <span className="strength-value__tooltip-val">{fdown(value)}</span>
        </span>
      </span>
    </span>
  );
}
