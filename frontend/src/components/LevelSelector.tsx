import { useEffect, useState } from "react";

import { LEVEL_SHORTCUTS, MAX_LEVEL } from "../constants";

interface Props {
  value: number;
  onChange: (level: number) => void;
  min?: number;
  max?: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function LevelSelector({ value, onChange, min = 1, max = MAX_LEVEL }: Props) {
  // Draft local para permitir escribir libremente (incluido borrar el campo).
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const set = (n: number) => onChange(clamp(Math.round(n), min, max));

  function handleInput(raw: string) {
    setDraft(raw);
    if (raw.trim() === "") return; // dejá el campo vacío mientras se edita
    const n = Number(raw);
    if (Number.isFinite(n)) set(n);
  }

  return (
    <div className="level-selector">
      <div className="level-stepper">
        <span className="level-stepper__label">Nivel</span>
        <button
          type="button"
          className="level-stepper__btn"
          onClick={() => set(value - 1)}
          disabled={value <= min}
          aria-label="Bajar un nivel"
        >
          ‹
        </button>
        <input
          type="number"
          className="level-stepper__input"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => handleInput(e.target.value)}
          onBlur={() => setDraft(String(value))}
          aria-label="Nivel"
        />
        <button
          type="button"
          className="level-stepper__btn"
          onClick={() => set(value + 1)}
          disabled={value >= max}
          aria-label="Subir un nivel"
        >
          ›
        </button>
      </div>

      <div className="level-shortcuts">
        {LEVEL_SHORTCUTS.map((lvl) => (
          <button
            type="button"
            key={lvl}
            className={"level-chip" + (value === lvl ? " level-chip--active" : "")}
            onClick={() => set(lvl)}
          >
            {lvl}
          </button>
        ))}
      </div>
    </div>
  );
}
