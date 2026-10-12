import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { useI18n } from "../i18n";
import { spriteUrl } from "../sprites";
import type { Species } from "../types";

interface Props {
  /** Undefined before a species is picked: both steps show disabled. */
  species: Species | undefined;
  catalog: Species[];
  onEvolve: (target: string) => void;
  onBack: () => void;
}

// Back / forward through the evolution line; a branching line opens a sprite grid.
export function EvolveControl({ species, catalog, onEvolve, onBack }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const fwdRef = useRef<HTMLButtonElement>(null);
  // Button that should keep focus after the next step; falls back to the other if disabled.
  const settle = useRef<"back" | "forward" | null>(null);
  const previous = species?.previous_stage;
  const targets = species?.evolutions ?? [];

  // A new species brings its own options: never leave the previous grid open.
  useEffect(() => setOpen(false), [species?.name]);

  // After a step, focus never drops to <body> when the clicked button became disabled.
  useEffect(() => {
    const want = settle.current;
    if (!want) return;
    settle.current = null;
    const [first, second] = want === "back" ? [backRef, fwdRef] : [fwdRef, backRef];
    (first.current?.disabled ? second : first).current?.focus();
  }, [species?.name]);

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        // Another control takes focus itself; elsewhere it would fall to <body>.
        const target = e.target as HTMLElement;
        if (!target.closest("a, button, input, select, textarea, [tabindex]")) {
          fwdRef.current?.focus();
        }
      }
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        fwdRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    if (els.length === 0) return;
    const idx = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      els[(idx + delta + els.length) % els.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      els[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      els[els.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const sprite = (name: string) => {
    const dex = catalog.find((s) => s.name === name)?.dex;
    return dex ? <img key={name} className="sprite" src={spriteUrl(dex)} alt="" /> : null;
  };
  const placeholder = <span className="evolve__placeholder" />;

  return (
    <div className="evolve" ref={ref}>
      <button
        type="button"
        ref={backRef}
        className="evolve__btn"
        disabled={!previous}
        onClick={() => {
          settle.current = "back";
          onBack();
        }}
        aria-label={previous ? t("form.devolveTo", { species: previous }) : t("form.devolve")}
      >
        <span className="evolve__chev" aria-hidden="true">
          ‹
        </span>
        <span className="evolve__body">{previous ? sprite(previous) : placeholder}</span>
      </button>
      <button
        type="button"
        ref={fwdRef}
        className={"evolve__btn evolve__btn--forward" + (open ? " evolve__btn--open" : "")}
        disabled={targets.length === 0}
        onClick={() => {
          if (targets.length !== 1) return setOpen((o) => !o);
          settle.current = "forward";
          onEvolve(targets[0]);
        }}
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
        <div className="evolve__grid" role="menu" onKeyDown={onMenuKeyDown}>
          {targets.map((name) => (
            <button
              key={name}
              type="button"
              role="menuitem"
              className="evolve__option"
              onClick={() => {
                setOpen(false);
                settle.current = "forward";
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
