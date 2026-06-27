import { useEffect, useId, useState } from "react";

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
  const inputId = useId();
  // Draft local para permitir escribir libremente (incluido borrar el campo).
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const set = (n: number) => onChange(clamp(Math.round(n), min, max));

  // Repone el draft al value vigente. Se usa al perder foco y al confirmar con
  // Enter, para que el input nunca quede mostrando vacío mientras se envía el
  // último value válido (desync visual).
  const reconcile = () => setDraft(String(value));

  function handleInput(raw: string) {
    setDraft(raw);
    if (raw.trim() === "") return; // dejá el campo vacío mientras se edita
    const n = Number(raw);
    if (Number.isFinite(n)) set(n);
  }

  // Enter dentro del input de nivel no debe enviar el form mostrando vacío: si el
  // draft está vacío, lo reponemos al value vigente antes de que burbujee el submit.
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && draft.trim() === "") reconcile();
  }

  return (
    <div className="level-selector">
      <div className="level-stepper">
        <label className="level-stepper__label" htmlFor={inputId}>
          Nivel
        </label>
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
          id={inputId}
          type="number"
          className="level-stepper__input"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={reconcile}
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
