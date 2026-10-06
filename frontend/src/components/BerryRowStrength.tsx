import { useI18n } from "../i18n";
import { GENERIC_BERRY_ICON } from "../skillIcons";
import type { TeamBerryRow } from "../types";
import { fdown } from "../utils/format";
import { StrengthValue } from "./StrengthValue";
import { Tooltip } from "./Tooltip";

interface BerryRowStrengthProps {
  row: TeamBerryRow;
  bonus: number; // area bonus fraction 0–0.85
}

/**
 * A team berry row's strength. Rows fed by a main skill break it down by source
 * (helps / each skill owner) plus the area bonus in one tooltip; other rows keep
 * {@link StrengthValue}'s bonus-only tooltip.
 */
export function BerryRowStrength({ row, bonus }: BerryRowStrengthProps) {
  const { t } = useI18n();
  const bursts = row.sources.filter((s) => s.kind === "skill");
  if (bursts.length === 0) {
    return <StrengthValue value={row.strength} base={row.strength_base} bonus={bonus} />;
  }

  const helps = row.sources.find((s) => s.kind === "helps");
  const hasBonus = bonus > 0 && Math.floor(row.strength_base) !== Math.floor(row.strength);
  const bonusLabel = t("teams.strengthBonusDelta", { bonus: String(Math.round(bonus * 100)) });
  const lines = [
    ...(helps && helps.amount > 0
      ? [{ key: "helps", label: t("teams.fromHelps", { amount: helps.amount.toFixed(1) }), value: helps.strength_base, icon: false }]
      : []),
    ...bursts.map((s) => ({
      key: s.member_id ?? "burst",
      label: t("teams.fromSkillBerries", { species: s.species ?? "", amount: s.amount.toFixed(1) }),
      value: s.strength_base,
      icon: true,
    })),
  ];
  const aria = [
    ...lines.map((l) => `${l.label}: ${fdown(l.value)}`),
    ...(hasBonus ? [`${bonusLabel}: +${fdown(row.strength - row.strength_base)}`] : []),
  ].join(" · ");

  return (
    <Tooltip
      className="tooltip--sources"
      label={aria}
      content={
        <>
          {lines.map((l) => (
            <Tooltip.Row key={l.key}>
              <Tooltip.Label>
                {l.icon && <img src={GENERIC_BERRY_ICON} alt="" />} {l.label}
              </Tooltip.Label>
              <Tooltip.Value>{fdown(l.value)}</Tooltip.Value>
            </Tooltip.Row>
          ))}
          {hasBonus && (
            <Tooltip.Row className="tooltip__row--bonus">
              <Tooltip.Label>{bonusLabel}</Tooltip.Label>
              <Tooltip.Value>+{fdown(row.strength - row.strength_base)}</Tooltip.Value>
            </Tooltip.Row>
          )}
        </>
      }
    >
      <span className="strength-value__cue">{fdown(row.strength)}</span>
    </Tooltip>
  );
}
