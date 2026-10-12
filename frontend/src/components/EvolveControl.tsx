import { useEffect, useRef, useState } from "react";

import { useI18n } from "../i18n";
import { spriteUrl } from "../sprites";
import type { Species } from "../types";

interface Props {
  species: Species;
  catalog: Species[];
  onEvolve: (target: string) => void;
  onBack: () => void;
}

// Back / forward through the evolution line; a branching line opens a sprite grid.
export function EvolveControl({ species, catalog, onEvolve, onBack }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const previous = species.previous_stage;
  const targets = species.evolutions;

  // A new species brings its own options: never leave the previous grid open.
  useEffect(() => setOpen(false), [species.name]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sprite = (name: string) => {
    const dex = catalog.find((s) => s.name === name)?.dex;
    return dex ? <img key={name} className="sprite" src={spriteUrl(dex)} alt="" /> : null;
  };
  const placeholder = <span className="evolve__placeholder" />;

  return (
    <div className="evolve" ref={ref}>
      <button
        type="button"
        className="evolve__btn"
        disabled={!previous}
        onClick={onBack}
        aria-label={previous ? t("form.devolveTo", { species: previous }) : t("form.devolve")}
      >
        <span className="evolve__chev" aria-hidden="true">
          ‹
        </span>
        <span className="evolve__body">{previous ? sprite(previous) : placeholder}</span>
      </button>
      <button
        type="button"
        className={"evolve__btn" + (open ? " evolve__btn--open" : "")}
        disabled={targets.length === 0}
        onClick={() => (targets.length === 1 ? onEvolve(targets[0]) : setOpen((o) => !o))}
        aria-haspopup={targets.length > 1 ? "menu" : undefined}
        aria-expanded={targets.length > 1 ? open : undefined}
        aria-label={
          targets.length === 1 ? t("form.evolveTo", { species: targets[0] }) : t("form.evolve")
        }
      >
        <span className="evolve__body">
          {targets.length ? targets.slice(0, 2).map(sprite) : placeholder}
        </span>
        <span className="evolve__chev" aria-hidden="true">
          ›
        </span>
        {targets.length > 2 && <span className="evolve__more">+{targets.length - 2}</span>}
      </button>
      {open && (
        <div className="evolve__grid" role="menu">
          {targets.map((name) => (
            <button
              key={name}
              type="button"
              role="menuitem"
              className="evolve__option"
              onClick={() => {
                setOpen(false);
                onEvolve(name);
              }}
            >
              {sprite(name)}
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
