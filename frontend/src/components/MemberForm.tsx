import { useEffect, useMemo, useState } from "react";

import { maxSubSkillSlots } from "../constants";
import type { Catalog, MemberInput } from "../types";
import { IngredientSlots } from "./IngredientSlots";
import { LevelSelector } from "./LevelSelector";
import { SpeciesSelect } from "./SpeciesSelect";

interface Props {
  catalog: Catalog;
  onSubmit: (data: MemberInput) => void;
  pending: boolean;
  error: string | null;
}

export function MemberForm({ catalog, onSubmit, pending, error }: Props) {
  const [species, setSpecies] = useState(catalog.species[0]?.name ?? "");
  const [level, setLevel] = useState(30);
  const [nature, setNature] = useState(catalog.natures[0]?.name ?? "");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [subSkills, setSubSkills] = useState<string[]>([]);

  const selectedSpecies = useMemo(
    () => catalog.species.find((s) => s.name === species),
    [catalog.species, species],
  );

  const subSlots = maxSubSkillSlots(level);

  // Al cambiar de especie, default cada slot de ingrediente a su primera opción
  // válida. Se cargan los 3 sin importar el nivel: ya están definidos.
  useEffect(() => {
    if (!selectedSpecies) return;
    setIngredients(selectedSpecies.ingredient_slots.map((opts) => opts[0] ?? ""));
  }, [selectedSpecies]);

  // Recortamos sub skills si bajó el nivel.
  useEffect(() => {
    setSubSkills((prev) => prev.slice(0, subSlots));
  }, [subSlots]);

  function setSubSkill(slot: number, value: string) {
    setSubSkills((prev) => {
      const next = [...prev];
      next[slot] = value;
      return next;
    });
  }

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
          <select value={nature} onChange={(e) => setNature(e.target.value)}>
            {catalog.natures.map((n) => (
              <option key={n.name} value={n.name}>
                {n.name}
                {n.neutral ? " (neutra)" : ` (↑${n.increased} ↓${n.decreased})`}
              </option>
            ))}
          </select>
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
        <legend>Sub skills (hasta {subSlots})</legend>
        <div className="form__row">
          {subSlots === 0 && <p className="muted">Se desbloquean a partir del nivel 10.</p>}
          {Array.from({ length: subSlots }, (_, i) => {
            const taken = new Set(subSkills.filter((_, idx) => idx !== i));
            return (
              <label key={i}>
                Slot {i + 1}
                <select value={subSkills[i] ?? ""} onChange={(e) => setSubSkill(i, e.target.value)}>
                  <option value="">—</option>
                  {catalog.sub_skills
                    .filter((s) => !taken.has(s.name))
                    .map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name} ({s.tier})
                      </option>
                    ))}
                </select>
              </label>
            );
          })}
        </div>
      </fieldset>

      {error && <p className="error">{error}</p>}

      <button className="btn btn--primary" type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Agregar al equipo"}
      </button>
    </form>
  );
}
