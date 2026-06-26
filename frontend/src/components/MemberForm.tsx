import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { Catalog, MemberInput } from "../types";
import { IngredientSlots } from "./IngredientSlots";
import { LevelSelector } from "./LevelSelector";
import { NatureSelect } from "./NatureSelect";
import { SpeciesSelect } from "./SpeciesSelect";
import { SubSkillSelect } from "./SubSkillSelect";

interface Props {
  catalog: Catalog;
  onSubmit: (data: MemberInput) => void;
  pending: boolean;
  error: string | null;
  submitLabel?: string;
  // Valores iniciales para editar un Pokémon ya elegido.
  initial?: MemberInput;
  // Permite "Sin naturaleza" y arranca sin ella (comparador de producción).
  natureOptional?: boolean;
  // Nota al pie del form, justo antes del botón de submit.
  footer?: ReactNode;
}

export function MemberForm({
  catalog,
  onSubmit,
  pending,
  error,
  submitLabel = "Agregar al equipo",
  initial,
  natureOptional,
  footer,
}: Props) {
  // Sin naturaleza por defecto en el comparador; en la caja, la primera del catálogo.
  const defaultNature = natureOptional ? "" : catalog.natures[0]?.name ?? "";
  const [species, setSpecies] = useState(initial?.species ?? catalog.species[0]?.name ?? "");
  const [level, setLevel] = useState(initial?.level ?? 30);
  const [nature, setNature] = useState(initial?.nature ?? defaultNature);
  const [ingredients, setIngredients] = useState<string[]>(initial?.ingredients ?? []);
  const [subSkills, setSubSkills] = useState<string[]>(initial?.sub_skills ?? []);

  const selectedSpecies = useMemo(
    () => catalog.species.find((s) => s.name === species),
    [catalog.species, species],
  );

  // Al cambiar de especie, default cada slot de ingrediente a su primera opción
  // válida. En el primer render conservamos los ingredientes iniciales (edición).
  // Usamos un ref con la especie ya aplicada (robusto al doble efecto de StrictMode).
  const appliedSpecies = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedSpecies) return;
    if (appliedSpecies.current === species) return;
    const isFirst = appliedSpecies.current === null;
    appliedSpecies.current = species;
    if (isFirst && initial?.ingredients?.length) return; // conservar lo inicial
    setIngredients(selectedSpecies.ingredient_slots.map((opts) => opts[0] ?? ""));
  }, [selectedSpecies, species, initial]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      species,
      level,
      nature,
      ingredients: ingredients.filter(Boolean),
      sub_skills: subSkills.filter(Boolean),
    });
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form__row">
        <label>
          Especie
          <SpeciesSelect species={catalog.species} value={species} onChange={setSpecies} />
        </label>

        <label>
          Naturaleza
          <NatureSelect
            natures={catalog.natures}
            value={nature}
            onChange={setNature}
            allowNone={natureOptional}
          />
        </label>
      </div>

      <LevelSelector value={level} onChange={setLevel} />

      <fieldset>
        <legend>Ingredientes</legend>
        <IngredientSlots
          species={selectedSpecies}
          level={level}
          value={ingredients}
          onChange={setIngredients}
        />
      </fieldset>

      <fieldset>
        <legend>Sub skills</legend>
        <SubSkillSelect
          subSkills={catalog.sub_skills}
          value={subSkills}
          level={level}
          onChange={setSubSkills}
        />
      </fieldset>

      {error && <p className="error">{error}</p>}

      {footer}

      <button className="btn btn--primary" type="submit" disabled={pending}>
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
