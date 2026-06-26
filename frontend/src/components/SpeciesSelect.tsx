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
  const ref = useRef<HTMLDivElement>(null);

  const selected = species.find((s) => s.name === value);
  const filtered = species.filter((s) =>
    s.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

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
          />
          <ul className="species-options" role="listbox">
            {filtered.length === 0 && (
              <li className="species-empty muted">Sin resultados</li>
            )}
            {filtered.map((s) => (
              <li key={s.name}>
                <button
                  type="button"
                  role="option"
                  aria-selected={s.name === value}
                  className={
                    "species-option" + (s.name === value ? " species-option--active" : "")
                  }
                  onClick={() => pick(s.name)}
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
