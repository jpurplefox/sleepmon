import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";

import { api } from "../api/client";
import { berryIcon } from "../berries";
import { BoxPicker } from "../components/BoxPicker";
import { FilterPopover, gridKeyDown } from "../components/FilterPopover";
import { IconClose, IconEdit } from "../components/icons";
import { Modal } from "../components/Modal";
import { Placeholder } from "../components/Placeholder";
import { TeamNameDialog } from "../components/TeamNameDialog";
import { ContextBar, ContextField, ToolHeader } from "../components/ToolHeader";
import { useI18n } from "../i18n";
import { RECIPE_TYPES, dishTypeLabelKey, recipeImage } from "../recipes";
import { ROUTES } from "../routes";
import { filterTeams, hasFilters, type TeamFilters } from "../savedTeams";
import { spriteUrl } from "../sprites";
import type { Catalog, Member, SavedTeam } from "../types";
import { useDeleteTeam, useRenameTeam, useSavedTeamsQuery } from "../useSavedTeams";
import { useTeamSaver } from "../useTeamSaver";

// Module level so the empty set is not re-created on every render.
const NOTHING_TAKEN: Set<string> = new Set();

/** A single-choice filter: "All" plus the values some team uses. */
function ChoiceFilter<V extends string | null>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V | undefined;
  options: { value: V; label: string }[];
  onChange: (value: V | undefined) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const all: { value: V | undefined; label: string }[] = [{ value: undefined, label: t("saved.any") }, ...options];
  return (
    <FilterPopover
      open={open}
      onOpenChange={setOpen}
      triggerLabel={label}
      triggerContent={<span className="filter-btn__value">{current?.label ?? t("saved.any")}</span>}
    >
      <div className="filter-list" role="listbox" aria-label={label} onKeyDown={gridKeyDown}>
        {all.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value === undefined ? "__any__" : o.value === null ? "__none__" : o.value}
              type="button"
              role="option"
              aria-selected={selected}
              className={"filter-list__item" + (selected ? " is-selected" : "")}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span className="filter-list__label">{o.label}</span>
            </button>
          );
        })}
      </div>
    </FilterPopover>
  );
}

function Sprite({ catalog, species }: { catalog: Catalog; species: string }) {
  const dex = catalog.species.find((s) => s.name === species)?.dex;
  return dex ? (
    <img className="saved-team-card__sprite" src={spriteUrl(dex)} alt={species} title={species} />
  ) : (
    <span className="saved-team-card__sprite saved-team-card__sprite--unknown" title={species}>
      ?
    </span>
  );
}

function SavedTeamCard({
  team,
  catalog,
  members,
  onOpen,
  onRename,
  onDelete,
}: {
  team: SavedTeam;
  catalog: Catalog;
  members: ReadonlyMap<string, Member>;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { t, lang, berry } = useI18n();
  const species = (id: string) => members.get(id)?.species ?? "?";
  const island = catalog.islands.find((i) => i.name === team.island);
  // On an expert map the main favorite reads first, as in the context bar.
  const berries =
    island?.expert && team.main_favorite && team.favorite_berries.includes(team.main_favorite)
      ? [team.main_favorite, ...team.favorite_berries.filter((b) => b !== team.main_favorite)]
      : team.favorite_berries;
  const date = new Date(team.saved_at).toLocaleDateString(lang === "es" ? "es-AR" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const noMeals = team.meals.every((m) => m === null);

  return (
    <article className="card saved-team-card" aria-labelledby={`team-${team.id}`}>
      <div className="saved-team-card__head">
        <h2 id={`team-${team.id}`} className="saved-team-card__name" title={team.name}>
          {team.name}
        </h2>
        <button
          type="button"
          className="icon-btn"
          aria-label={t("saved.rename", { name: team.name })}
          title={t("saved.rename", { name: team.name })}
          onClick={onRename}
        >
          <IconEdit />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--danger"
          aria-label={t("saved.delete", { name: team.name })}
          title={t("saved.delete", { name: team.name })}
          onClick={onDelete}
        >
          <IconClose />
        </button>
      </div>

      <ul className="saved-team-card__members">
        {team.slots.map((slot, i) =>
          slot.members.length === 2 ? (
            <li key={i} className="saved-team-card__split">
              <span className="saved-team-card__pair">
                <Sprite catalog={catalog} species={species(slot.members[0])} />
                <Sprite catalog={catalog} species={species(slot.members[1])} />
              </span>
              <span className="saved-team-card__share muted">
                {t("saved.split", {
                  a: Math.round(slot.share * 100),
                  b: 100 - Math.round(slot.share * 100),
                })}
              </span>
            </li>
          ) : (
            <li key={i}>
              <Sprite catalog={catalog} species={species(slot.members[0])} />
            </li>
          ),
        )}
      </ul>

      <p className="saved-team-card__line">
        <span className="muted">{team.island ?? t("ctx.noMap")}</span>
        {team.island !== null && berries.length > 0 && (
          <span className="filter-btn__icons">
            {berries.map((b) => (
              <img key={b} className="mini-icon" src={berryIcon(b)} alt={berry(b)} title={berry(b)} />
            ))}
          </span>
        )}
      </p>

      <p className="saved-team-card__line">
        <span className="muted">
          {team.dish_type ? t(dishTypeLabelKey(team.dish_type)) : t("saved.noDishType")}
        </span>
        {noMeals ? (
          <span className="muted">{t("ctx.noMeals")}</span>
        ) : (
          <span className="ctx-recipes">
            {team.meals.map((m, i) =>
              m ? (
                <img key={i} className="ctx-recipe" src={recipeImage(m)} alt={m} title={m} />
              ) : (
                <span key={i} className="ctx-recipe ctx-recipe--empty" aria-hidden="true" />
              ),
            )}
          </span>
        )}
      </p>

      <div className="saved-team-card__foot">
        <span className="muted saved-team-card__date">{t("saved.savedOn", { date })}</span>
        <button type="button" className="btn btn--primary" onClick={onOpen}>
          {t("saved.open")}
        </button>
      </div>
    </article>
  );
}

/** The Teams tool: the saved teams, filtered, opened, renamed and deleted (PRD 0016). */
export function SavedTeams() {
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const saved = useSavedTeamsQuery();
  const saver = useTeamSaver(catalog.data);
  const rename = useRenameTeam();
  const remove = useDeleteTeam();

  const [filters, setFilters] = useState<TeamFilters>({});
  const [picking, setPicking] = useState(false);
  const [renaming, setRenaming] = useState<SavedTeam | null>(null);
  const [deleting, setDeleting] = useState<SavedTeam | null>(null);

  const membersQuery = useQuery({ queryKey: ["members"], queryFn: api.listMembers });

  if (catalog.isLoading || saved.isLoading) return <Placeholder loading>{t("saved.loading")}</Placeholder>;
  if (catalog.isError || !catalog.data || saved.isError || !saved.data)
    return (
      <p className="error" role="alert">
        {t("saved.loadError")}{" "}
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            catalog.refetch();
            saved.refetch();
          }}
        >
          {t("common.retry")}
        </button>
      </p>
    );

  const teams = saved.data;
  const members = saver.members;
  // A deleted Box Pokémon can't be filtered by any more.
  const activeFilters: TeamFilters =
    filters.memberId !== undefined && membersQuery.isSuccess && !members.has(filters.memberId)
      ? { ...filters, memberId: undefined }
      : filters;
  const visible = filterTeams(teams, activeFilters);
  const filterMember = activeFilters.memberId ? members.get(activeFilters.memberId) : undefined;

  return (
    <div className="layout layout--wide">
      <ToolHeader
        title={t("saved.title")}
        count={
          <span className="tool-count" role="status" aria-live="polite">
            ({teams.length})
          </span>
        }
      >
        {teams.length > 1 && (
          <ContextBar>
            <ContextField label={t("saved.filterMap")}>
              <ChoiceFilter<string | null>
                label={t("saved.filterMap")}
                value={activeFilters.island}
                options={[
                  ...catalog.data.islands.map((i) => ({ value: i.name, label: i.name })),
                  { value: null, label: t("ctx.noMap") },
                ]}
                onChange={(island) => setFilters((f) => ({ ...f, island }))}
              />
            </ContextField>
            <ContextField label={t("saved.filterDish")}>
              {/* The Box's specialty toggle: pressing the active type again clears it. */}
              <div className="specialty-toggle" role="group" aria-label={t("saved.filterDish")}>
                {RECIPE_TYPES.map((type) => {
                  const pressed = activeFilters.dishType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      className={"specialty-toggle__btn" + (pressed ? " is-on" : "")}
                      aria-pressed={pressed}
                      onClick={() =>
                        setFilters((f) => ({ ...f, dishType: pressed ? undefined : type }))
                      }
                    >
                      {t(dishTypeLabelKey(type))}
                    </button>
                  );
                })}
              </div>
            </ContextField>
            <ContextField label={t("saved.filterPokemon")}>
              <span className="saved-teams__pokemon-filter">
                <button
                  type="button"
                  className="filter-btn"
                  aria-haspopup="dialog"
                  aria-label={`${t("saved.filterPokemon")}: ${filterMember?.species ?? t("saved.any")}`}
                  onClick={() => setPicking(true)}
                >
                  <span className="filter-btn__value">
                    {filterMember ? (
                      <>
                        <Sprite catalog={catalog.data} species={filterMember.species} />
                        {filterMember.species}
                      </>
                    ) : (
                      t("saved.any")
                    )}
                  </span>
                </button>
                {filterMember && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t("saved.clearPokemon")}
                    title={t("saved.clearPokemon")}
                    onClick={() => setFilters((f) => ({ ...f, memberId: undefined }))}
                  >
                    <IconClose />
                  </button>
                )}
              </span>
            </ContextField>
            {hasFilters(activeFilters) && (
              <button
                type="button"
                className="btn btn--ghost saved-teams__clear"
                onClick={() => setFilters({})}
              >
                {t("saved.clearFilters")}
              </button>
            )}
          </ContextBar>
        )}
      </ToolHeader>

      {teams.length === 0 ? (
        <div className="card saved-teams-empty">
          <p className="saved-teams-empty__lead">{t("saved.emptyLead")}</p>
          <p className="muted">{t("saved.emptyBody")}</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate(ROUTES.teamAnalysis)}>
            {t("saved.goToAnalysis")}
          </button>
        </div>
      ) : visible.length === 0 ? (
        <Placeholder>
          {t("saved.noMatch")}{" "}
          <button type="button" className="btn btn--ghost" onClick={() => setFilters({})}>
            {t("saved.clearFilters")}
          </button>
        </Placeholder>
      ) : (
        <div className="saved-teams">
          {visible.map((team) => (
            <SavedTeamCard
              key={team.id}
              team={team}
              catalog={catalog.data}
              members={members}
              onOpen={() => saver.open(team)}
              onRename={() => {
                rename.reset();
                setRenaming(team);
              }}
              onDelete={() => {
                remove.reset();
                setDeleting(team);
              }}
            />
          ))}
        </div>
      )}

      {saver.dialog}

      {picking && (
        <Modal title={t("saved.pickPokemon")} onClose={() => setPicking(false)}>
          <BoxPicker
            members={membersQuery.data}
            isLoading={membersQuery.isLoading}
            isError={membersQuery.isError}
            onRetry={() => membersQuery.refetch()}
            catalog={catalog.data}
            inComparison={NOTHING_TAKEN}
            onPick={(m) => {
              setFilters((f) => ({ ...f, memberId: m.id }));
              setPicking(false);
            }}
          />
        </Modal>
      )}

      {renaming && (
        <TeamNameDialog
          title={t("saved.renameTitle")}
          initialName={renaming.name}
          teams={teams}
          ownId={renaming.id}
          confirmLabel={t("saved.save")}
          pending={rename.isPending}
          serverError={rename.error?.message ?? null}
          onConfirm={(name) =>
            rename.mutate({ id: renaming.id, name }, { onSuccess: () => setRenaming(null) })
          }
          onClose={() => setRenaming(null)}
        />
      )}

      {deleting && (
        <Modal
          title={t("saved.deleteTitle", { name: deleting.name })}
          onClose={() => {
            if (!remove.isPending) setDeleting(null);
          }}
        >
          <p className="muted">{t("saved.deleteBody")}</p>
          {remove.error && (
            <p className="error" role="alert">
              {remove.error.message}
            </p>
          )}
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
              onClick={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
              disabled={remove.isPending}
            >
              {remove.isPending ? t("saved.deleting") : t("saved.deleteConfirm")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
