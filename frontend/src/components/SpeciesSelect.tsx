import { useEffect, useRef, useState } from "react";

import { spriteUrl } from "../sprites";
import type { Species } from "../types";

interface Props {
  species: Species[];
  value: string;
  onChange: (name: string) => void;
}

export function SpeciesSelect({ species, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Opción resaltada para la navegación con flechas dentro del dropdown.
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const selected = species.find((s) => s.name === value);
  const filtered = species.filter((s) =>
    s.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  // Al abrir o filtrar, resaltar la primera opción.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

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

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery("");
  };

  // Flechas mueven el resaltado; Enter selecciona la opción activa.
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) pick(opt.name);
    }
  };

  return (
    <div className="species-select" ref={ref}>
      <button
        type="button"
        className="species-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <img className="sprite" src={spriteUrl(selected.dex)} alt="" loading="lazy" />
            <span className="species-trigger__name">{selected.name}</span>
            <span className="species-trigger__meta">{selected.specialty}</span>
          </>
        ) : (
          <span className="muted">Elegí una especie…</span>
        )}
        <span className="species-trigger__chevron">▾</span>
      </button>

      {open && (
        <div className="species-dropdown">
          <input
            className="species-search"
            autoFocus
            aria-label="Buscar especie"
            placeholder="Buscar especie…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            role="combobox"
            aria-expanded
            aria-controls="species-options"
            aria-activedescendant={
              filtered[activeIndex] ? `species-opt-${filtered[activeIndex].dex}` : undefined
            }
          />
          <ul className="species-options" role="listbox" id="species-options">
            {filtered.length === 0 && (
              <li className="species-empty muted">Sin resultados</li>
            )}
            {filtered.map((s, i) => (
              <li key={s.name}>
                <button
                  type="button"
                  id={`species-opt-${s.dex}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={
                    "species-option" +
                    (s.name === value ? " species-option--active" : "") +
                    (i === activeIndex ? " species-option--highlight" : "")
                  }
                  onClick={() => pick(s.name)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <img className="sprite" src={spriteUrl(s.dex)} alt="" loading="lazy" />
                  <span className="species-option__name">{s.name}</span>
                  <span className="species-option__meta">{s.specialty}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
