import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { carryIngredients, devolvedSkillLevel, evolvedSkillLevel, ingredientsAfterChange } from "../evolution";
import { useI18n } from "../i18n";
import { unreadAfterChange } from "../screenshotImport";
import type { Catalog, ImportField, ImportedForm, MemberInput } from "../types";
import { useSeedShortcut } from "../useSeedShortcut";
import { VERSATILE, effectiveSkill } from "../versatile";
import { EvolveControl } from "./EvolveControl";
import { FormSummary } from "./FormSummary";
import { IngredientSlots } from "./IngredientSlots";
import { LevelSelector } from "./LevelSelector";
import { NatureSelect } from "./NatureSelect";
import { RibbonSelect } from "./RibbonSelect";
import { SkillLevelSelector } from "./SkillLevelSelector";
import { SpeciesSelect } from "./SpeciesSelect";
import { SubSkillSeedButton } from "./SubSkillSeedButton";
import { SubSkillSelect } from "./SubSkillSelect";
import { UnreadMark } from "./UnreadMark";

interface Props {
  catalog: Catalog;
  onSubmit: (data: MemberInput) => void;
  pending: boolean;
  error: string | null;
  submitLabel?: string;
  // Valores iniciales para editar un Pokémon ya elegido.
  initial?: MemberInput;
  /** Opens pre-filled from a screenshot import; exclusive with `initial`. */
  imported?: ImportedForm;
  // Nota al pie del form, justo antes del botón de submit.
  footer?: ReactNode;
  /** Reports whether the form differs from what it opened with (so leaving can ask). */
  onDirtyChange?: (dirty: boolean) => void;
}

export function MemberForm({
  catalog,
  onSubmit,
  pending,
  error,
  submitLabel,
  initial: editing,
  imported,
  footer,
  onDirtyChange,
}: Props) {
  const { t } = useI18n();
  const initial = imported?.values ?? editing;
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
  const seed = useSeedShortcut(subSkills, setSubSkills);
  // Mew's chosen skill; "" until picked (it then reads as Metronome).
  const [versatileSkill, setVersatileSkill] = useState(initial?.versatile_skill ?? "");

  const [unread, setUnread] = useState<ImportField[]>(imported?.unread ?? []);
  const current: MemberInput = {
    species,
    level,
    nature,
    ingredients,
    sub_skills: subSkills,
    ribbon,
    skill_level: skillLevel,
  };
  // A mark clears when its field changes; the ref starts at the opening values.
  const previous = useRef(current);
  const currentKey = JSON.stringify(current);
  useEffect(() => {
    const before = previous.current;
    previous.current = current;
    setUnread((u) => (u.length ? unreadAfterChange(u, before, current) : u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  const selectedSpecies = useMemo(
    () => catalog.species.find((s) => s.name === species),
    [catalog.species, species],
  );

  // On a species change, keep the kit within the same evolution line, else reset each
  // slot to its first option (see ingredientsAfterChange). The first render keeps the
  // initial ones as they are (edit). The ref holds the applied species (StrictMode-safe).
  const appliedSpecies = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedSpecies) return;
    if (appliedSpecies.current === species) return;
    const from = appliedSpecies.current;
    const isFirst = from === null;
    appliedSpecies.current = species;
    if (isFirst && initial?.species && initial.ingredients?.length) return; // conservar lo inicial
    if (isFirst && imported) {
      // An import without a species: keep each read ingredient the species allows there,
      // and mark the kit unread if any slot had to fall back.
      const read = imported.values.ingredients;
      const kit = carryIngredients(read, selectedSpecies);
      setIngredients(kit);
      // The kit is part of picking the species, not a user edit: don't let it clear marks.
      previous.current = { ...previous.current, ingredients: kit };
      if (kit.some((ing, i) => ing !== read[i])) {
        setUnread((u) => (u.includes("ingredients") ? u : [...u, "ingredients"]));
      }
      return;
    }
    setIngredients((prev) => ingredientsAfterChange(prev, from, selectedSpecies, catalog.species));
  }, [selectedSpecies, species, initial, imported, catalog.species]);

  // El contrato del backend exige exactamente 3 ingredientes (uno por slot). El
  // useEffect que puebla los slots corre tras el paint, así que durante esa
  // ventana ingredients puede tener <3 entradas; bloqueamos el submit hasta que
  // las 3 posiciones estén completas.
  const ingredientsComplete = ingredients.filter(Boolean).length === 3;

  // Al editar un miembro cuya especie no está en el catálogo cargado,
  // selectedSpecies es undefined: el fieldset de Ingredientes no se renderiza y
  // no se puede validar/editar el kit. Bloqueamos el submit y avisamos.
  const speciesUnknown = !!species && !selectedSpecies;

  // Dirty = differs from what the form opened with. The ingredients a species
  // fills in are part of picking that species, so a new form only gets dirty once
  // something is chosen, and an untouched edit stays clean.
  const dirty =
    imported !== undefined ||
    species !== (initial?.species ?? "") ||
    level !== (initial?.level ?? 30) ||
    nature !== (initial?.nature ?? "") ||
    ribbon !== (initial?.ribbon ?? "") ||
    skillLevel !== (initial?.skill_level ?? 1) ||
    versatileSkill !== (initial?.versatile_skill ?? "") ||
    subSkills.filter(Boolean).join("|") !== (initial?.sub_skills ?? []).join("|") ||
    (initial !== undefined && ingredients.join("|") !== initial.ingredients.join("|"));
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const versatile = selectedSpecies?.main_skill === VERSATILE;

  // A stage step changes the species and moves the skill one level (see evolution.ts).
  function evolve(target: string) {
    const skill = catalog.species.find((s) => s.name === target)?.main_skill;
    setSpecies(target);
    setSkillLevel((l) => evolvedSkillLevel(l, skill));
  }

  function devolve() {
    const previous = selectedSpecies?.previous_stage;
    if (!previous) return;
    setSpecies(previous);
    setSkillLevel(devolvedSkillLevel);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const chosen = effectiveSkill(selectedSpecies?.main_skill, versatileSkill);
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
      ...(versatile && chosen ? { versatile_skill: chosen } : {}),
    });
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      {imported && <FormSummary images={imported.images} unread={unread} />}
      <div className="form__row">
        <label>
          <span className="label-row">
            {t("form.species")}
            <UnreadMark unread={unread.includes("species")} />
          </span>
          <SpeciesSelect
            species={catalog.species}
            value={species}
            onChange={setSpecies}
            ariaLabel={t("form.species")}
          />
        </label>

        <label>
          <span className="label-row">
            {t("form.nature")}
            <UnreadMark unread={unread.includes("nature")} />
          </span>
          <NatureSelect
            natures={catalog.natures}
            value={nature}
            onChange={setNature}
            allowNone
            ariaLabel={t("form.nature")}
          />
        </label>
      </div>

      <div className="level-evolve">
        <LevelSelector
          value={level}
          onChange={setLevel}
          labelAddon={<UnreadMark unread={unread.includes("level")} />}
        />
        <EvolveControl
          species={selectedSpecies}
          catalog={catalog.species}
          onEvolve={evolve}
          onBack={devolve}
        />
      </div>

      <fieldset>
        <legend>
          {t("form.ingredients")}
          <UnreadMark unread={unread.includes("ingredients")} />
        </legend>
        <IngredientSlots
          species={selectedSpecies}
          level={level}
          value={ingredients}
          onChange={setIngredients}
        />
      </fieldset>

      <fieldset>
        <legend>
          {t("form.subSkills")}
          <UnreadMark unread={unread.includes("sub_skills")} />
        </legend>
        <div className="subskill-field">
          <SubSkillSelect
            subSkills={catalog.sub_skills}
            value={subSkills}
            level={level}
            onChange={seed.onManualChange}
            highlight={seed.highlight}
            ariaLabel={t("form.subSkills")}
          />
          <SubSkillSeedButton mode={seed.mode} seeds={seed.seeds} onClick={seed.act} />
        </div>
      </fieldset>

      <fieldset>
        <legend>
          {t("form.skillLevel")}
          <UnreadMark unread={unread.includes("skill_level")} />
        </legend>
        <SkillLevelSelector
          value={skillLevel}
          onChange={setSkillLevel}
          mainSkill={selectedSpecies?.main_skill}
          versatileSkills={versatile ? catalog.versatile_skills : undefined}
          versatileSkill={versatileSkill}
          onVersatileChange={setVersatileSkill}
        />
      </fieldset>

      <fieldset>
        <legend>
          {t("form.ribbon")}
          <UnreadMark unread={unread.includes("ribbon")} />
        </legend>
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

      <div className="form__submit">
        <button
          className="btn btn--primary"
          type="submit"
          disabled={pending || !species || speciesUnknown || !ingredientsComplete}
        >
          {pending ? t("form.saving") : label}
        </button>
      </div>
    </form>
  );
}
