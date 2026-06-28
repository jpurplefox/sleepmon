import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { berryIcon } from "../berries";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { mainSkillIcon } from "../skillIcons";
import type { Catalog } from "../types";
import { IconChevronDown } from "./icons";

export type SortKey = "dex" | "level" | "berries" | "ingredient";
export type SortDir = "asc" | "desc";

export interface BoxFilters {
  type: string;
  ingredient: string;
  skill: string;
  specialty: string;
}

export const EMPTY_FILTERS: BoxFilters = { type: "", ingredient: "", skill: "", specialty: "" };

interface Options {
  types: string[];
  ingredients: string[];
  skills: string[];
  specialties: string[];
}

interface Props {
  sortKey: SortKey;
  sortDir: SortDir;
  onSortKey: (k: SortKey) => void;
  onToggleDir: () => void;
  filters: BoxFilters;
  onFilter: (key: keyof BoxFilters, value: string) => void;
  onClear: () => void;
  options: Options;
  // El catálogo da la baya de cada tipo (1:1) y el ícono de cada ingrediente.
  catalog: Catalog;
}

// Panel desplegable accesible para los filtros con grilla de íconos (tipo/baya e
// ingrediente). Maneja apertura/cierre por click-afuera + Escape, foco al abrir
// (primer ítem o el activo) y devuelve el foco al trigger al cerrar. La navegación
// por flechas dentro de la grilla la maneja el contenedor del consumidor (roving
// con onKeyDown sobre [role="option"]).
function FilterPopover({
  open,
  onOpenChange,
  triggerLabel,
  triggerContent,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel: string;
  triggerContent: ReactNode;
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
        className={"filter-btn" + (open ? " filter-btn--open" : "")}
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

// Navegación por teclado dentro de una grilla de [role="option"]: flechas mueven
// el foco al hermano option anterior/siguiente (roving simple, sin tracking de
// columnas: la grilla envuelve y las flechas recorren el orden del DOM).
function gridKeyDown(e: React.KeyboardEvent<HTMLElement>) {
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

// Barra de orden y filtros del overview de la Caja. Presentacional: el estado vive
// en la página. Orden con un único select + toggle de dirección. Filtros AND,
// vacíos por defecto, con íconos: tipo/baya e ingrediente en paneles de grilla de
// íconos, skill en dropdown con su ícono, especialidad como toggles. Chips de los
// filtros activos con × y "Limpiar".
export function BoxToolbar({
  sortKey,
  sortDir,
  onSortKey,
  onToggleDir,
  filters,
  onFilter,
  onClear,
  options,
  catalog,
}: Props) {
  const { t, ingredient, mainSkill, specialty, type } = useI18n();
  // Qué panel está abierto (solo uno a la vez): "type" | "ingredient" | null.
  const [openPanel, setOpenPanel] = useState<"type" | "ingredient" | null>(null);

  // {tipo, baya} por tipo presente en la caja, derivado del catálogo (1:1). Se
  // toma la primera especie de cada tipo para su baya.
  const typeBerry = new Map<string, string>();
  for (const s of catalog.species) {
    if (!typeBerry.has(s.type)) typeBerry.set(s.type, s.berry);
  }
  const typeList = options.types.map((tp) => ({ type: tp, berry: typeBerry.get(tp) ?? "" }));

  // Etiqueta legible de cada filtro y traductor de sus valores, para los chips.
  const dims: {
    key: keyof BoxFilters;
    label: string;
    tr: (v: string) => string;
    icon?: (v: string) => string;
  }[] = [
    { key: "type", label: t("box.filterType"), tr: type, icon: (v) => berryIcon(typeBerry.get(v) ?? "") },
    { key: "ingredient", label: t("box.filterIngredient"), tr: ingredient, icon: ingredientIcon },
    { key: "skill", label: t("box.filterSkill"), tr: mainSkill },
    { key: "specialty", label: t("box.filterSpecialty"), tr: specialty },
  ];

  const active = dims.filter((d) => filters[d.key] !== "");

  const pick = (key: keyof BoxFilters, value: string) => {
    // Toggle: re-elegir el valor activo lo limpia.
    onFilter(key, filters[key] === value ? "" : value);
    setOpenPanel(null);
  };

  return (
    <div className="box-toolbar">
      <label className="box-toolbar__order">
        <span className="muted">{t("box.sortBy")}</span>
        <select value={sortKey} onChange={(e) => onSortKey(e.target.value as SortKey)}>
          <option value="dex">{t("box.sortDex")}</option>
          <option value="level">{t("box.sortLevel")}</option>
          <option value="berries">{t("box.sortBerries")}</option>
          <option value="ingredient">{t("box.sortIngredient")}</option>
        </select>
        <button
          type="button"
          className="btn btn--ghost box-toolbar__dir"
          onClick={onToggleDir}
          aria-label={t(sortDir === "asc" ? "box.sortAsc" : "box.sortDesc")}
          title={t(sortDir === "asc" ? "box.sortAsc" : "box.sortDesc")}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>
      </label>

      <div className="box-toolbar__filters">
        {/* Tipo / Baya: un solo control (1:1). Trigger con ícono de baya del tipo
            activo; panel con grilla de íconos de baya. */}
        <FilterPopover
          open={openPanel === "type"}
          onOpenChange={(o) => setOpenPanel(o ? "type" : null)}
          triggerLabel={t("box.filterTypeOpen")}
          triggerContent={
            filters.type ? (
              <span className="filter-btn__value">
                <img className="mini-icon" src={berryIcon(typeBerry.get(filters.type) ?? "")} alt="" />
                <span>{type(filters.type)}</span>
              </span>
            ) : (
              <span className="filter-btn__placeholder">{t("box.filterTypePlaceholder")}</span>
            )
          }
        >
          <div className="filter-grid" role="listbox" aria-label={t("box.filterType")} onKeyDown={gridKeyDown}>
            {typeList.map(({ type: tp, berry }) => {
              const selected = filters.type === tp;
              return (
                <button
                  key={tp}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={"filter-grid__item" + (selected ? " is-selected" : "")}
                  title={type(tp)}
                  onClick={() => pick("type", tp)}
                >
                  <img className="mini-icon" src={berryIcon(berry)} alt="" />
                  <span className="filter-grid__label">{type(tp)}</span>
                </button>
              );
            })}
          </div>
        </FilterPopover>

        {/* Ingrediente: trigger con ícono; panel con grilla de íconos de ingrediente. */}
        <FilterPopover
          open={openPanel === "ingredient"}
          onOpenChange={(o) => setOpenPanel(o ? "ingredient" : null)}
          triggerLabel={t("box.filterIngredientOpen")}
          triggerContent={
            filters.ingredient ? (
              <span className="filter-btn__value">
                <img className="mini-icon" src={ingredientIcon(filters.ingredient)} alt="" />
                <span>{ingredient(filters.ingredient)}</span>
              </span>
            ) : (
              <span className="filter-btn__placeholder">{t("box.filterIngredientPlaceholder")}</span>
            )
          }
        >
          <div
            className="filter-grid"
            role="listbox"
            aria-label={t("box.filterIngredient")}
            onKeyDown={gridKeyDown}
          >
            {options.ingredients.map((ing) => {
              const selected = filters.ingredient === ing;
              return (
                <button
                  key={ing}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={"filter-grid__item" + (selected ? " is-selected" : "")}
                  title={ingredient(ing)}
                  onClick={() => pick("ingredient", ing)}
                >
                  <img className="mini-icon" src={ingredientIcon(ing)} alt="" />
                  <span className="filter-grid__label">{ingredient(ing)}</span>
                </button>
              );
            })}
          </div>
        </FilterPopover>

        {/* Skill: dropdown con ícono + nombre por opción. El <select> nativo no
            renderiza el ícono en sus options; el ícono va junto al control. */}
        <div className="filter-select">
          <span className="filter-select__icon" aria-hidden="true">
            {(() => {
              const icon = mainSkillIcon(filters.skill || undefined);
              return icon.kind === "img" ? (
                <img className="mini-icon" src={icon.src} alt="" />
              ) : (
                <icon.Component />
              );
            })()}
          </span>
          <select
            value={filters.skill}
            onChange={(e) => onFilter("skill", e.target.value)}
            aria-label={t("box.filterSkillOpen")}
          >
            <option value="">{t("box.filterSkillPlaceholder")}</option>
            {options.skills.map((sk) => (
              <option key={sk} value={sk}>
                {mainSkill(sk)}
              </option>
            ))}
          </select>
        </div>

        {/* Especialidad: toggle-buttons (Bayas / Ingredientes / Skills). */}
        <div className="specialty-toggle" role="group" aria-label={t("box.filterSpecialty")}>
          {options.specialties.map((sp) => {
            const pressed = filters.specialty === sp;
            return (
              <button
                key={sp}
                type="button"
                className={"specialty-toggle__btn" + (pressed ? " is-on" : "")}
                aria-pressed={pressed}
                onClick={() => onFilter("specialty", pressed ? "" : sp)}
              >
                {specialty(sp)}
              </button>
            );
          })}
        </div>
      </div>

      {active.length > 0 && (
        <div className="box-toolbar__active">
          {active.map((d) => (
            <button
              key={d.key}
              type="button"
              className="box-filter-chip"
              onClick={() => onFilter(d.key, "")}
              aria-label={t("box.removeFilter", { filter: `${d.label}: ${d.tr(filters[d.key])}` })}
            >
              {d.icon && (
                <img className="box-filter-chip__icon" src={d.icon(filters[d.key])} alt="" />
              )}
              {d.label}: {d.tr(filters[d.key])} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="btn btn--ghost box-toolbar__clear" onClick={onClear}>
            {t("box.clearFilters")}
          </button>
        </div>
      )}
    </div>
  );
}
