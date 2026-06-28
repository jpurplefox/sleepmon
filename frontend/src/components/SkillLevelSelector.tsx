import { useEffect } from "react";

import { maxSkillLevel, skillDescription } from "../skills";

interface Props {
  value: number;
  onChange: (level: number) => void;
  // Main skill de la especie elegida (para el nombre, la bajada y el nivel máximo).
  // undefined si todavía no se eligió especie.
  mainSkill?: string;
}

// Stepper del nivel de la main skill, al estilo del de listones: se avanza /
// retrocede con los botones y el panel muestra el nivel, el nombre de la skill y
// su bajada real del juego (con la cantidad del nivel ya resuelta). El máximo
// depende de la skill (E4E topa en 6; el resto en 7).
export function SkillLevelSelector({ value, onChange, mainSkill }: Props) {
  const max = maxSkillLevel(mainSkill);

  // Si al cambiar de especie el nivel quedó por encima del tope de la nueva skill,
  // lo bajamos al tope (p. ej. de un Crustle en Nv.7 a un Sylveon, que topa en 6).
  useEffect(() => {
    if (value > max) onChange(max);
  }, [value, max, onChange]);

  const atStart = value <= 1;
  const atEnd = value >= max;

  const go = (delta: number) => {
    const next = value + delta;
    if (next >= 1 && next <= max) onChange(next);
  };

  const desc = skillDescription(mainSkill, value);

  return (
    <div className="skill-stepper">
      <button
        type="button"
        className="skill-step"
        onClick={() => go(-1)}
        disabled={atStart}
        aria-label="Bajar nivel de skill"
      >
        ‹
      </button>

      <div className="skill-stepper__display">
        <span className="skill-stepper__level" title={`Nivel de skill ${value} de ${max}`}>
          {value}
        </span>
        <div className="skill-stepper__text">
          <span className="skill-stepper__name">{mainSkill ?? "Elegí una especie"}</span>
          {desc && <span className="skill-stepper__desc">{desc}</span>}
        </div>
      </div>

      <button
        type="button"
        className="skill-step"
        onClick={() => go(1)}
        disabled={atEnd}
        aria-label="Subir nivel de skill"
      >
        ›
      </button>
    </div>
  );
}
