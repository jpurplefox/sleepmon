import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../api/client";
import { BoxEntry } from "../components/BoxEntry";
import {
  BoxToolbar,
  EMPTY_FILTERS,
  type BoxFilters,
  type SortDir,
  type SortKey,
} from "../components/BoxToolbar";
import { BoxCoverage } from "../components/BoxCoverage";
import { MemberForm } from "../components/MemberForm";
import { Modal } from "../components/Modal";
import { useI18n } from "../i18n";
import type { Catalog, Member, MemberInput, Species } from "../types";

// Producción del ingrediente principal: el de mayor total entre los desbloqueados,
// combinando la mecánica normal (ingredients) con lo que aporta la main skill
// (skill_ingredients), por ingrediente. Coherente con lo que muestra BoxEntry.
const mainIngredientAmount = (m: Member): number => {
  const prod = m.production;
  if (!prod) return 0;
  const totals = new Map<string, number>();
  for (const s of prod.ingredients) totals.set(s.ingredient, (totals.get(s.ingredient) ?? 0) + s.amount);
  for (const s of prod.skill_ingredients)
    totals.set(s.ingredient, (totals.get(s.ingredient) ?? 0) + s.amount);
  return Math.max(0, ...totals.values());
};

// Orden + filtros del overview, en el cliente (la producción ya viene en /team).
function sortAndFilter(
  members: Member[],
  speciesByName: Map<string, Species>,
  sortKey: SortKey,
  sortDir: SortDir,
  filters: BoxFilters,
): Member[] {
  const matches = (m: Member): boolean => {
    const sp = speciesByName.get(m.species);
    if (filters.type && sp?.type !== filters.type) return false;
    if (filters.ingredient && !m.ingredients.includes(filters.ingredient)) return false;
    if (filters.skill && sp?.main_skill !== filters.skill) return false;
    if (filters.specialty && sp?.specialty !== filters.specialty) return false;
    return true;
  };
  const value = (m: Member): number => {
    switch (sortKey) {
      case "level":
        return m.level;
      case "berries":
        return m.production?.berries ?? 0;
      case "ingredient":
        return mainIngredientAmount(m);
      default:
        return speciesByName.get(m.species)?.dex ?? 0;
    }
  };
  const dir = sortDir === "asc" ? 1 : -1;
  return members
    .filter(matches)
    .sort((a, b) => (value(a) - value(b)) * dir || a.species.localeCompare(b.species));
}

// Opciones de cada filtro, derivadas del catálogo (únicas).
function filterOptions(catalog: Catalog) {
  const uniq = (xs: string[]) => [...new Set(xs)];
  return {
    types: uniq(catalog.species.map((s) => s.type)).sort(),
    ingredients: catalog.ingredients,
    skills: uniq(catalog.species.map((s) => s.main_skill)).sort(),
    specialties: uniq(catalog.species.map((s) => s.specialty)).sort(),
  };
}

interface TeamProps {
  // Abre Comparación con ese Pokémon como base (lo cablea App).
  onCompare: (memberId: string) => void;
}

export function Team({ onCompare }: TeamProps) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Error de borrado (DELETE): se muestra junto a la lista, separado del error
  // del formulario de alta/edición.
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("dex");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<BoxFilters>(EMPTY_FILTERS);

  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const members = useQuery({ queryKey: ["members"], queryFn: api.listMembers });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  const create = useMutation({
    mutationFn: (data: MemberInput) => api.createMember(data),
    onSuccess: () => {
      setFormError(null);
      setFormOpen(false);
      invalidate();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MemberInput }) =>
      api.updateMember(id, data),
    onSuccess: () => {
      setFormError(null);
      setEditing(null);
      invalidate();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteMember(id),
    onSuccess: () => {
      setDeleteError(null);
      invalidate();
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  const openForm = () => {
    setFormError(null);
    setDeleteError(null);
    setFormOpen(true);
  };

  const openEdit = (member: Member) => {
    setFormError(null);
    setDeleteError(null);
    setEditing(member);
  };

  const natureByName = new Map((catalog.data?.natures ?? []).map((n) => [n.name, n]));
  const speciesByName = new Map((catalog.data?.species ?? []).map((s) => [s.name, s]));
  const tierBySubSkill = new Map((catalog.data?.sub_skills ?? []).map((s) => [s.name, s.tier]));

  if (catalog.isLoading) return <p className="muted">{t("common.loadingCatalog")}</p>;
  if (catalog.isError || !catalog.data)
    return <p className="error">{t("common.catalogError")}</p>;

  const allMembers = members.data ?? [];
  const visible = sortAndFilter(allMembers, speciesByName, sortKey, sortDir, filters);
  const options = filterOptions(catalog.data);
  const hasFilters = Object.values(filters).some((v) => v !== "");
  const setFilter = (key: keyof BoxFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="layout layout--wide">
      <header className="hero">
        <h1>{t("team.title")}</h1>
        <p className="muted">{t("team.subtitle")}</p>
      </header>

      <section>
        <div className="section-head">
          <h2>
            {t("team.box")}{" "}
            <span className="muted" role="status" aria-live="polite">
              {hasFilters
                ? t("box.showing", { shown: visible.length, total: allMembers.length })
                : `(${allMembers.length})`}
            </span>
            {/* Refetch en segundo plano (p. ej. tras editar): feedback sutil de que
                los datos visibles se están actualizando, sin bloquear la lista. */}
            {members.isFetching && !members.isLoading && (
              <span className="muted" role="status">
                {" "}
                {t("team.updating")}
              </span>
            )}
          </h2>
          <button className="btn btn--primary" onClick={openForm}>
            {t("team.add")}
          </button>
        </div>

        {members.isLoading && <p className="muted">{t("team.loadingBox")}</p>}
        {members.isError && (
          <p className="error" role="alert">
            {t("team.boxError")}{" "}
            <button type="button" className="btn btn--ghost" onClick={() => members.refetch()}>
              {t("common.retry")}
            </button>
          </p>
        )}
        {deleteError && (
          <p className="error" role="alert">
            {t("team.deleteError", { error: deleteError })}
          </p>
        )}
        {members.data?.length === 0 && <p className="muted">{t("team.boxEmpty")}</p>}

        {allMembers.length > 0 && (
          <BoxToolbar
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKey={setSortKey}
            onToggleDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            filters={filters}
            onFilter={setFilter}
            onClear={() => setFilters(EMPTY_FILTERS)}
            options={options}
            catalog={catalog.data}
          />
        )}

        {allMembers.length > 0 && visible.length === 0 && (
          <p className="muted" role="status">
            {t("box.noMatch")}{" "}
            <button type="button" className="btn btn--ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
              {t("box.clearFilters")}
            </button>
          </p>
        )}

        <div className="members">
          {visible.map((m) => (
            <BoxEntry
              key={m.id}
              member={m}
              species={speciesByName.get(m.species)}
              nature={natureByName.get(m.nature)}
              tierBySubSkill={(name) => tierBySubSkill.get(name)}
              onEdit={() => openEdit(m)}
              onDelete={(id) => remove.mutate(id)}
              onCompare={() => onCompare(m.id)}
            />
          ))}
        </div>
      </section>

      {allMembers.length > 0 && <BoxCoverage members={allMembers} catalog={catalog.data} />}

      {formOpen && (
        <Modal title={t("team.modalAdd")} onClose={() => setFormOpen(false)}>
          <MemberForm
            catalog={catalog.data}
            onSubmit={(data) => create.mutate(data)}
            pending={create.isPending}
            error={formError}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={t("team.modalEdit")} onClose={() => setEditing(null)}>
          <MemberForm
            catalog={catalog.data}
            initial={editing}
            submitLabel={t("team.saveChanges")}
            onSubmit={(data) => update.mutate({ id: editing.id, data })}
            pending={update.isPending}
            error={formError}
          />
        </Modal>
      )}
    </div>
  );
}
