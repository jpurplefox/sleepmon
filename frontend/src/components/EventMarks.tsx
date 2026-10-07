import { EVENT_KINDS, SPECIALTY_ICON, formatEffectValue, type EventEffect } from "../eventBonus";
import { useI18n } from "../i18n";
import { typeIcon } from "../typeIcons";

/** The active event's effects as marks; nothing when there are none. */
export function EventMarks({ effects }: { effects: EventEffect[] }) {
  const { t, lang, type: typeName, specialty } = useI18n();
  if (effects.length === 0) return null;
  return (
    <span className="ctx-marks">
      {effects.map((e) => {
        const value = formatEffectValue(e.kind, e.value, lang);
        const scope =
          e.scope.kind === "type" && e.scope.type
            ? { icon: typeIcon(e.scope.type), label: typeName(e.scope.type), round: true }
            : e.scope.kind === "specialty"
              ? { icon: SPECIALTY_ICON[e.scope.specialty], label: specialty(e.scope.specialty), round: false }
              : null;
        const full = [t(EVENT_KINDS[e.kind].labelKey) + " " + value, scope?.label].filter(Boolean).join(" · ");
        return (
          <span key={e.id} className="metric-mark metric-mark--good" title={full} aria-label={full}>
            <img className="metric-mark__icon" src={EVENT_KINDS[e.kind].icon} alt="" />
            {value}
            {scope && (
              <img className={"metric-mark__icon" + (scope.round ? " type-icon" : "")} src={scope.icon} alt="" />
            )}
          </span>
        );
      })}
    </span>
  );
}
