import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { IconChevronDown } from "./icons";

// Panel desplegable accesible para los filtros con grilla de íconos (tipo/baya e
// ingrediente). Maneja apertura/cierre por click-afuera + Escape, foco al abrir
// (primer ítem o el activo) y devuelve el foco al trigger al cerrar. La navegación
// por flechas dentro de la grilla la maneja el contenedor del consumidor (roving
// con onKeyDown sobre [role="option"]).
export function FilterPopover({
  open,
  onOpenChange,
  triggerLabel,
  triggerContent,
  triggerClassName,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel: string;
  triggerContent: ReactNode;
  // Clase extra para el trigger (p. ej. cuando es parte de un control segmentado).
  triggerClassName?: string;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Foco al primer ítem activo del panel, o al primero disponible.
    const pop = wrapRef.current?.querySelector<HTMLElement>(".filter-pop");
    const active = pop?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
    (active ?? pop?.querySelector<HTMLElement>('[role="option"]'))?.focus();

    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div className="filter-control" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={
          "filter-btn" +
          (open ? " filter-btn--open" : "") +
          (triggerClassName ? " " + triggerClassName : "")
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => onOpenChange(!open)}
      >
        {triggerContent}
        <IconChevronDown className="filter-btn__chevron" />
      </button>
      {open && <div className="filter-pop">{children}</div>}
    </div>
  );
}

// Navegación por teclado dentro de un contenedor de [role="option"]: flechas
// mueven el foco al option anterior/siguiente (roving simple, recorriendo el orden
// del DOM). Sirve tanto para la grilla de íconos como para las listas verticales.
// Salta cualquier elemento que no sea [role="option"] (p. ej. encabezados de grupo).
export function gridKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const grid = e.currentTarget;
  const items = Array.from(grid.querySelectorAll<HTMLElement>('[role="option"]'));
  const current = document.activeElement as HTMLElement;
  const idx = items.indexOf(current);
  if (idx < 0) return;
  e.preventDefault();
  let next = idx;
  if (e.key === "ArrowRight" || e.key === "ArrowDown") next = Math.min(idx + 1, items.length - 1);
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = Math.max(idx - 1, 0);
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = items.length - 1;
  items[next]?.focus();
}
