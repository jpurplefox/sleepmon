import { RIBBONS } from "../constants";
import { useI18n } from "../i18n";
import { RibbonIcon } from "./RibbonIcon";
import { Stepper } from "./Stepper";

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
    <Stepper
      onPrev={() => go(-1)}
      onNext={() => go(1)}
      disablePrev={atStart}
      disableNext={atEnd}
      prevLabel={t("ribbon.prev")}
      nextLabel={t("ribbon.next")}
      leading={<RibbonIcon index={index} size={34} title={label} />}
      primary={label}
      secondary={effect}
    />
  );
}
