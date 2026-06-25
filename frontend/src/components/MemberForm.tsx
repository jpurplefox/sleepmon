import { useEffect, useMemo, useState } from "react";

import { maxIngredientSlots, maxSubSkillSlots } from "../constants";
import type { Catalog, MemberInput } from "../types";
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
  const [nickname, setNickname] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [subSkills, setSubSkills] = useState<string[]>([]);

  const selectedSpecies = useMemo(
    () => catalog.species.find((s) => s.name === species),
    [catalog.species, species],
  );

  const ingSlots = maxIngredientSlots(level);
  const subSlots = maxSubSkillSlots(level);

  // Al cambiar especie o cantidad de slots, reseteamos los ingredientes a la
  // primera opción válida de cada slot.
  useEffect(() => {
    if (!selectedSpecies) return;
    setIngredients(
      Array.from({ length: ingSlots }, (_, i) => selectedSpecies.ingredient_slots[i]?.[0] ?? ""),
    );
  }, [selectedSpecies, ingSlots]);

  // Recortamos sub skills si bajó el nivel.
  useEffect(() => {
    setSubSkills((prev) => prev.slice(0, subSlots));
  }, [subSlots]);

  function setIngredient(slot: number, value: string) {
    setIngredients((prev) => prev.map((v, i) => (i === slot ? value : v)));
  }

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
      nickname: nickname.trim() || null,
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

      <div className="form__row">
        <label>
          Apodo (opcional)
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </label>
      </div>

      <fieldset>
        <legend>Ingredientes ({ingSlots} slot{ingSlots !== 1 ? "s" : ""})</legend>
        <div className="form__row">
          {Array.from({ length: ingSlots }, (_, i) => (
            <label key={i}>
              Slot {i + 1}
              <select value={ingredients[i] ?? ""} onChange={(e) => setIngredient(i, e.target.value)}>
                {(selectedSpecies?.ingredient_slots[i] ?? []).map((ing) => (
                  <option key={ing} value={ing}>
                    {ing}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
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
