import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { berryIcon } from "../berries";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { mainSkillIcon } from "../skillIcons";
import type { Catalog } from "../types";
import { IconChevronDown } from "./icons";

export type SortKey = "dex" | "level" | "berries" | "ingredients";
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

// Ícono de una main skill (sprite del juego o ícono de línea), del descriptor que
// devuelve mainSkillIcon. undefined = sin filtro (destello genérico).
function SkillIconView({ skill }: { skill: string | undefined }) {
  const icon = mainSkillIcon(skill || undefined);
  return icon.kind === "img" ? (
    <img className="mini-icon" src={icon.src} alt="" />
  ) : (
    <icon.Component />
  );
}

// Barra de orden y filtros del overview de la Caja. Presentacional: el estado vive
// en la página. Todos los desplegables (orden, tipo/baya, ingrediente, skill) usan
// el mismo FilterPopover para que el panel y el scrollbar matcheen: orden y skill
// son listas de texto, tipo/baya e ingrediente grillas de íconos. Orden lleva un
// toggle de dirección conectado a la derecha. Filtros AND, vacíos por defecto;
// especialidad como toggles. Chips de los filtros activos con × y "Limpiar".
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
  // Qué panel está abierto (solo uno a la vez). Todos los desplegables de la barra
  // comparten este estado para que abrir uno cierre los demás.
  const [openPanel, setOpenPanel] = useState<
    "sort" | "type" | "ingredient" | "skill" | null
  >(null);

  // Opciones del control de orden, con su etiqueta i18n.
  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "dex", label: t("box.sortDex") },
    { key: "level", label: t("box.sortLevel") },
    { key: "berries", label: t("box.sortBerries") },
    { key: "ingredients", label: t("box.sortIngredient") },
  ];
  const sortLabel = sortOptions.find((o) => o.key === sortKey)?.label ?? "";

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
      <div className="box-toolbar__order">
        <span className="muted">{t("box.sortBy")}</span>
        {/* Dropdown custom de orden + dirección conectados como un único control
            segmentado. Mismo shell/scrollbar que los filtros de tipo/ingrediente. */}
        <span className="sort-control">
          <FilterPopover
            open={openPanel === "sort"}
            onOpenChange={(o) => setOpenPanel(o ? "sort" : null)}
            triggerLabel={t("box.sortBy")}
            triggerClassName="sort-control__trigger"
            triggerContent={<span className="filter-btn__value">{sortLabel}</span>}
          >
            <div className="filter-list" role="listbox" aria-label={t("box.sortBy")} onKeyDown={gridKeyDown}>
              {sortOptions.map((o) => {
                const selected = sortKey === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={"filter-list__item" + (selected ? " is-selected" : "")}
                    onClick={() => {
                      onSortKey(o.key);
                      setOpenPanel(null);
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </FilterPopover>
          <button
            type="button"
            className="sort-control__dir"
            onClick={onToggleDir}
            aria-label={t(sortDir === "asc" ? "box.sortAsc" : "box.sortDesc")}
            title={t(sortDir === "asc" ? "box.sortAsc" : "box.sortDesc")}
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
        </span>
      </div>

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

        {/* Skill: dropdown custom (mismo shell/scrollbar que tipo/ingrediente) con
            lista vertical de [ícono + nombre]. El trigger muestra el ícono de la
            skill activa; re-elegir el valor activo lo limpia (toggle). */}
        <FilterPopover
          open={openPanel === "skill"}
          onOpenChange={(o) => setOpenPanel(o ? "skill" : null)}
          triggerLabel={t("box.filterSkillOpen")}
          triggerContent={
            filters.skill ? (
              <span className="filter-btn__value">
                <SkillIconView skill={filters.skill} />
                <span>{mainSkill(filters.skill)}</span>
              </span>
            ) : (
              <span className="filter-btn__value">
                <SkillIconView skill={undefined} />
                <span className="filter-btn__placeholder">{t("box.filterSkillPlaceholder")}</span>
              </span>
            )
          }
        >
          <div className="filter-list" role="listbox" aria-label={t("box.filterSkill")} onKeyDown={gridKeyDown}>
            {options.skills.map((sk) => {
              const selected = filters.skill === sk;
              return (
                <button
                  key={sk}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={"filter-list__item" + (selected ? " is-selected" : "")}
                  title={mainSkill(sk)}
                  onClick={() => pick("skill", sk)}
                >
                  <SkillIconView skill={sk} />
                  <span className="filter-list__label">{mainSkill(sk)}</span>
                </button>
              );
            })}
          </div>
        </FilterPopover>

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
        <div className="box-toolbar__active" role="group" aria-label="Filtros activos">
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
