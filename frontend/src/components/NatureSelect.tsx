import { useEffect, useRef, useState } from "react";

import { NATURE_GROUP_ORDER, statGlyph, statLabel } from "../natures";
import type { Nature } from "../types";

interface Props {
  natures: Nature[];
  value: string;
  onChange: (name: string) => void;
}

// Badges ↑/↓ con el símbolo del stat. Para las neutras se muestra el glifo "⊗".
function NatureEffect({ nature }: { nature: Nature }) {
  if (nature.neutral) {
    return (
      <span className="nature-effect">
        <span className="nat-stat nat-stat--up" title="Sin efecto">
          {statGlyph(null)}
        </span>
        <span className="nat-stat nat-stat--down" title="Sin efecto">
          {statGlyph(null)}
        </span>
      </span>
    );
  }
  return (
    <span className="nature-effect">
      <span className="nat-stat nat-stat--up" title={`Sube: ${statLabel(nature.increased)}`}>
        {statGlyph(nature.increased)}
      </span>
      <span className="nat-stat nat-stat--down" title={`Baja: ${statLabel(nature.decreased)}`}>
        {statGlyph(nature.decreased)}
      </span>
    </span>
  );
}

export function NatureSelect({ natures, value, onChange }: Props) {
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
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
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
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="nature-trigger__name">{selected?.name ?? "Elegir naturaleza"}</span>
        {selected && <NatureEffect nature={selected} />}
      </button>

      {open && (
        <div className="nature-dropdown" role="dialog" aria-label="Elegir naturaleza">
          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.title || "neutral"} className="nature-group">
                {g.title && (
                  <div className="nature-group__title">
                    <span className="nat-stat nat-stat--up">{statGlyph(g.title)}</span>
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
