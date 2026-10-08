import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useGate } from "../auth/useGate";
import { BoxPicker } from "../components/BoxPicker";
import { ComparisonMapBar } from "../components/ComparisonMapBar";
import { MemberForm } from "../components/MemberForm";
import { Modal } from "../components/Modal";
import { Placeholder } from "../components/Placeholder";
import { ProductionCard } from "../components/ProductionCard";
import { SwipePager } from "../components/SwipePager";
import { ContextBar, ToolHeader } from "../components/ToolHeader";
import { NEUTRAL_MAP, berryRoleOf, mapRequestFields, type ComparisonMap } from "../comparisonMap";
import { useI18n } from "../i18n";
import { configFromMember, linkEntryToBox, newEntry, type RosterEntry } from "../roster";
import { spriteUrl } from "../sprites";
import type { Member, MemberInput } from "../types";
import { useSaveToBox } from "../useSaveToBox";
import { useStickyData } from "../useStickyData";
import { useProgress } from "../useProgress";

// Tope de la comparación: el máximo del equipo en el juego.
const MAX_COMPARE = 5;

interface ProductionProps {
  // Si viene seteado (desde "Comparar" en la Caja), se agrega ese Pokémon como
  // base (primera card) al abrir Comparación; luego se limpia con onBaseConsumed.
  baseMemberId?: string | null;
  onBaseConsumed?: () => void;
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

  const [entries, setEntries] = useState<RosterEntry[]>([]);
  // The map terms apply to EVERY card, the base included. Not persisted.
  const [map, setMap] = useState<ComparisonMap>(NEUTRAL_MAP);
  const island = catalog.data?.islands.find((i) => i.name === map.island && i.expert) ?? null;
  const expert = island !== null;
  const mapFields = mapRequestFields(map, expert);
  const berryOf = (species: string) => catalog.data?.species.find((s) => s.name === species)?.berry ?? "";
  const [modal, setModal] = useState<"form" | "box" | null>(null);
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
      queryKey: ["production", e.config, mapFields, progress.sleep],
      queryFn: () =>
        api.computeProduction({
          species: e.config.species,
          level: e.config.level,
          ingredients: e.config.ingredients,
          nature: e.config.nature,
          sub_skills: e.config.sub_skills,
          ribbon: e.config.ribbon,
          skill_level: e.config.skill_level,
          ...mapFields,
          sleep: progress.sleep,
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
  const inComparison = new Set(entries.map((e) => e.sourceId).filter(Boolean));

  // Swaps two cards without shifting the ones between: ‹ › swap neighbours,
  // "Make base" swaps with the first.
  const swapEntries = (a: number, b: number) =>
    setEntries((prev) => {
      if (a === b || a < 0 || b < 0 || a >= prev.length || b >= prev.length) return prev;
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });

  // Inserta una card nueva (sin origen) o reemplaza la config de la que estábamos
  // editando, manteniendo su sourceId. Cierra el modal.
  const upsert = (config: MemberInput) => {
    // Editing replaces the config but not the id, so a stale save status
    // (saved or errored) would otherwise survive describing a config that
    // was never submitted.
    if (editIndex !== null) reset(entries[editIndex].id);
    setEntries((prev) =>
      editIndex === null
        ? prev.length >= MAX_COMPARE
          ? prev
          : [...prev, newEntry(config)]
        : prev.map((e, i) => (i === editIndex ? { ...e, config } : e)),
    );
    setModal(null);
    setEditIndex(null);
  };

  // Duplica una card como una variante nueva: el clon NO hereda el origen.
  const cloneAt = (i: number) =>
    setEntries((prev) =>
      prev.length >= MAX_COMPARE ? prev : [...prev, newEntry(prev[i].config)],
    );

  const pickMember = (m: Member) => {
    if (!catalog.data) return; // BoxPicker only renders once the catalog is loaded
    const config = configFromMember(catalog.data, m);
    if (!config) {
      setNotice(t("prod.speciesNotInCatalog", { species: m.species }));
      setModal(null);
      setEditIndex(null);
      return;
    }
    setNotice(null);
    setEntries((prev) => (prev.length >= MAX_COMPARE ? prev : [...prev, newEntry(config, m.id)]));
    setModal(null);
    setEditIndex(null);
  };

  // "Comparar" desde la Caja: agrega el Pokémon indicado como base (primera card).
  useEffect(() => {
    if (!baseMemberId || !members.data || !catalog.data) return;
    const m = members.data.find((x) => x.id === baseMemberId);
    if (!m) {
      onBaseConsumed?.();
      return;
    }
    const config = configFromMember(catalog.data, m);
    if (!config) {
      setNotice(t("prod.speciesNotInCatalog", { species: m.species }));
      onBaseConsumed?.();
      return;
    }
    setNotice(null);
    setEntries((prev) => {
      if (prev.some((e) => e.sourceId === m.id) || prev.length >= MAX_COMPARE) return prev;
      return [newEntry(config, m.id), ...prev]; // como base
    });
    onBaseConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseMemberId, members.data, catalog.data]);

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
    save(entry, (memberId) => setEntries((prev) => linkEntryToBox(prev, entry.id, memberId)));
  };

  if (catalog.isLoading) return <Placeholder loading>{t("common.loadingCatalog")}</Placeholder>;
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
      <ToolHeader title={t("prod.title")} notice={notice}>
        {entries.length > 0 && (
          <ContextBar>
            <ComparisonMapBar catalog={catalog.data} value={map} onChange={setMap} />
          </ContextBar>
        )}
      </ToolHeader>

      {/* The pager docks only while the cards are on screen: the deck bounds its sticky. */}
      <div className="swipe-deck">
        {/* Mounted even with no cards, so it sees the first one arrive. */}
        <SwipePager
          track={cardsRef}
          hidden={entries.length === 0}
          label={t("pager.aria")}
          items={[
            ...entries.map((e) => {
              const dex = dexOf(e.config.species);
              return {
                key: e.id,
                label: t("pager.show", { name: e.config.species }),
                icon: <span className="swipe-pager__sprites">{dex ? <img src={spriteUrl(dex)} alt="" /> : null}</span>,
              };
            }),
            { key: "add", label: t("pager.add"), icon: <span aria-hidden="true">+</span> },
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
              onSaveToBox={() => guard(() => saveToBox(i))}
              cloneDisabled={atMax}
              inBox={e.sourceId !== undefined}
              saveState={statusOf(e.id).state}
              saveError={statusOf(e.id).error ?? null}
            />
          ))}

          {/* El slot de "agregar" vive siempre en la grilla: cuando se llega al
              tope muestra el límite ahí mismo, donde el usuario busca el botón, en
              vez de un párrafo suelto arriba. */}
          <div className="prod-card-cell">
            {/* Placeholder de la barra de acciones: reserva su alto para que el
                cuerpo de esta card quede alineado con las demás. */}
            <div className="prod-card__toolbar prod-card__toolbar--empty" aria-hidden="true" />
            <article className="prod-card prod-card--add">
              {atMax ? (
                <p className="muted prod-add__hint">{t("prod.atMax")}</p>
              ) : (
                <>
                  {entries.length === 0 ? (
                    <div className="prod-add__hint">
                      <p className="prod-add__lead">{t("prod.emptyLead")}</p>
                      <p className="muted">{t("prod.emptyBody")}</p>
                    </div>
                  ) : (
                    <p className="muted prod-add__hint">{t("prod.addHintMore")}</p>
                  )}
                  <div className="prod-add__actions">
                    <button type="button" className="btn btn--primary" onClick={() => openAdd("form")}>
                      {t("prod.new")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => guard(() => openAdd("box"))}
                    >
                      {t("prod.myPokemon")}
                    </button>
                  </div>
                </>
              )}
            </article>
          </div>
        </div>
      </div>

      {modal === "form" && (
        <Modal
          title={editIndex !== null ? t("team.modalEdit") : t("team.modalAdd")}
          onClose={() => {
            setModal(null);
            setEditIndex(null);
          }}
        >
          <MemberForm
            catalog={catalog.data}
            pending={false}
            error={null}
            submitLabel={editIndex !== null ? t("prod.save") : t("prod.addToComparison")}
            initial={editIndex !== null ? entries[editIndex].config : undefined}
            onSubmit={upsert}
            footer={
              editIndex === null ? (
                <p className="muted">{t("prod.noteNew")}</p>
              ) : entries[editIndex]?.sourceId !== undefined ? (
                <p className="muted">{t("prod.noteEditInBox")}</p>
              ) : (
                <p className="muted">{t("prod.noteEditLocal")}</p>
              )
            }
          />
        </Modal>
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
