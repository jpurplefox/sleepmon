import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useI18n } from "../i18n";
import type { Catalog, MemberInput } from "../types";
import { IngredientSlots } from "./IngredientSlots";
import { LevelSelector } from "./LevelSelector";
import { NatureSelect } from "./NatureSelect";
import { RibbonSelect } from "./RibbonSelect";
import { SkillLevelSelector } from "./SkillLevelSelector";
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
  // Nota al pie del form, justo antes del botón de submit.
  footer?: ReactNode;
}

export function MemberForm({
  catalog,
  onSubmit,
  pending,
  error,
  submitLabel,
  initial,
  footer,
}: Props) {
  const { t } = useI18n();
  const label = submitLabel ?? t("form.addToTeam");
  // La especie arranca vacía (sin preselección): así nadie agrega por error la
  // primera del catálogo creyendo que eligió. El submit queda bloqueado hasta
  // que se elige una. Al editar, viene la del miembro.
  // La naturaleza es opcional siempre: arranca en "Sin naturaleza" salvo que se
  // edite un miembro que ya tenía una.
  const [species, setSpecies] = useState(initial?.species ?? "");
  const [level, setLevel] = useState(initial?.level ?? 30);
  const [nature, setNature] = useState(initial?.nature ?? "");
  const [ingredients, setIngredients] = useState<string[]>(initial?.ingredients ?? []);
  const [subSkills, setSubSkills] = useState<string[]>(initial?.sub_skills ?? []);
  const [ribbon, setRibbon] = useState(initial?.ribbon ?? "");
  const [skillLevel, setSkillLevel] = useState(initial?.skill_level ?? 1);

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

  // El contrato del backend exige exactamente 3 ingredientes (uno por slot). El
  // useEffect que puebla los slots corre tras el paint, así que durante esa
  // ventana ingredients puede tener <3 entradas; bloqueamos el submit hasta que
  // las 3 posiciones estén completas.
  const ingredientsComplete = ingredients.filter(Boolean).length === 3;

  // Al editar un miembro cuya especie no está en el catálogo cargado,
  // selectedSpecies es undefined: el fieldset de Ingredientes no se renderiza y
  // no se puede validar/editar el kit. Bloqueamos el submit y avisamos.
  const speciesUnknown = !!species && !selectedSpecies;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      species,
      level,
      nature,
      // No filtrar: las 3 posiciones viajan tal cual (el contrato exige 3).
      ingredients,
      // Las sub skills sí son opcionales: descartamos los slots vacíos.
      sub_skills: subSkills.filter(Boolean),
      ribbon,
      skill_level: skillLevel,
    });
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form__row">
        <label>
          {t("form.species")}
          <SpeciesSelect
            species={catalog.species}
            value={species}
            onChange={setSpecies}
            ariaLabel={t("form.species")}
          />
        </label>

        <label>
          {t("form.nature")}
          <NatureSelect
            natures={catalog.natures}
            value={nature}
            onChange={setNature}
            allowNone
            ariaLabel={t("form.nature")}
          />
        </label>
      </div>

      <LevelSelector value={level} onChange={setLevel} />

      {selectedSpecies && (
        <fieldset>
          <legend>{t("form.ingredients")}</legend>
          <IngredientSlots
            species={selectedSpecies}
            level={level}
            value={ingredients}
            onChange={setIngredients}
          />
        </fieldset>
      )}

      <fieldset>
        <legend>{t("form.subSkills")}</legend>
        <SubSkillSelect
          subSkills={catalog.sub_skills}
          value={subSkills}
          level={level}
          onChange={setSubSkills}
          ariaLabel={t("form.subSkills")}
        />
      </fieldset>

      <fieldset>
        <legend>{t("form.skillLevel")}</legend>
        <SkillLevelSelector
          value={skillLevel}
          onChange={setSkillLevel}
          mainSkill={selectedSpecies?.main_skill}
        />
      </fieldset>

      <fieldset>
        <legend>{t("form.ribbon")}</legend>
        <RibbonSelect value={ribbon} onChange={setRibbon} />
      </fieldset>

      {speciesUnknown && (
        <p className="error" role="alert">
          {t("form.speciesUnknown", { species })}
        </p>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {footer}

      <button
        className="btn btn--primary"
        type="submit"
        disabled={pending || !species || speciesUnknown || !ingredientsComplete}
      >
        {pending ? t("form.saving") : label}
      </button>
    </form>
  );
}
