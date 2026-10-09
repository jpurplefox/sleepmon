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
import { Placeholder } from "../components/Placeholder";
import { ToolHeader } from "../components/ToolHeader";
import { useI18n } from "../i18n";
import { totalIngredients } from "../ingredientProduction";
import { track } from "../telemetry/analytics";
import type { Catalog, Member, MemberInput, Species } from "../types";
import { deletionImpact } from "../savedTeams";
import { SPECIALTIES, matchesSpecialty } from "../specialties";
import { VERSATILE, effectiveSkill } from "../versatile";
import { SAVED_TEAMS_KEY, useSavedTeamsQuery } from "../useSavedTeams";

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
    // Tipo/baya e ingrediente son multi-selección: OR dentro de la dimensión
    // (matchea si el array está vacío o si hay intersección), AND entre dimensiones.
    if (filters.type.length > 0 && !(sp && filters.type.includes(sp.type))) return false;
    if (
      filters.ingredient.length > 0 &&
      !filters.ingredient.some((ing) => m.ingredients.includes(ing))
    )
      return false;
    // Skill y especialidad siguen siendo single-select (string).
    if (filters.skill && effectiveSkill(sp?.main_skill, m.versatile_skill) !== filters.skill)
      return false;
    if (!matchesSpecialty(sp?.specialty, filters.specialty)) return false;
    return true;
  };
  const value = (m: Member): number => {
    switch (sortKey) {
      case "level":
        return m.level;
      case "berries":
        return m.production?.berries ?? 0;
      case "strength":
        return m.production ? m.production.berry_strength + (m.production.skill_strength ?? 0) : 0;
      case "ingredients":
        return m.production ? totalIngredients(m.production) : 0;
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
    // Mew's Versatile isn't a skill of its own: its options join the list instead.
    skills: uniq([
      ...catalog.species.map((s) => s.main_skill).filter((s) => s !== VERSATILE),
      ...(catalog.versatile_skills ?? []),
    ]).sort(),
    specialties: [...SPECIALTIES],
  };
}

interface TeamProps {
  // Abre Comparación con ese Pokémon como base (lo cablea App).
  onCompare: (memberId: string) => void;
}

// "A, B y C": a list of names in running text.
function joinNames(names: string[], and: string): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")}${and}${names[names.length - 1]}`;
}

export function Team({ onCompare }: TeamProps) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  // Whether the open add/edit form holds unsaved input: leaving it then asks first.
  const [formDirty, setFormDirty] = useState(false);
  // Error de borrado (DELETE): se muestra junto a la lista, separado del error
  // del formulario de alta/edición.
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Pokémon pendiente de confirmar borrado (abre el modal de confirmación).
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("dex");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<BoxFilters>(EMPTY_FILTERS);

  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const members = useQuery({ queryKey: ["members"], queryFn: api.listMembers });
  // Deleting a Box Pokémon also takes it out of the saved teams it is in (PRD 0016).
  const savedTeams = useSavedTeamsQuery();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  const create = useMutation({
    mutationFn: (data: MemberInput) => api.createMember(data),
    onSuccess: (member) => {
      track({ name: "box_pokemon_saved", props: { origin: "box", action: "create", species: member.species } });
      setFormError(null);
      setFormOpen(false);
      invalidate();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MemberInput }) =>
      api.updateMember(id, data),
    onSuccess: (member) => {
      track({ name: "box_pokemon_saved", props: { origin: "box", action: "update", species: member.species } });
      setFormError(null);
      setEditing(null);
      invalidate();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const remove = useMutation({
    mutationFn: (vars: { id: string; teamsAffected: number }) => api.deleteMember(vars.id),
    onSuccess: (_r, vars) => {
      track({ name: "box_pokemon_deleted", props: { teams_affected: vars.teamsAffected } });
      setDeleteError(null);
      setDeleting(null);
      invalidate();
      qc.invalidateQueries({ queryKey: SAVED_TEAMS_KEY });
    },
    onError: (err: Error) => {
      setDeleting(null);
      setDeleteError(err.message);
    },
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

  if (catalog.isLoading) return <Placeholder loading>{t("common.loadingCatalog")}</Placeholder>;
  if (catalog.isError || !catalog.data)
    return <p className="error">{t("common.catalogError")}</p>;

  const allMembers = members.data ?? [];
  const visible = sortAndFilter(allMembers, speciesByName, sortKey, sortDir, filters);
  const options = filterOptions(catalog.data);
  // Hay filtros activos si alguna dimensión single tiene valor o alguna multi
  // (arrays) tiene al menos un elemento.
  const hasFilters =
    filters.skill !== "" ||
    filters.specialty !== "" ||
    filters.type.length > 0 ||
    filters.ingredient.length > 0;
  // Single-select (skill / specialty): set directo.
  const setFilter = (key: "skill" | "specialty", value: string) => {
    if (value !== "") track({ name: "list_filtered", props: { list: "box", filter: key } });
    setFilters((f) => ({ ...f, [key]: value }));
  };
  // Multi-select (type / ingredient): toggle del valor dentro del array.
  const toggleFilter = (key: "type" | "ingredient", value: string) => {
    if (!filters[key].includes(value)) track({ name: "list_filtered", props: { list: "box", filter: key } });
    setFilters((f) => {
      const current = f[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...f, [key]: next };
    });
  };
  // Quita un valor concreto de cualquier dimensión (para el × de cada chip).
  const removeFilter = (key: keyof BoxFilters, value: string) =>
    setFilters((f) => {
      if (key === "type" || key === "ingredient") {
        return { ...f, [key]: f[key].filter((v) => v !== value) };
      }
      return { ...f, [key]: "" };
    });

  return (
    <div className="layout layout--wide">
      <section>
        <ToolHeader
          title={t("team.box")}
          count={
            <>
              {/* Count and refetch state stay outside the h1 and always mounted, so changes are announced. */}
              <span className="tool-count" role="status" aria-live="polite">
                {hasFilters
                  ? t("box.showing", { shown: visible.length, total: allMembers.length })
                  : `(${allMembers.length})`}
              </span>
              <span className="muted" role="status" aria-live="polite">
                {members.isFetching && !members.isLoading ? t("team.updating") : ""}
              </span>
            </>
          }
          action={
            <button className="btn btn--primary" onClick={openForm}>
              {t("team.add")}
            </button>
          }
        >
          {/* With a single Pokémon, sorting and filtering add nothing: no bar. */}
          {allMembers.length > 1 && (
            <BoxToolbar
              sortKey={sortKey}
              sortDir={sortDir}
              onSortKey={(k) => {
                // Only a change of key counts; re-picking the current one is not a sort.
                if (k !== sortKey)
                  track({ name: "list_sorted", props: { list: "box", key: k, direction: sortDir } });
                setSortKey(k);
              }}
              onToggleDir={() => {
                const next = sortDir === "asc" ? "desc" : "asc";
                track({ name: "list_sorted", props: { list: "box", key: sortKey, direction: next } });
                setSortDir(next);
              }}
              filters={filters}
              onFilter={setFilter}
              onToggle={toggleFilter}
              onRemove={removeFilter}
              onClear={() => setFilters(EMPTY_FILTERS)}
              options={options}
              catalog={catalog.data}
            />
          )}
        </ToolHeader>

        {members.isLoading && <Placeholder loading>{t("team.loadingBox")}</Placeholder>}
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
            {t("team.deleteError", { error: deleteError })}{" "}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setDeleteError(null)}
            >
              {t("common.close")}
            </button>
          </p>
        )}
        {members.data?.length === 0 && (
          <Placeholder>
            <strong>{t("team.emptyLead")}</strong> {t("team.emptyBody")}
          </Placeholder>
        )}

        {allMembers.length > 0 && visible.length === 0 && (
          <Placeholder>
            {t("box.noMatch")}{" "}
            <button type="button" className="btn btn--ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
              {t("box.clearFilters")}
            </button>
          </Placeholder>
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
              onDelete={() => setDeleting(m)}
              onCompare={() => onCompare(m.id)}
            />
          ))}
        </div>
      </section>

      {allMembers.length > 0 && <BoxCoverage members={allMembers} catalog={catalog.data} />}

      {formOpen && (
        <Modal title={t("team.modalAdd")} onClose={() => setFormOpen(false)} dirty={formDirty}>
          <MemberForm
            catalog={catalog.data}
            onDirtyChange={setFormDirty}
            onSubmit={(data) => create.mutate(data)}
            pending={create.isPending}
            error={formError}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={t("team.modalEdit")} onClose={() => setEditing(null)} dirty={formDirty}>
          <MemberForm
            catalog={catalog.data}
            onDirtyChange={setFormDirty}
            initial={editing}
            submitLabel={t("team.saveChanges")}
            onSubmit={(data) => update.mutate({ id: editing.id, data })}
            pending={update.isPending}
            error={formError}
          />
        </Modal>
      )}

      {deleting && (
        <Modal
          title={t("member.deleteModalTitle", { species: deleting.species })}
          onClose={() => {
            // No cerrar mientras el borrado está en vuelo: evita perder de vista qué
            // Pokémon se está eliminando si la mutación falla.
            if (!remove.isPending) setDeleting(null);
          }}
        >
          <p className="muted">{t("member.deleteModalBody")}</p>
          {(() => {
            const { inTeams, deleted } = deletionImpact(savedTeams.data ?? [], deleting.id);
            if (inTeams.length === 0) return null;
            const names = (teams: typeof inTeams) => joinNames(teams.map((tm) => `«${tm.name}»`), t("saved.and"));
            return (
              <p className="muted">
                {t("saved.inTeams", { teams: names(inTeams) })}
                {deleted.length > 0 &&
                  " " +
                    t(deleted.length === 1 ? "saved.deletedOne" : "saved.deletedMany", {
                      teams: names(deleted),
                    })}
              </p>
            );
          })()}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn--ghost"
              data-autofocus
              onClick={() => setDeleting(null)}
              disabled={remove.isPending}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() =>
                remove.mutate({
                  id: deleting.id,
                  teamsAffected: deletionImpact(savedTeams.data ?? [], deleting.id).inTeams.length,
                })
              }
              disabled={remove.isPending}
            >
              {remove.isPending ? t("member.deleting") : t("member.delete")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
