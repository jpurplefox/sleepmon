import { RIBBONS } from "../constants";
import { useI18n } from "../i18n";
import { RibbonIcon } from "./RibbonIcon";

interface Props {
  value: string;
  onChange: (next: string) => void;
}

// Stepper de listón: arranca sin listón y se avanza/retrocede con los botones a
// izquierda y derecha. Muestra el ícono del listón, las horas de sueño y el efecto.
export function RibbonSelect({ value, onChange }: Props) {
  const { t, lang } = useI18n();
  const found = RIBBONS.findIndex((r) => r.name === value);
  const index = found === -1 ? 0 : found;
  const tier = RIBBONS[index];
  const atStart = index === 0;
  const atEnd = index === RIBBONS.length - 1;

  const go = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < RIBBONS.length) onChange(RIBBONS[next].name);
  };

  const label =
    tier.hours === 0
      ? t("ribbon.none")
      : t("ribbon.hours", { hours: tier.hours.toLocaleString(lang) });
  const effect =
    tier.hours === 0
      ? t("ribbon.noneEffect")
      : t("ribbon.effect", { inv: tier.inventoryBonus }) + (tier.speed ? t("ribbon.speed") : "");

  return (
    <div className="ribbon-select">
      <button
        type="button"
        className="ribbon-step"
        onClick={() => go(-1)}
        disabled={atStart}
        aria-label={t("ribbon.prev")}
      >
        ‹
      </button>

      <div className="ribbon-display">
        <RibbonIcon index={index} size={34} title={label} />
        <div className="ribbon-display__text">
          <span className="ribbon-display__label">{label}</span>
          <span className="ribbon-display__effect">{effect}</span>
        </div>
      </div>

      <button
        type="button"
        className="ribbon-step"
        onClick={() => go(1)}
        disabled={atEnd}
        aria-label={t("ribbon.next")}
      >
        ›
      </button>
    </div>
  );
}
