import { useEffect, useRef, useState } from "react";

import { NATURE_GROUP_ORDER, statIcon, statLabel } from "../natures";
import type { Nature } from "../types";

interface Props {
  natures: Nature[];
  value: string;
  onChange: (name: string) => void;
  // Permite la opción "Sin naturaleza" (valor ""), p. ej. en el comparador.
  allowNone?: boolean;
}

// Círculo con X para las naturalezas neutras (mismo criterio que RaenonX).
function XCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
    </svg>
  );
}

// Badges ↑/↓: chevron de color (rojo sube, azul baja) + ícono del stat. Para las
// neutras se muestra el círculo con X en ambos lados.
function NatureEffect({ nature }: { nature: Nature }) {
  if (nature.neutral) {
    return (
      <span className="nature-effect">
        <span className="nat-stat nat-stat--up" title="Sin efecto">
          <XCircle />
        </span>
        <span className="nat-stat nat-stat--down" title="Sin efecto">
          <XCircle />
        </span>
      </span>
    );
  }
  return (
    <span className="nature-effect">
      <span className="nat-stat nat-stat--up" title={`Sube: ${statLabel(nature.increased)}`}>
        <img src={statIcon(nature.increased!)} alt="" />
      </span>
      <span className="nat-stat nat-stat--down" title={`Baja: ${statLabel(nature.decreased)}`}>
        <img src={statIcon(nature.decreased!)} alt="" />
      </span>
    </span>
  );
}

export function NatureSelect({ natures, value, onChange, allowNone }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // Cerrar al tabular fuera del componente, así el dropdown no queda suspendido
    // con navegación por teclado.
    const onFocusOut = (e: FocusEvent) => {
      if (ref.current && !ref.current.contains(e.relatedTarget as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    const node = ref.current;
    node?.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      node?.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);

  const selected = natures.find((n) => n.name === value);

  // Neutras primero (sin título), luego un grupo por stat que la naturaleza sube,
  // en el orden de RaenonX. filter() preserva el orden canónico del catálogo.
  const groups = [
    { title: "", items: natures.filter((n) => n.neutral) },
    ...NATURE_GROUP_ORDER.map((stat) => ({
      title: stat,
      items: natures.filter((n) => !n.neutral && n.increased === stat),
    })),
  ];

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <div className="nature-select" ref={ref}>
      <button
        type="button"
        className="nature-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="nature-trigger__name">
          {selected?.name ?? (allowNone ? "Sin naturaleza" : "Elegir naturaleza")}
        </span>
        {selected && <NatureEffect nature={selected} />}
      </button>

      {open && (
        <div className="nature-dropdown" role="listbox" aria-label="Elegir naturaleza">
          {allowNone && (
            <div className="nature-group">
              <div className="nature-group__items">
                <button
                  type="button"
                  className={"nature-option" + (value === "" ? " nature-option--selected" : "")}
                  onClick={() => pick("")}
                  aria-pressed={value === ""}
                >
                  <span className="nature-option__name">Sin naturaleza</span>
                </button>
              </div>
            </div>
          )}
          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.title || "neutral"} className="nature-group">
                {g.title && (
                  <div className="nature-group__title">
                    <img className="nature-group__icon" src={statIcon(g.title)} alt="" />
                    {statLabel(g.title)}
                  </div>
                )}
                <div className="nature-group__items">
                  {g.items.map((n) => (
                    <button
                      type="button"
                      key={n.name}
                      className={
                        "nature-option" + (n.name === value ? " nature-option--selected" : "")
                      }
                      onClick={() => pick(n.name)}
                      aria-pressed={n.name === value}
                    >
                      <span className="nature-option__name">{n.name}</span>
                      <NatureEffect nature={n} />
                    </button>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
