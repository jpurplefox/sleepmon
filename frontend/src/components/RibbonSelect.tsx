import { RIBBONS } from "../constants";
import { RibbonIcon } from "./RibbonIcon";

interface Props {
  value: string;
  onChange: (next: string) => void;
}

// Stepper de listón: arranca sin listón y se avanza/retrocede con los botones a
// izquierda y derecha. Muestra el ícono del listón, las horas de sueño y el efecto.
export function RibbonSelect({ value, onChange }: Props) {
  const found = RIBBONS.findIndex((r) => r.name === value);
  const index = found === -1 ? 0 : found;
  const tier = RIBBONS[index];
  const atStart = index === 0;
  const atEnd = index === RIBBONS.length - 1;

  const go = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < RIBBONS.length) onChange(RIBBONS[next].name);
  };

  const label = tier.hours === 0 ? "Sin listón" : `${tier.hours.toLocaleString("es")} h`;
  const effect =
    tier.hours === 0
      ? "Dormí con el Pokémon para ganar listones"
      : `+${tier.inventoryBonus} inventario${tier.speed ? " · más velocidad" : ""}`;

  return (
    <div className="ribbon-select">
      <button
        type="button"
        className="ribbon-step"
        onClick={() => go(-1)}
        disabled={atStart}
        aria-label="Listón anterior"
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
        aria-label="Listón siguiente"
      >
        ›
      </button>
    </div>
  );
}
