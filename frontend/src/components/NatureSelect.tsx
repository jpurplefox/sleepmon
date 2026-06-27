import { useEffect, useRef, useState } from "react";

import { NATURE_GROUP_ORDER, statIcon, statLabel } from "../natures";
import type { Nature } from "../types";

interface Props {
  natures: Nature[];
  value: string;
  onChange: (name: string) => void;
  // Permite la opción "Sin naturaleza" (valor ""), p. ej. en el comparador.
  allowNone?: boolean;
  // Nombre accesible para el botón disparador (el <label> que lo envuelve no
  // nombra un control nativo).
  ariaLabel?: string;
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

export function NatureSelect({ natures, value, onChange, allowNone, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  // Opción resaltada para la navegación con flechas dentro del dropdown.
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  // Lista plana de valores de opción en el mismo orden visual, para mapear el
  // índice activo de la navegación con flechas a una opción concreta. Incluye la
  // opción "Sin naturaleza" (valor "") al frente cuando allowNone.
  const optionValues = [
    ...(allowNone ? [""] : []),
    ...groups.flatMap((g) => g.items.map((n) => n.name)),
  ];

  // Al abrir, resaltar la opción seleccionada (o la primera) y mover el foco al
  // listbox para que la navegación con flechas funcione de inmediato.
  useEffect(() => {
    if (!open) return;
    const i = optionValues.indexOf(value);
    setActiveIndex(i === -1 ? 0 : i);
    listRef.current?.focus();
    // optionValues se recalcula en cada render; basta con value/open como deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const optionId = (name: string) => `nature-opt-${name === "" ? "none" : name}`;

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  // Flechas mueven el resaltado; Enter selecciona la opción activa.
  const onListKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (optionValues.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % optionValues.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + optionValues.length) % optionValues.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const name = optionValues[activeIndex];
      if (name !== undefined) pick(name);
    }
  };

  return (
    <div className="nature-select" ref={ref}>
      <button
        type="button"
        className="nature-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="nature-trigger__name">
          {selected?.name ?? (allowNone ? "Sin naturaleza" : "Elegir naturaleza")}
        </span>
        {selected && <NatureEffect nature={selected} />}
      </button>

      {open && (
        <div
          ref={listRef}
          className="nature-dropdown"
          role="listbox"
          aria-label="Elegir naturaleza"
          tabIndex={0}
          aria-activedescendant={
            optionValues[activeIndex] !== undefined
              ? optionId(optionValues[activeIndex])
              : undefined
          }
          onKeyDown={onListKey}
        >
          {allowNone && (
            <div className="nature-group">
              <div className="nature-group__items">
                <button
                  type="button"
                  id={optionId("")}
                  role="option"
                  aria-selected={value === ""}
                  className={
                    "nature-option" +
                    (value === "" ? " nature-option--selected" : "") +
                    (optionValues[activeIndex] === "" ? " nature-option--highlight" : "")
                  }
                  onClick={() => pick("")}
                  onMouseEnter={() => setActiveIndex(0)}
                  tabIndex={-1}
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
                      id={optionId(n.name)}
                      role="option"
                      aria-selected={n.name === value}
                      className={
                        "nature-option" +
                        (n.name === value ? " nature-option--selected" : "") +
                        (optionValues[activeIndex] === n.name ? " nature-option--highlight" : "")
                      }
                      onClick={() => pick(n.name)}
                      onMouseEnter={() => setActiveIndex(optionValues.indexOf(n.name))}
                      tabIndex={-1}
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
