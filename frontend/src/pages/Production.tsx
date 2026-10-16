import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";

import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useGate } from "../auth/useGate";
import { BoxPicker } from "../components/BoxPicker";
import { ComparisonLevelField } from "../components/ComparisonLevelField";
import { ComparisonMapBar } from "../components/ComparisonMapBar";
import { IconMoon, IconShare } from "../components/icons";
import { InfoNotice } from "../components/InfoNotice";
import { MemberForm } from "../components/MemberForm";
import { Modal } from "../components/Modal";
import { Placeholder } from "../components/Placeholder";
import { ProductionCard } from "../components/ProductionCard";
import { ShareDialog } from "../components/ShareDialog";
import { SuggestionRow } from "../components/SuggestionRow";
import { SwipePager } from "../components/SwipePager";
import { ContextBar, ToolHeader } from "../components/ToolHeader";
import { comparableOf, suggestComparables } from "../comparisonSuggestions";
import { berryRoleOf, mapRequestFields } from "../comparisonMap";
import { bakeRaisedLevels } from "../comparisonLevel";
import { useComparisonSession } from "../comparisonSession";
import { sessionFromShare, shareIdFrom, sleepDiffers, sleepNoticeParts } from "../comparisonShare";
import { useI18n } from "../i18n";
import { configFromMember, linkEntryToBox, newEntry } from "../roster";
import { ROUTES } from "../routes";
import { spriteUrl } from "../sprites";
import { track } from "../telemetry/analytics";
import type { AddSource } from "../telemetry/events";
import { comparisonLevelSetEvent, mapSetEvent } from "../telemetry/props";
import type { Member, MemberInput, SleepSchedule } from "../types";
import { useSaveToBox } from "../useSaveToBox";
import { useScreenshotImport } from "../useScreenshotImport";
import { useStickyData } from "../useStickyData";
import { useProgress } from "../useProgress";
import { effectiveSkill } from "../versatile";

// Tope de la comparación: el máximo del equipo en el juego.
const MAX_COMPARE = 5;

interface ProductionProps {
  // Set by "Compare" in the box: Comparison opens with only that Pokémon (as the
  // base); then cleared through onBaseConsumed.
  baseMemberId?: string | null;
  onBaseConsumed?: () => void;
}

// The notice's two schedules in bold: split the template on its placeholders.
function renderNotice(template: string, theirs: string, yours: string) {
  return template.split(/(\{theirs\}|\{yours\})/).map((part, i) =>
    part === "{theirs}" ? <strong key={i}>{theirs}</strong> : part === "{yours}" ? <strong key={i}>{yours}</strong> : part,
  );
}

export function Production({ baseMemberId, onBaseConsumed }: ProductionProps = {}) {
  const { t } = useI18n();
  const { status } = useAuth();
  const { guard } = useGate();
  const { save, statusOf, reset } = useSaveToBox();
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  // Reading the Box is reserved: only fetch it once signed in, so the open
  // ephemeral comparator makes no /team request (and no 401) while anonymous.
  const members = useQuery({
    queryKey: ["members"],
    queryFn: api.listMembers,
    enabled: status === "authenticated",
  });

  // The saved sleep schedule (defaults when signed out) shapes every card.
  const { progress, isLoading: progressLoading } = useProgress();
  // Hold the queries until the saved schedule is known, so no default-schedule flash.
  const sleepReady = status === "anonymous" || (status === "authenticated" && !progressLoading);

  // Cards and map terms live above the routes, so leaving the tool keeps them.
  const { entries, setEntries, map, setMap, comparisonLevel, setComparisonLevel } = useComparisonSession();
  const island = catalog.data?.islands.find((i) => i.name === map.island) ?? null;
  const expert = island?.expert ?? false;
  const mapFields = mapRequestFields(map, expert);
  const shots = useScreenshotImport(catalog.data);
  const berryOf = (species: string) => catalog.data?.species.find((s) => s.name === species)?.berry ?? "";
  const [sharerSleep, setSharerSleep] = useState<SleepSchedule | null>(null);
  const [modal, setModal] = useState<"form" | "box" | "share" | null>(null);
  // Whether the open add/edit form holds unsaved input: leaving it then asks first.
  const [formDirty, setFormDirty] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  // Aviso al usuario cuando una acción no se pudo concretar (p. ej. agregar una
  // especie que no está en el catálogo cargado).
  const [notice, setNotice] = useState<string | null>(null);

  // El cálculo de cada card vive en el padre (una query por entry) para poder
  // comparar contra la base (la primera) y mostrar los deltas. La cache de
  // react-query (keyed por config) evita recalcular al reordenar.
  const productions = useQueries({
    queries: entries.map((e) => ({
      enabled: sleepReady,
      queryKey: ["production", e.config, mapFields, progress.sleep, comparisonLevel],
      queryFn: () =>
        api.computeProduction({
          species: e.config.species,
          level: e.config.level,
          ingredients: e.config.ingredients,
          nature: e.config.nature,
          sub_skills: e.config.sub_skills,
          ribbon: e.config.ribbon,
          skill_level: e.config.skill_level,
          versatile_skill: e.config.versatile_skill,
          ...mapFields,
          sleep: progress.sleep,
          ...(comparisonLevel !== null && { comparison_level: comparisonLevel }),
        }),
      // El resultado de una config es estable: no re-pedir ni reflashear
      // "Calculando…" al reordenar o revisitar una card ya calculada.
      staleTime: 60_000,
      // POST /production puede devolver 400 (determinista): reintentar con el
      // backoff por defecto solo retrasa ~7s la aparición del error. Sin
      // reintentos aquí (no global: members/catalog sí reintentan ante red).
      retry: false,
    })),
  });
  // Each card keeps its numbers while a map change recomputes them (no blank flicker).
  const shownProductions = useStickyData(
    entries.map((e) => e.id),
    productions.map((q) => q.data),
  );
  const baseProduction = shownProductions[0] ?? null;

  const atMax = entries.length >= MAX_COMPARE;

  // On a phone the cards swipe one per screen (CSS); the pager keeps the card
  // you're working with in view.
  const cardsRef = useRef<HTMLDivElement>(null);
  const dexOf = (species: string) => catalog.data?.species.find((s) => s.name === species)?.dex;

  // Miembros de la caja que ya están como card (por su id de origen), para no
  // ofrecer agregarlos dos veces sin querer.
  const inComparison = useMemo(
    () => new Set(entries.map((e) => e.sourceId).filter((id): id is string => !!id)),
    [entries],
  );

  // PRD 0002: Box Pokémon comparable to the base, signed in with room to add.
  const speciesByName = useMemo(
    () => new Map((catalog.data?.species ?? []).map((s) => [s.name, s])),
    [catalog.data],
  );
  const baseEntry = entries[0];
  const suggestions = useMemo(() => {
    const baseSpecies = baseEntry && speciesByName.get(baseEntry.config.species);
    if (atMax || !baseSpecies || !members.data || !baseProduction) return [];
    const base = comparableOf(
      baseSpecies,
      baseEntry.config.versatile_skill,
      baseProduction.main_ingredient_at_60,
    );
    return suggestComparables(
      base,
      members.data,
      (m) => {
        const s = speciesByName.get(m.species);
        return s ? comparableOf(s, m.versatile_skill, m.production?.main_ingredient_at_60) : null;
      },
      (name) => speciesByName.get(name)?.dex ?? 0,
      inComparison,
    );
  }, [atMax, baseEntry, baseProduction, members.data, speciesByName, inComparison]);
  const tierBySubSkill = useMemo(
    () => new Map((catalog.data?.sub_skills ?? []).map((s) => [s.name, s.tier])),
    [catalog.data],
  );
  const natureByName = useMemo(
    () => new Map((catalog.data?.natures ?? []).map((n) => [n.name, n])),
    [catalog.data],
  );

  // Swaps two cards without shifting the ones between: ‹ › swap neighbours,
  // "Make base" swaps with the first.
  const swapEntries = (a: number, b: number) =>
    setEntries((prev) => {
      if (a === b || a < 0 || b < 0 || a >= prev.length || b >= prev.length) return prev;
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });

  // An import arrived: open the add form pre-filled with it.
  useEffect(() => {
    if (shots.imported) {
      setEditIndex(null);
      setModal("form");
    }
  }, [shots.imported]);

  // A card landed in the comparison: record where it came from, and the limit.
  const recordAdded = (source: AddSource, species: string, countBefore: number) => {
    if (countBefore >= MAX_COMPARE) return;
    track({ name: "pokemon_added", props: { tool: "compare", source, species } });
    if (countBefore + 1 === MAX_COMPARE) track({ name: "compare_limit_reached", props: {} });
  };

  // Inserta una card nueva (sin origen) o reemplaza la config de la que estábamos
  // editando, manteniendo su sourceId. Cierra el modal.
  const upsert = (config: MemberInput) => {
    // Editing replaces the config but not the id, so a stale save status
    // (saved or errored) would otherwise survive describing a config that
    // was never submitted.
    if (editIndex !== null) reset(entries[editIndex].id);
    if (editIndex === null) recordAdded(shots.imported ? "screenshots" : "new", config.species, entries.length);
    setEntries((prev) =>
      editIndex === null
        ? prev.length >= MAX_COMPARE
          ? prev
          : [...prev, newEntry(config)]
        : prev.map((e, i) => (i === editIndex ? { ...e, config } : e)),
    );
    setModal(null);
    setEditIndex(null);
    shots.clear();
  };

  // Duplica una card como una variante nueva: el clon NO hereda el origen.
  const cloneAt = (i: number) => {
    recordAdded("clone", entries[i].config.species, entries.length);
    setEntries((prev) =>
      prev.length >= MAX_COMPARE ? prev : [...prev, newEntry(prev[i].config)],
    );
  };

  const pickMember = (m: Member, source: AddSource = "box") => {
    if (!catalog.data) return; // BoxPicker only renders once the catalog is loaded
    const config = configFromMember(catalog.data, m);
    if (!config) {
      track({ name: "species_missing", props: { species: m.species, tool: "compare" } });
      setNotice(t("prod.speciesNotInCatalog", { species: m.species }));
      setModal(null);
      setEditIndex(null);
      return;
    }
    setNotice(null);
    recordAdded(source, config.species, entries.length);
    setEntries((prev) => (prev.length >= MAX_COMPARE ? prev : [...prev, newEntry(config, m.id)]));
    setModal(null);
    setEditIndex(null);
  };

  // "Compare" from the box: a new comparison with only that Pokémon.
  useEffect(() => {
    if (!baseMemberId || !members.data || !catalog.data) return;
    const m = members.data.find((x) => x.id === baseMemberId);
    if (!m) {
      onBaseConsumed?.();
      return;
    }
    const config = configFromMember(catalog.data, m);
    if (!config) {
      track({ name: "species_missing", props: { species: m.species, tool: "compare" } });
      setNotice(t("prod.speciesNotInCatalog", { species: m.species }));
      onBaseConsumed?.();
      return;
    }
    setNotice(null);
    // "Compare" starts a comparison about this Pokémon: it is the only card, and the
    // base. Whatever the session held before (it survives moving between tools) would
    // otherwise mix into a comparison the user didn't ask for.
    track({ name: "pokemon_added", props: { tool: "compare", source: "box_compare", species: config.species } });
    setEntries([newEntry(config, m.id)]);
    onBaseConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseMemberId, members.data, catalog.data]);

  // A shared link (`/compare?share=<id>`) opens that comparison: like "Compare" from
  // the box, it replaces whatever the session held. The query is dropped once read,
  // so a reload or going back doesn't reopen it over later changes.
  const shareId = shareIdFrom(useSearch());
  const [, navigate] = useLocation();
  const shared = useQuery({
    queryKey: ["comparison-share", shareId],
    queryFn: () => api.getComparisonShare(shareId as string),
    enabled: shareId !== null,
    retry: false,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (!shareId) return;
    if (shared.data) {
      const next = sessionFromShare(shared.data);
      setEntries(next.entries);
      setMap(next.map);
      // The link's cards already come at their target level.
      setComparisonLevel(null);
      setSharerSleep(next.sleep);
      setNotice(null);
      track({ name: "shared_comparison_opened", props: { cards: next.entries.length } });
    } else if (shared.isError) {
      setNotice(t("share.notFound"));
    } else {
      return;
    }
    navigate(ROUTES.compare, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId, shared.data, shared.isError]);

  // The picture needs every card's numbers, and only the current ones: while any card
  // recomputes (a map change, an edit) the picture would mix new settings with old numbers.
  const shareDisabled = productions.some((q) => !q.data || q.isFetching);

  // No cards left: the sharer's sleep note has nothing to compare against.
  useEffect(() => {
    if (entries.length === 0) setSharerSleep(null);
  }, [entries.length]);
  const openShare = () => setModal("share");

  const openAdd = (which: "form" | "box") => {
    setEditIndex(null);
    setModal(which);
  };
  const openEdit = (i: number) => {
    setEditIndex(i);
    setModal("form");
  };
  const removeAt = (i: number) => setEntries((prev) => prev.filter((_, j) => j !== i));

  const saveToBox = (i: number) => {
    const entry = entries[i];
    // Match by stable id, not index: the list can be reordered/edited while
    // this save is in flight, so `i` may no longer point at this entry.
    save(entry, "compare", (memberId) => setEntries((prev) => linkEntryToBox(prev, entry.id, memberId)));
  };

  if (catalog.isLoading) return <Placeholder loading>{t("common.loadingCatalog")}</Placeholder>;
  if (shareId && shared.isLoading) return <Placeholder loading>{t("share.loading")}</Placeholder>;
  if (catalog.isError || !catalog.data)
    return (
      <p className="error" role="alert">
        {t("common.catalogError")}{" "}
        <button type="button" className="btn btn--ghost" onClick={() => catalog.refetch()}>
          {t("common.retry")}
        </button>
      </p>
    );

  return (
    <div className="layout layout--wide">
      <ToolHeader
        title={t("prod.title")}
        notice={notice}
        action={
          entries.length > 0 && (
            <div className="tool-head__action--wide">
              <button type="button" className="btn btn--ghost btn--icon-lead" disabled={shareDisabled} onClick={openShare}>
                <IconShare />
                {t("share.button")}
              </button>
            </div>
          )
        }
      >
        {entries.length > 0 && (
          <ContextBar>
            <ComparisonMapBar
              catalog={catalog.data}
              value={map}
              onChange={setMap}
              onSelectIsland={(name) => track(mapSetEvent("compare", name, catalog.data?.islands ?? []))}
            />
            <ComparisonLevelField
              value={comparisonLevel}
              onChange={(level) => {
                setComparisonLevel(level);
                track(comparisonLevelSetEvent(level));
              }}
            />
          </ContextBar>
        )}
      </ToolHeader>

      {sleepReady && sharerSleep && sleepDiffers(sharerSleep, progress.sleep) && (
        <InfoNotice icon={<IconMoon />} onDismiss={() => setSharerSleep(null)} dismissLabel={t("share.dismissNotice")}>
          {(() => {
            const parts = sleepNoticeParts(sharerSleep, progress.sleep, t);
            return renderNotice(t("share.sleepNotice"), parts.theirs, parts.yours);
          })()}
        </InfoNotice>
      )}

      {/* The pager docks only while the cards are on screen: the deck bounds its sticky. */}
      <div className="swipe-deck">
        {/* Mounted even with no cards, so it sees the first one arrive. */}
        <SwipePager
          track={cardsRef}
          hidden={entries.length === 0}
          label={t("pager.aria")}
          action={
            <button
              type="button"
              className="swipe-pager__action-btn"
              aria-label={t("share.button")}
              disabled={shareDisabled}
              onClick={openShare}
            >
              <IconShare />
            </button>
          }
          items={[
            ...entries.map((e) => {
              const dex = dexOf(e.config.species);
              return {
                key: e.id,
                label: t("pager.show", { name: e.config.species }),
                icon: <span className="swipe-pager__sprites">{dex ? <img src={spriteUrl(dex)} alt="" /> : null}</span>,
              };
            }),
            ...(atMax ? [] : [{ key: "add", label: t("pager.add"), icon: <span aria-hidden="true">+</span> }]),
          ]}
        />

        <div className="prod-cards prod-cards--swipe" ref={cardsRef}>
          {entries.map((e, i) => (
            <ProductionCard
              key={e.id}
              config={e.config}
              catalog={catalog.data}
              production={shownProductions[i] ?? null}
              productionError={(productions[i]?.error as Error | null) ?? null}
              base={i === 0 ? null : baseProduction}
              isBase={i === 0 && entries.length > 1}
              comparing={entries.length > 1}
              berryRole={berryRoleOf(map, expert, berryOf(e.config.species))}
              expert={expert}
              expertSpeed={island?.expert_speed ?? null}
              weeklyBonus={map.weeklyBonus}
              onEdit={() => openEdit(i)}
              onClone={() => cloneAt(i)}
              onRemove={() => removeAt(i)}
              onMakeBase={() => swapEntries(i, 0)}
              onMoveLeft={i > 0 ? () => swapEntries(i, i - 1) : undefined}
              onMoveRight={i < entries.length - 1 ? () => swapEntries(i, i + 1) : undefined}
              onSaveToBox={() => guard(() => saveToBox(i), "save_to_box")}
              cloneDisabled={atMax}
              inBox={e.sourceId !== undefined}
              saveState={statusOf(e.id).state}
              saveError={statusOf(e.id).error ?? null}
            />
          ))}

          {/* The add card lives in the grid while there is room; at 5 it is gone. */}
          {!atMax && (
            <div className="prod-card-cell">
              {/* No toolbar placeholder: the card spans the whole cell, as tall as a card plus its toolbar. */}
              <article className="prod-card prod-card--add">
                {entries.length === 0 ? (
                  <div className="prod-add__hint">
                    <p className="prod-add__lead">{t("prod.emptyLead")}</p>
                    <p className="muted">{t("prod.emptyBody")}</p>
                  </div>
                ) : suggestions.length > 0 ? (
                  <>
                    <div className="prod-add__suggestions">
                      <p className="prod-add__suggestions-label">{t("prod.suggestionsLabel")}</p>
                      {suggestions.map((m) => (
                        <SuggestionRow
                          key={m.id}
                          member={m}
                          dex={speciesByName.get(m.species)?.dex ?? 0}
                          mainSkillName={effectiveSkill(speciesByName.get(m.species)?.main_skill, m.versatile_skill)}
                          natureMeta={natureByName.get(m.nature)}
                          tierBySubSkill={(name) => tierBySubSkill.get(name)}
                          onPick={(picked) => pickMember(picked, "suggestion")}
                        />
                      ))}
                    </div>
                    <hr className="prod-add__sep" />
                  </>
                ) : (
                  <p className="muted prod-add__hint">{t("prod.addHintMore")}</p>
                )}
                <div className="prod-add__actions">
                  <button type="button" className="btn btn--primary" onClick={() => openAdd("form")}>
                    {t("prod.new")}
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={shots.start}>
                    {t("import.button")}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => guard(() => openAdd("box"), "my_pokemon")}
                  >
                    {t("prod.myPokemon")}
                  </button>
                </div>
              </article>
            </div>
          )}
        </div>
      </div>

      {modal === "form" && (
        <Modal
          title={editIndex !== null ? t("team.modalEdit") : t("team.modalAdd")}
          onClose={() => {
            setModal(null);
            setEditIndex(null);
            shots.clear();
          }}
          dirty={formDirty}
        >
          <MemberForm
            catalog={catalog.data}
            onDirtyChange={setFormDirty}
            pending={false}
            error={null}
            submitLabel={editIndex !== null ? t("prod.save") : t("prod.addToComparison")}
            initial={editIndex !== null ? entries[editIndex].config : undefined}
            imported={editIndex === null ? (shots.imported ?? undefined) : undefined}
            onSubmit={upsert}
            footer={
              editIndex === null ? null : entries[editIndex]?.sourceId !== undefined ? (
                <p className="muted">{t("prod.noteEditInBox")}</p>
              ) : (
                <p className="muted">{t("prod.noteEditLocal")}</p>
              )
            }
          />
        </Modal>
      )}

      {shots.dialog}

      {modal === "share" && (
        <ShareDialog
          catalog={catalog.data}
          entries={bakeRaisedLevels(entries, shownProductions)}
          productions={shownProductions}
          map={map}
          island={island}
          sleep={progress.sleep}
          onClose={() => setModal(null)}
        />
      )}

      {modal === "box" && (
        <Modal
          title={t("prod.pickFromBox")}
          onClose={() => {
            setModal(null);
            setEditIndex(null);
          }}
        >
          <BoxPicker
            members={members.data}
            isLoading={members.isLoading}
            isError={members.isError}
            onRetry={() => members.refetch()}
            catalog={catalog.data}
            inComparison={inComparison as Set<string>}
            onPick={pickMember}
          />
        </Modal>
      )}
    </div>
  );
}
