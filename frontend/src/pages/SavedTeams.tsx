import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";

import { api } from "../api/client";
import { berryIcon } from "../berries";
import { BoxPicker } from "../components/BoxPicker";
import { FilterPopover, gridKeyDown } from "../components/FilterPopover";
import { ActionMenu } from "../components/ActionMenu";
import { IconClose, IconOpen, IconTrash } from "../components/icons";
import { Modal } from "../components/Modal";
import { Placeholder } from "../components/Placeholder";
import { Tooltip } from "../components/Tooltip";
import { ContextBar, ContextField, ToolHeader } from "../components/ToolHeader";
import { useI18n } from "../i18n";
import { RECIPE_TYPES, dishTypeLabelKey, recipeImage } from "../recipes";
import { ROUTES } from "../routes";
import { filterTeams, hasFilters, type TeamFilters } from "../savedTeams";
import { spriteUrl } from "../sprites";
import type { Catalog, Member, SavedTeam } from "../types";
import { useDeleteTeam, useSavedTeamsQuery } from "../useSavedTeams";
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
    <img className="team-slot-mini__sprite" src={spriteUrl(dex)} alt={species} />
  ) : (
    <span className="team-slot-mini__sprite team-slot-mini__sprite--unknown">
      ?
    </span>
  );
}

/**
 * One slot as a fixed box: a single Pokémon, or a split's two stacked with a
 * vertical bar beside them whose two lengths are their shares (top is top).
 */
function SlotMini({
  catalog,
  species,
  share,
}: {
  catalog: Catalog;
  species: string[];
  share: number;
}) {
  if (species.length < 2) {
    return (
      <li className="team-slot-mini">
        {/* Tooltips, not `title`s: a phone has no hover to name the sprite. */}
        <Tooltip content={species[0] ?? "?"}>
          <Sprite catalog={catalog} species={species[0] ?? "?"} />
        </Tooltip>
      </li>
    );
  }
  const a = Math.round(share * 100);
  const label = `${species[0]} ${a}% · ${species[1]} ${100 - a}%`;
  return (
    <li className="team-slot-mini team-slot-mini--split">
      <span className="sr-only">{label}</span>
      <Tooltip content={label} className="team-slot-mini__tip">
        <span className="team-slot-mini__pair" aria-hidden="true">
          <Sprite catalog={catalog} species={species[0]} />
          <Sprite catalog={catalog} species={species[1]} />
        </span>
        <span className="team-slot-mini__bar" aria-hidden="true">
          <i className="team-slot-mini__bar-a" style={{ flexGrow: a }} />
          <i className="team-slot-mini__bar-b" style={{ flexGrow: 100 - a }} />
        </span>
      </Tooltip>
    </li>
  );
}

const SLOT_COUNT = 5;

export function SavedTeamRow({
  team,
  catalog,
  members,
  onOpen,
  onDelete,
}: {
  team: SavedTeam;
  catalog: Catalog;
  members: ReadonlyMap<string, Member>;
  onOpen: () => void;
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
    <li className="team-row" aria-labelledby={`team-${team.id}`}>
      {/* The name opens the team: it's the one thing a saved team is for, so it is
          one tap, not one behind the ··· menu (which keeps it too, beside Delete). */}
      <button
        type="button"
        className="team-row__name"
        title={team.name}
        aria-label={t("saved.openNamed", { name: team.name })}
        onClick={onOpen}
      >
        {/* The row is labelled by the bare name, not by the button's action. */}
        <span id={`team-${team.id}`}>{team.name}</span>
      </button>

      <ul className="team-row__slots" aria-label={t("saved.colSlots")}>
        {team.slots.map((slot, i) => (
          <SlotMini
            key={i}
            catalog={catalog}
            species={slot.members.map(species)}
            share={slot.share}
          />
        ))}
        {Array.from({ length: Math.max(0, SLOT_COUNT - team.slots.length) }, (_, i) => (
          <li key={`empty-${i}`} className="team-slot-mini team-slot-mini--empty" aria-hidden="true" />
        ))}
      </ul>

      <span className="team-row__field team-row__map">
        <span className="team-row__label">{t("saved.filterMap")}</span>
        <span className="team-row__value">
          <span className={team.island === null ? "muted" : undefined}>
            {team.island ?? t("ctx.noMap")}
          </span>
          {team.island !== null && berries.length > 0 && (
            <span className="filter-btn__icons">
              {berries.map((b) => (
                <Tooltip key={b} content={berry(b)}>
                  <img className="mini-icon" src={berryIcon(b)} alt={berry(b)} />
                </Tooltip>
              ))}
            </span>
          )}
        </span>
      </span>

      <span className="team-row__field team-row__meals">
        <span className="team-row__label">{t("saved.colMeals")}</span>
        <span className="team-row__value">
          <span className="muted">
            {team.dish_type ? t(dishTypeLabelKey(team.dish_type)) : t("saved.noDishType")}
          </span>
          {noMeals ? (
            <span className="muted">{t("ctx.noMeals")}</span>
          ) : (
            <span className="ctx-recipes">
              {team.meals.map((m, i) =>
                m ? (
                  <Tooltip key={i} content={m}>
                    <img className="ctx-recipe" src={recipeImage(m)} alt={m} />
                  </Tooltip>
                ) : (
                  <span key={i} className="ctx-recipe ctx-recipe--empty" aria-hidden="true" />
                ),
              )}
            </span>
          )}
        </span>
      </span>

      <span className="team-row__date">
        <span className="sr-only">{t("saved.colSaved")}: </span>
        {date}
      </span>

      <span className="team-row__actions">
        <ActionMenu
          label={t("saved.actions", { name: team.name })}
          items={[
            {
              label: t("saved.openInAnalysis"),
              icon: <IconOpen />,
              onSelect: onOpen,
            },
            {
              label: t("saved.deleteConfirm"),
              icon: <IconTrash />,
              tone: "danger",
              separated: true,
              ariaLabel: t("saved.delete", { name: team.name }),
              onSelect: onDelete,
            },
          ]}
        />
      </span>
    </li>
  );
}

/** The Teams tool: the saved teams, filtered, opened, renamed and deleted (PRD 0016). */
export function SavedTeams() {
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const saved = useSavedTeamsQuery();
  const saver = useTeamSaver(catalog.data);
  const remove = useDeleteTeam();

  const [filters, setFilters] = useState<TeamFilters>({});
  const [picking, setPicking] = useState(false);
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
        <div className="team-rows">
          <div className="team-rows__head" aria-hidden="true">
            <span>{t("saved.colTeam")}</span>
            <span>{t("saved.colSlots")}</span>
            <span>{t("saved.filterMap")}</span>
            <span>{t("saved.colMeals")}</span>
            <span>{t("saved.colSaved")}</span>
            <span />
          </div>
          <ul className="team-rows__list">
            {visible.map((team) => (
              <SavedTeamRow
                key={team.id}
                team={team}
                catalog={catalog.data}
                members={members}
                onOpen={() => saver.open(team)}
                onDelete={() => {
                  remove.reset();
                  setDeleting(team);
                }}
              />
            ))}
          </ul>
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
