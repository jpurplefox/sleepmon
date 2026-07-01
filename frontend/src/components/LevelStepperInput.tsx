import { useEffect, useRef, useState } from "react";

interface AriaLabels {
  down: string;
  input: string;
  up: string;
}

interface Props {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  ariaLabels?: AriaLabels;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Stepper reutilizable con draft local: permite escribir libremente (incluyendo
 * dejar el campo vacío mientras se edita) y hace el clamp/round al perder foco
 * o al presionar Enter. Los botones −/+ siguen funcionando directamente.
 *
 * Renderiza `.level-stepper__btn` y `.level-stepper__input` para que herede
 * el CSS existente; el contenedor (`.level-stepper`) lo pone el padre.
 */
export function LevelStepperInput({
  value,
  onChange,
  min = 1,
  max = 100,
  ariaLabels,
}: Props) {
  // Draft string para permitir escritura libre sin reparsar en cada tecla.
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  // Sincroniza el draft desde value solo cuando el campo no está enfocado
  // (es decir, el cambio viene de fuera: botón +/−, shortcut, etc.).
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const commit = (n: number) => onChange(clamp(Math.round(n), min, max));

  const reconcile = () => setDraft(String(value));

  const handleBlur = () => {
    focused.current = false;
    const n = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(n)) {
      commit(n);
    }
    // Repone siempre el draft al value confirmado (puede haber clampado).
    // Usamos setTimeout para que el commit de arriba ya haya propagado.
    setTimeout(() => setDraft(String(value)), 0);
  };

  const handleChange = (raw: string) => {
    setDraft(raw);
    // No parseamos si está vacío — dejamos el campo en blanco mientras edita.
    if (raw.trim() === "") return;
    const n = Number(raw);
    if (Number.isFinite(n)) commit(n);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (draft.trim() === "") {
        reconcile();
      } else {
        const n = Number(draft);
        if (Number.isFinite(n)) commit(n);
      }
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

  return (
    <>
      <button
        type="button"
        className="level-stepper__btn"
        disabled={value <= min}
        aria-label={ariaLabels?.down}
        onClick={() => commit(value - 1)}
      >
        −
      </button>
      <input
        type="number"
        className="level-stepper__input"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        aria-label={ariaLabels?.input}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <button
        type="button"
        className="level-stepper__btn"
        disabled={value >= max}
        aria-label={ariaLabels?.up}
        onClick={() => commit(value + 1)}
      >
        +
      </button>
    </>
  );
}
