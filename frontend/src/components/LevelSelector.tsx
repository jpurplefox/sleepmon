import { useEffect, useId, useRef, useState } from "react";

import { LEVEL_SHORTCUTS, MAX_LEVEL } from "../constants";
import { useI18n } from "../i18n";

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
  const { t } = useI18n();
  const inputId = useId();
  // Draft local para permitir escribir libremente (incluido borrar el campo).
  const [draft, setDraft] = useState(String(value));
  // Sincronizamos el draft desde value SOLO cuando el cambio viene de afuera
  // (stepper, shortcuts) y no mientras el usuario tipea: si no, un valor que
  // clampa (p.ej. "150" → 100) reescribiría el draft bajo los dedos y no se
  // podría corregir a "15".
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const set = (n: number) => onChange(clamp(Math.round(n), min, max));

  // Repone el draft al value vigente. Se usa al perder foco y al confirmar con
  // Enter, para que el input nunca quede mostrando vacío mientras se envía el
  // último value válido (desync visual).
  const reconcile = () => setDraft(String(value));

  // Al perder foco marcamos el input como no enfocado (así el efecto vuelve a
  // sincronizar con value) y reponemos el draft.
  const handleBlur = () => {
    focused.current = false;
    reconcile();
  };

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
          {t("levelSel.label")}
        </label>
        <button
          type="button"
          className="level-stepper__btn"
          onClick={() => set(value - 1)}
          disabled={value <= min}
          aria-label={t("levelSel.down")}
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
          onFocus={() => {
            focused.current = true;
          }}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
        />
        <button
          type="button"
          className="level-stepper__btn"
          onClick={() => set(value + 1)}
          disabled={value >= max}
          aria-label={t("levelSel.up")}
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
