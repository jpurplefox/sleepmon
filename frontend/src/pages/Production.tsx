import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../api/client";
import { MemberForm } from "../components/MemberForm";
import { Modal } from "../components/Modal";
import { ProductionCard } from "../components/ProductionCard";
import { spriteUrl } from "../sprites";
import type { Member, MemberInput } from "../types";

export function Production() {
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const members = useQuery({ queryKey: ["members"], queryFn: api.listMembers });

  const [configs, setConfigs] = useState<MemberInput[]>([]);
  const [modal, setModal] = useState<"form" | "box" | null>(null);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const speciesList = catalog.data?.species ?? [];

  // Inserta (o reemplaza si estábamos editando) y cierra el modal.
  const upsert = (config: MemberInput) => {
    setConfigs((prev) =>
      editIndex === null
        ? [...prev, config]
        : prev.map((c, i) => (i === editIndex ? config : c)),
    );
    setModal(null);
    setEditIndex(null);
  };

  const pickMember = (m: Member) => {
    const slots = speciesList.find((s) => s.name === m.species)?.ingredient_slots ?? [];
    upsert({
      species: m.species,
      level: m.level,
      nature: m.nature,
      ingredients: slots.map((opts, i) => m.ingredients[i] ?? opts[0] ?? ""),
      sub_skills: m.sub_skills,
    });
  };

  const openAdd = (which: "form" | "box") => {
    setEditIndex(null);
    setModal(which);
  };
  const openEdit = (i: number) => {
    setEditIndex(i);
    setModal("form");
  };
  const removeAt = (i: number) => setConfigs((prev) => prev.filter((_, j) => j !== i));

  if (catalog.isLoading) return <p className="muted">Cargando catálogo…</p>;
  if (catalog.isError || !catalog.data)
    return <p className="error">No se pudo cargar el catálogo. ¿Está el backend en :8000?</p>;

  return (
    <div className="layout">
      <header className="hero">
        <h1>Comparación</h1>
        <p className="muted">
          Estimá la producción de un día (15.5h de día + 8.5h de noche) con el bonus de energía
          máxima. Agregá Pokémon —de tu caja o nuevos— y comparalos lado a lado.
        </p>
      </header>

      <section className="prod-source">
        <button type="button" className="btn btn--primary" onClick={() => openAdd("form")}>
          + Nuevo
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => openAdd("box")}>
          + Caja
        </button>
      </section>

      {configs.length === 0 ? (
        <p className="muted">
          Usá los botones de arriba para agregar un Pokémon —desde tu caja o configurando uno
          nuevo— y comparar su producción lado a lado.
        </p>
      ) : (
        <div className="prod-cards">
          {configs.map((config, i) => (
            <ProductionCard
              key={i}
              config={config}
              catalog={catalog.data}
              onEdit={() => openEdit(i)}
              onRemove={() => removeAt(i)}
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
            initial={editIndex !== null ? configs[editIndex] : undefined}
            natureOptional
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
