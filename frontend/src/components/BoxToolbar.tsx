import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { berryIcon } from "../berries";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { mainSkillIcon } from "../skillIcons";
import {
  boostsTastyChance,
  chargesSelfEnergy,
  cheersRandomEnergy,
  contributesBerryRole,
  drawsIngredients,
  magnetsIngredients,
  powersUpCooking,
  restoresTeamEnergy,
} from "../skills";
import type { Catalog } from "../types";
import { IconArrowDown, IconArrowUp, IconChevronDown } from "./icons";

export type SortKey = "dex" | "level" | "berries" | "ingredients";
export type SortDir = "asc" | "desc";

export interface BoxFilters {
  // Tipo/baya e ingrediente son multi-selección (OR dentro de la dimensión).
  type: string[];
  ingredient: string[];
  // Skill y especialidad siguen siendo single-select.
  skill: string;
  specialty: string;
}

export const EMPTY_FILTERS: BoxFilters = { type: [], ingredient: [], skill: "", specialty: "" };

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
  // Single-select (skill / specialty).
  onFilter: (key: "skill" | "specialty", value: string) => void;
  // Multi-select toggle (type / ingredient).
  onToggle: (key: "type" | "ingredient", value: string) => void;
  // Quita un valor concreto de cualquier dimensión (× de cada chip).
  onRemove: (key: keyof BoxFilters, value: string) => void;
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
// Salta cualquier elemento que no sea [role="option"] (p. ej. encabezados de grupo).
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
    <img className="mini-icon" src={icon.src} alt="" aria-hidden="true" />
  ) : (
    <icon.Component />
  );
}

// Subcategorías del filtro de skill, en orden de presentación. Cada skill cae en
// la PRIMERA categoría cuyo predicado matchea; "others" recoge el resto.
type SkillCategory = "ingredients" | "energy" | "cooking" | "berry" | "others";

const SKILL_CATEGORY_ORDER: SkillCategory[] = [
  "ingredients",
  "energy",
  "cooking",
  "berry",
  "others",
];

function skillCategory(skill: string): SkillCategory {
  if (drawsIngredients(skill) || magnetsIngredients(skill)) return "ingredients";
  if (restoresTeamEnergy(skill) || chargesSelfEnergy(skill) || cheersRandomEnergy(skill))
    return "energy";
  // Cocina: Cooking Power-Up, Cooking Assist (Bulk Up) y Tasty Chance.
  if (skill.startsWith("Cooking") || powersUpCooking(skill) || boostsTastyChance(skill))
    return "cooking";
  if (contributesBerryRole(skill)) return "berry";
  return "others";
}

// Barra de orden y filtros del overview de la Caja. Presentacional: el estado vive
// en la página. Todos los desplegables (orden, tipo/baya, ingrediente, skill) usan
// el mismo FilterPopover para que el panel y el scrollbar matcheen: orden y skill
// son listas de texto, tipo/baya e ingrediente grillas de íconos. Orden lleva un
// toggle de dirección conectado a la derecha (control segmentado). Tipo/baya e
// ingrediente son multi-select (OR dentro, AND entre dimensiones); skill agrupa sus
// opciones por subcategoría. Filtros vacíos por defecto; especialidad como toggles.
// Chips: uno por cada valor activo, con × que quita solo ese valor; "Limpiar" todo.
export function BoxToolbar({
  sortKey,
  sortDir,
  onSortKey,
  onToggleDir,
  filters,
  onFilter,
  onToggle,
  onRemove,
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

  // Skills agrupadas por subcategoría, respetando el orden de SKILL_CATEGORY_ORDER y,
  // dentro de cada grupo, el orden de options.skills. Solo grupos no vacíos.
  const skillGroups = SKILL_CATEGORY_ORDER.map((cat) => ({
    cat,
    label: t(`box.skillCat.${cat}`),
    skills: options.skills.filter((sk) => skillCategory(sk) === cat),
  })).filter((g) => g.skills.length > 0);

  // Chips: un descriptor por cada valor activo de cada dimensión.
  type Chip = { key: keyof BoxFilters; value: string; label: string; icon?: string };
  const chips: Chip[] = [
    ...filters.type.map(
      (v): Chip => ({
        key: "type",
        value: v,
        label: `${t("box.filterType")}: ${type(v)}`,
        icon: berryIcon(typeBerry.get(v) ?? ""),
      }),
    ),
    ...filters.ingredient.map(
      (v): Chip => ({
        key: "ingredient",
        value: v,
        label: `${t("box.filterIngredient")}: ${ingredient(v)}`,
        icon: ingredientIcon(v),
      }),
    ),
    ...(filters.skill
      ? [{ key: "skill" as const, value: filters.skill, label: `${t("box.filterSkill")}: ${mainSkill(filters.skill)}` }]
      : []),
    ...(filters.specialty
      ? [
          {
            key: "specialty" as const,
            value: filters.specialty,
            label: `${t("box.filterSpecialty")}: ${specialty(filters.specialty)}`,
          },
        ]
      : []),
  ];

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
            {sortDir === "asc" ? <IconArrowUp /> : <IconArrowDown />}
          </button>
        </span>
      </div>

      <div className="box-toolbar__filters">
        {/* Tipo / Baya: multi-select (1:1 tipo↔baya). Trigger con conteo o íconos
            de las bayas elegidas; panel grilla de íconos, click toggea y no cierra. */}
        <FilterPopover
          open={openPanel === "type"}
          onOpenChange={(o) => setOpenPanel(o ? "type" : null)}
          triggerLabel={t("box.filterTypeOpen")}
          triggerContent={
            filters.type.length > 0 ? (
              <span className="filter-btn__value">
                <span className="filter-btn__icons">
                  {filters.type.slice(0, 3).map((tp) => (
                    <img
                      key={tp}
                      className="mini-icon"
                      src={berryIcon(typeBerry.get(tp) ?? "")}
                      alt=""
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <span>{t("box.filterType")} ({filters.type.length})</span>
              </span>
            ) : (
              <span className="filter-btn__placeholder">{t("box.filterTypePlaceholder")}</span>
            )
          }
        >
          <div className="filter-grid" role="listbox" aria-multiselectable="true" aria-label={t("box.filterType")} onKeyDown={gridKeyDown}>
            {typeList.map(({ type: tp, berry }) => {
              const selected = filters.type.includes(tp);
              return (
                <button
                  key={tp}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={"filter-grid__item" + (selected ? " is-selected" : "")}
                  title={type(tp)}
                  onClick={() => onToggle("type", tp)}
                >
                  <img className="mini-icon" src={berryIcon(berry)} alt="" aria-hidden="true" />
                  <span className="filter-grid__label">{type(tp)}</span>
                </button>
              );
            })}
          </div>
        </FilterPopover>

        {/* Ingrediente: multi-select. Trigger con conteo o íconos; panel grilla,
            click toggea y no cierra. */}
        <FilterPopover
          open={openPanel === "ingredient"}
          onOpenChange={(o) => setOpenPanel(o ? "ingredient" : null)}
          triggerLabel={t("box.filterIngredientOpen")}
          triggerContent={
            filters.ingredient.length > 0 ? (
              <span className="filter-btn__value">
                <span className="filter-btn__icons">
                  {filters.ingredient.slice(0, 3).map((ing) => (
                    <img
                      key={ing}
                      className="mini-icon"
                      src={ingredientIcon(ing)}
                      alt=""
                      aria-hidden="true"
                    />
                  ))}
                </span>
                <span>
                  {t("box.filterIngredient")} ({filters.ingredient.length})
                </span>
              </span>
            ) : (
              <span className="filter-btn__placeholder">{t("box.filterIngredientPlaceholder")}</span>
            )
          }
        >
          <div
            className="filter-grid"
            role="listbox"
            aria-multiselectable="true"
            aria-label={t("box.filterIngredient")}
            onKeyDown={gridKeyDown}
          >
            {options.ingredients.map((ing) => {
              const selected = filters.ingredient.includes(ing);
              return (
                <button
                  key={ing}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={"filter-grid__item" + (selected ? " is-selected" : "")}
                  title={ingredient(ing)}
                  onClick={() => onToggle("ingredient", ing)}
                >
                  <img className="mini-icon" src={ingredientIcon(ing)} alt="" aria-hidden="true" />
                  <span className="filter-grid__label">{ingredient(ing)}</span>
                </button>
              );
            })}
          </div>
        </FilterPopover>

        {/* Skill: dropdown custom single-select con las opciones agrupadas por
            subcategoría (encabezados no seleccionables). El trigger muestra el ícono
            de la skill activa; re-elegir el valor activo lo limpia (toggle). */}
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
            {skillGroups.map((group) => (
              <div key={group.cat} role="group" aria-label={group.label} className="filter-list__group">
                <div className="filter-list__heading" role="presentation">
                  {group.label}
                </div>
                {group.skills.map((sk) => {
                  const selected = filters.skill === sk;
                  return (
                    <button
                      key={sk}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={"filter-list__item" + (selected ? " is-selected" : "")}
                      title={mainSkill(sk)}
                      onClick={() => {
                        // Toggle: re-elegir el valor activo lo limpia.
                        onFilter("skill", selected ? "" : sk);
                        setOpenPanel(null);
                      }}
                    >
                      <SkillIconView skill={sk} />
                      <span className="filter-list__label">{mainSkill(sk)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
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

      {chips.length > 0 && (
        <div className="box-toolbar__active" role="group" aria-label={t("box.activeFilters")}>
          {chips.map((c) => (
            <button
              key={`${c.key}:${c.value}`}
              type="button"
              className="box-filter-chip"
              onClick={() => onRemove(c.key, c.value)}
              aria-label={t("box.removeFilter", { filter: c.label })}
            >
              {c.icon && (
                <img className="box-filter-chip__icon" src={c.icon} alt="" aria-hidden="true" />
              )}
              {c.label} <span aria-hidden="true">×</span>
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
