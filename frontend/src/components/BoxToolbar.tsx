import { useI18n } from "../i18n";

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
}

// Barra de orden y filtros del overview de la Caja. Presentacional: el estado vive
// en la página. Orden con un único select + toggle de dirección; filtros AND,
// vacíos por defecto; chips de los filtros activos con × y "Limpiar".
export function BoxToolbar({
  sortKey,
  sortDir,
  onSortKey,
  onToggleDir,
  filters,
  onFilter,
  onClear,
  options,
}: Props) {
  const { t, ingredient, mainSkill, specialty, type } = useI18n();

  // Etiqueta legible de cada filtro y traductor de sus valores, para los chips y
  // las opciones de cada select.
  const dims: {
    key: keyof BoxFilters;
    label: string;
    values: string[];
    tr: (v: string) => string;
  }[] = [
    { key: "type", label: t("box.filterType"), values: options.types, tr: type },
    {
      key: "ingredient",
      label: t("box.filterIngredient"),
      values: options.ingredients,
      tr: ingredient,
    },
    { key: "skill", label: t("box.filterSkill"), values: options.skills, tr: mainSkill },
    {
      key: "specialty",
      label: t("box.filterSpecialty"),
      values: options.specialties,
      tr: specialty,
    },
  ];

  const active = dims.filter((d) => filters[d.key] !== "");

  return (
    <div className="box-toolbar">
      <label className="box-toolbar__order">
        <span className="muted">{t("box.sortBy")}</span>
        <select
          value={sortKey}
          onChange={(e) => onSortKey(e.target.value as SortKey)}
          aria-label={t("box.sortBy")}
        >
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
        {dims.map((d) => (
          <select
            key={d.key}
            value={filters[d.key]}
            onChange={(e) => onFilter(d.key, e.target.value)}
            aria-label={d.label}
          >
            <option value="">{d.label}</option>
            {d.values.map((v) => (
              <option key={v} value={v}>
                {d.tr(v)}
              </option>
            ))}
          </select>
        ))}
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
