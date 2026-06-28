import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { api } from "../api/client";
import { BoxPicker } from "../components/BoxPicker";
import { MemberForm } from "../components/MemberForm";
import { Modal } from "../components/Modal";
import { ProductionCard } from "../components/ProductionCard";
import { useI18n } from "../i18n";
import type { Member, MemberInput } from "../types";

// Tope de la comparación: el máximo del equipo en el juego.
const MAX_COMPARE = 5;

// Una card de comparación, con el origen opcional en la Caja (sourceId) y el
// estado efímero del guardado, así el feedback sigue a la card aunque se quiten
// otras.
type SaveStatus = { state: "idle" | "saving" | "saved" | "error"; error?: string | null };

type CompareEntry = {
  uid: number; // id local estable para seguir la card aunque se reordenen otras
  config: MemberInput;
  sourceId?: string;
  save?: SaveStatus;
};

interface ProductionProps {
  // Si viene seteado (desde "Comparar" en la Caja), se agrega ese Pokémon como
  // base (primera card) al abrir Comparación; luego se limpia con onBaseConsumed.
  baseMemberId?: string | null;
  onBaseConsumed?: () => void;
}

export function Production({ baseMemberId, onBaseConsumed }: ProductionProps = {}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const members = useQuery({ queryKey: ["members"], queryFn: api.listMembers });

  const [entries, setEntries] = useState<CompareEntry[]>([]);
  const [modal, setModal] = useState<"form" | "box" | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  // Reordenamiento por arrastre: la card que se arrastra y el destino actual.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // Aviso al usuario cuando una acción no se pudo concretar (p. ej. agregar una
  // especie que no está en el catálogo cargado).
  const [notice, setNotice] = useState<string | null>(null);
  const nextUid = useRef(0);

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

  const speciesList = catalog.data?.species ?? [];

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

  const makeEntry = (config: MemberInput, sourceId?: string): CompareEntry => ({
    uid: nextUid.current++,
    config,
    sourceId,
  });

  // Inserta una card nueva (sin origen) o reemplaza la config de la que estábamos
  // editando, manteniendo su sourceId. Cierra el modal.
  const upsert = (config: MemberInput) => {
    setEntries((prev) =>
      editIndex === null
        ? prev.length >= MAX_COMPARE
          ? prev
          : [...prev, makeEntry(config)]
        : // Al re-editar limpiamos un error de guardado previo: ese feedback ya
          // no aplica a la config nueva.
          prev.map((e, i) => (i === editIndex ? { ...e, config, save: { state: "idle" } } : e)),
    );
    setModal(null);
    setEditIndex(null);
  };

  // Duplica una card como una variante nueva: el clon NO hereda el origen.
  const cloneAt = (i: number) =>
    setEntries((prev) =>
      prev.length >= MAX_COMPARE ? prev : [...prev, makeEntry(prev[i].config)],
    );

  const pickMember = (m: Member) => {
    // Si la especie del miembro no está en el catálogo cargado, sus slots de
    // ingrediente quedarían vacíos y la card se armaría con ingredients: [] →
    // 400 al calcular/guardar y sprite en dex 0. Mejor no agregarla y avisar.
    const species = speciesList.find((s) => s.name === m.species);
    if (!species || species.ingredient_slots.length === 0) {
      setNotice(t("prod.speciesNotInCatalog", { species: m.species }));
      setModal(null);
      setEditIndex(null);
      return;
    }
    const slots = species.ingredient_slots;
    const config: MemberInput = {
      species: m.species,
      level: m.level,
      nature: m.nature,
      ingredients: slots.map((opts, i) => m.ingredients[i] ?? opts[0] ?? ""),
      sub_skills: m.sub_skills,
      ribbon: m.ribbon,
      skill_level: m.skill_level,
    };
    setNotice(null);
    setEntries((prev) => (prev.length >= MAX_COMPARE ? prev : [...prev, makeEntry(config, m.id)]));
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
    const species = catalog.data.species.find((s) => s.name === m.species);
    if (!species || species.ingredient_slots.length === 0) {
      setNotice(t("prod.speciesNotInCatalog", { species: m.species }));
      onBaseConsumed?.();
      return;
    }
    const slots = species.ingredient_slots;
    const config: MemberInput = {
      species: m.species,
      level: m.level,
      nature: m.nature,
      ingredients: slots.map((opts, i) => m.ingredients[i] ?? opts[0] ?? ""),
      sub_skills: m.sub_skills,
      ribbon: m.ribbon,
      skill_level: m.skill_level,
    };
    setNotice(null);
    setEntries((prev) => {
      if (prev.some((e) => e.sourceId === m.id) || prev.length >= MAX_COMPARE) return prev;
      return [makeEntry(config, m.id), ...prev]; // como base
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

  // Mutación de guardado a la Caja. Identificamos la card por su uid estable (no
  // por referencia ni índice), así el feedback sigue a la card correcta aunque el
  // propio guardado reemplace el objeto del entry o se quiten otras.
  const setSave = (uid: number, save: SaveStatus, sourceId?: string) =>
    setEntries((prev) =>
      prev.map((e) =>
        e.uid === uid ? { ...e, save, ...(sourceId !== undefined ? { sourceId } : {}) } : e,
      ),
    );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["members"] });
    qc.invalidateQueries({ queryKey: ["distributions"] });
  };

  const save = useMutation({
    mutationFn: (entry: CompareEntry) =>
      entry.sourceId
        ? api.updateMember(entry.sourceId, entry.config)
        : api.createMember(entry.config),
    onMutate: (entry) => setSave(entry.uid, { state: "saving" }),
    onSuccess: (member, entry) => {
      // Una card nueva pasa a estar "en la caja" con el id recién creado.
      setSave(entry.uid, { state: "saved" }, entry.sourceId ?? member.id);
      invalidate();
      // El "Guardado" es feedback de una acción puntual: se desvanece a idle a
      // los ~2.5s, salvo que la card haya cambiado de estado mientras tanto.
      window.setTimeout(() => {
        setEntries((prev) =>
          prev.map((e) =>
            e.uid === entry.uid && e.save?.state === "saved" ? { ...e, save: { state: "idle" } } : e,
          ),
        );
      }, 2500);
    },
    onError: (err: Error, entry) => setSave(entry.uid, { state: "error", error: err.message }),
  });

  const saveToBox = (i: number) => save.mutate(entries[i]);

  if (catalog.isLoading) return <p className="muted">{t("common.loadingCatalog")}</p>;
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
            key={e.uid}
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
            onSaveToBox={() => saveToBox(i)}
            cloneDisabled={atMax}
            inBox={e.sourceId !== undefined}
            saveState={e.save?.state ?? "idle"}
            saveError={e.save?.error ?? null}
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
                  <button type="button" className="btn btn--ghost" onClick={() => openAdd("box")}>
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
