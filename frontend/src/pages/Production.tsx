import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { api } from "../api/client";
import { MemberForm } from "../components/MemberForm";
import { Modal } from "../components/Modal";
import { ProductionCard } from "../components/ProductionCard";
import { spriteUrl } from "../sprites";
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

export function Production() {
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const members = useQuery({ queryKey: ["members"], queryFn: api.listMembers });

  const [entries, setEntries] = useState<CompareEntry[]>([]);
  const [modal, setModal] = useState<"form" | "box" | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  // Reordenamiento por arrastre: la card que se arrastra y el destino actual.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
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
        }),
    })),
  });
  const baseProduction = productions[0]?.data ?? null;

  const speciesList = catalog.data?.species ?? [];

  const atMax = entries.length >= MAX_COMPARE;

  // Mueve una card a otra posición (reordenar arrastrando). Cambiar la primera
  // card cambia la base de la comparación.
  const moveEntry = (from: number, to: number) =>
    setEntries((prev) => {
      if (from === to || from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const onCardDrop = (to: number) => {
    if (dragIndex !== null) moveEntry(dragIndex, to);
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
        : prev.map((e, i) => (i === editIndex ? { ...e, config } : e)),
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
    const slots = speciesList.find((s) => s.name === m.species)?.ingredient_slots ?? [];
    const config: MemberInput = {
      species: m.species,
      level: m.level,
      nature: m.nature,
      ingredients: slots.map((opts, i) => m.ingredients[i] ?? opts[0] ?? ""),
      sub_skills: m.sub_skills,
      ribbon: m.ribbon,
    };
    setEntries((prev) => (prev.length >= MAX_COMPARE ? prev : [...prev, makeEntry(config, m.id)]));
    setModal(null);
    setEditIndex(null);
  };

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
    },
    onError: (err: Error, entry) => setSave(entry.uid, { state: "error", error: err.message }),
  });

  const saveToBox = (i: number) => save.mutate(entries[i]);

  if (catalog.isLoading) return <p className="muted">Cargando catálogo…</p>;
  if (catalog.isError || !catalog.data)
    return <p className="error">No se pudo cargar el catálogo. ¿Está el backend en :8000?</p>;

  return (
    <div className="layout">
      <header className="hero">
        <h1>Comparación</h1>
        <p className="muted">
          Agregá Pokémon —de tu caja o nuevos— y compará su producción lado a lado. La primera card
          es la base: el resto muestra la diferencia contra ella. Arrastrá las cards para elegir otra
          base. Los cálculos asumen un día de 15.5h despierto + 8.5h de sueño con energía máxima.
        </p>
      </header>

      <section className="prod-source">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => openAdd("form")}
          disabled={atMax}
        >
          + Nuevo
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => openAdd("box")}
          disabled={atMax}
        >
          + Mis Pokémon
        </button>
      </section>

      {atMax && (
        <p className="muted">
          Ya hay 5 Pokémon: es el máximo del equipo en el juego. Quitá uno para agregar otro.
        </p>
      )}

      {entries.length === 0 ? (
        <p className="muted">
          Usá los botones de arriba para agregar un Pokémon —desde tu caja o configurando uno
          nuevo— y comparar su producción lado a lado.
        </p>
      ) : (
        <div className="prod-cards">
          {entries.map((e, i) => (
            <ProductionCard
              key={e.uid}
              config={e.config}
              catalog={catalog.data}
              production={productions[i]?.data ?? null}
              productionError={(productions[i]?.error as Error | null) ?? null}
              base={i === 0 ? null : baseProduction}
              isBase={i === 0}
              onEdit={() => openEdit(i)}
              onClone={() => cloneAt(i)}
              onRemove={() => removeAt(i)}
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
        </div>
      )}

      {modal === "form" && (
        <Modal
          title={editIndex !== null ? "Editar Pokémon" : "Agregar Pokémon"}
          onClose={() => {
            setModal(null);
            setEditIndex(null);
          }}
        >
          <MemberForm
            catalog={catalog.data}
            pending={false}
            error={null}
            submitLabel={editIndex !== null ? "Guardar" : "Agregar a la comparación"}
            initial={editIndex !== null ? entries[editIndex].config : undefined}
            onSubmit={upsert}
            footer={
              editIndex === null ? (
                <p className="muted">No se guarda en tu caja.</p>
              ) : (
                <p className="muted">Los cambios son solo para la comparación.</p>
              )
            }
          />
        </Modal>
      )}

      {modal === "box" && (
        <Modal
          title="Elegí un Pokémon de tu caja"
          onClose={() => {
            setModal(null);
            setEditIndex(null);
          }}
        >
          {members.isLoading ? (
            <p className="muted">Cargando caja…</p>
          ) : members.isError ? (
            <p className="error">No se pudo cargar la caja. Reintentá.</p>
          ) : members.data && members.data.length > 0 ? (
            <ul className="prod-box-list">
              {members.data.map((m) => (
                <li key={m.id}>
                  <button type="button" className="prod-box-item" onClick={() => pickMember(m)}>
                    <img
                      className="sprite"
                      src={spriteUrl(speciesList.find((s) => s.name === m.species)?.dex ?? 0)}
                      alt=""
                      loading="lazy"
                    />
                    <span className="prod-box-item__name">{m.species}</span>
                    <span className="muted">Nv. {m.level}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">La caja está vacía. Agregá Pokémon en la pestaña Equipo.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
