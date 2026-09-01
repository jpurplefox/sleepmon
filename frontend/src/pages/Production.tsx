import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useGate } from "../auth/useGate";
import { BoxPicker } from "../components/BoxPicker";
import { MemberForm } from "../components/MemberForm";
import { Modal } from "../components/Modal";
import { Placeholder } from "../components/Placeholder";
import { ProductionCard } from "../components/ProductionCard";
import { useI18n } from "../i18n";
import { configFromMember, linkEntryToBox, newEntry, type RosterEntry } from "../roster";
import type { Member, MemberInput } from "../types";
import { useSaveToBox } from "../useSaveToBox";

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

  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [modal, setModal] = useState<"form" | "box" | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  // Reordenamiento por arrastre: la card que se arrastra y el destino actual.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Aviso al usuario cuando una acción no se pudo concretar (p. ej. agregar una
  // especie que no está en el catálogo cargado).
  const [notice, setNotice] = useState<string | null>(null);

  // El cálculo de cada card vive en el padre (una query por entry) para poder
  // comparar contra la base (la primera) y mostrar los deltas. La cache de
  // react-query (keyed por config) evita recalcular al reordenar.
  const productions = useQueries({
    queries: entries.map((e) => ({
      queryKey: ["production", e.config],
      queryFn: () =>
        api.computeProduction({
          species: e.config.species,
          level: e.config.level,
          ingredients: e.config.ingredients,
          nature: e.config.nature,
          sub_skills: e.config.sub_skills,
          ribbon: e.config.ribbon,
          skill_level: e.config.skill_level,
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
  const baseProduction = productions[0]?.data ?? null;

  const atMax = entries.length >= MAX_COMPARE;

  // Miembros de la caja que ya están como card (por su id de origen), para no
  // ofrecer agregarlos dos veces sin querer.
  const inComparison = new Set(entries.map((e) => e.sourceId).filter(Boolean));

  // Intercambia dos cards (swap), sin reacomodar las del medio: arrastrar la 1ª a
  // la 3ª posición solo permuta esas dos. "Hacer base" intercambia con la 1ª.
  const swapEntries = (a: number, b: number) =>
    setEntries((prev) => {
      if (a === b || a < 0 || b < 0 || a >= prev.length || b >= prev.length) return prev;
      const next = [...prev];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });

  const onCardDrop = (to: number) => {
    if (dragIndex !== null) swapEntries(dragIndex, to);
    setDragIndex(null);
    setDragOverIndex(null);
  };

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
      <header className="hero">
        <h1>{t("prod.title")}</h1>
        <p className="muted">{t("prod.subtitle")}</p>
        <p className="muted hero__note">{t("prod.assumptions")}</p>
        {notice && (
          <p className="error" role="alert">
            {notice}
          </p>
        )}
      </header>

      <div className="prod-cards">
        {entries.map((e, i) => (
          <ProductionCard
            key={e.id}
            config={e.config}
            catalog={catalog.data}
            production={productions[i]?.data ?? null}
            productionError={(productions[i]?.error as Error | null) ?? null}
            base={i === 0 ? null : baseProduction}
            isBase={i === 0 && entries.length > 1}
            comparing={entries.length > 1}
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
            dragging={dragIndex === i}
            dragOver={dragOverIndex === i && dragIndex !== i}
            onDragStart={() => setDragIndex(i)}
            onDragEnter={() => setDragOverIndex(i)}
            onDrop={() => onCardDrop(i)}
            onDragEnd={() => {
              setDragIndex(null);
              setDragOverIndex(null);
            }}
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
                <p className="muted prod-add__hint">
                  {entries.length === 0
                    ? t("prod.addHintEmpty")
                    : t("prod.addHintMore")}
                </p>
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
