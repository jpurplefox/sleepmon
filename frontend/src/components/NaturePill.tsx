import { useI18n } from "../i18n";
import { statIcon } from "../natures";
import type { Nature } from "../types";

// ▲/▼ drawn, not typed: a text glyph sits wherever each device's font puts it.
// Each triangle is placed in its 10×10 box so the middle between its box and its
// centroid lands on the box's center — a triangle's weight is at its base, so
// centering by the box alone would read low (▲) or high (▼).
function Arrow({ dir }: { dir: "up" | "down" }) {
  return (
    <svg className="nature-pill__arrow" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
      <path d={dir === "up" ? "M5 0 10 8.6H0z" : "M0 1.4h10L5 10z"} />
    </svg>
  );
}

// A neutral nature shows a circled X on both sides.
function XCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  // Undefined: no nature yet. The pill keeps its shape with empty marks so a row
  // of them stays aligned.
  nature: Nature | undefined;
  // The nature's name, inside the pill after a divider; omitted where the name is
  // shown elsewhere (a dropdown option, a tooltip).
  name?: string;
}

// A nature as one pill: ▲ the stat it raises, ▼ the one it lowers, then its name.
export function NaturePill({ nature, name }: Props) {
  const { t, natureStat } = useI18n();

  const mark = (dir: "up" | "down") => {
    const stat = nature && !nature.neutral ? (dir === "up" ? nature.increased : nature.decreased) : null;
    const label = stat
      ? t(dir === "up" ? "natureSel.raises" : "natureSel.lowers", { stat: natureStat(stat) })
      : nature
        ? t("natureSel.noEffect")
        : undefined;
    return (
      <span className={`nature-pill__mark nature-pill__mark--${dir}`} title={stat ? undefined : label}>
        <Arrow dir={dir} />
        {stat ? (
          <img src={statIcon(stat)} alt={label} title={label} />
        ) : nature ? (
          <XCircle />
        ) : (
          <span className="nature-pill__blank" aria-hidden />
        )}
      </span>
    );
  };

  return (
    <span className={"nature-pill" + (nature ? "" : " nature-pill--empty")}>
      {mark("up")}
      {mark("down")}
      {name && <span className="nature-pill__name">{name}</span>}
    </span>
  );
}
