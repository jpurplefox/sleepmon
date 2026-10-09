import { useEffect, useRef, useState } from "react";

import { useI18n } from "../i18n";
import { mainSkillIcon } from "../skillIcons";
import { maxSkillLevel, skillDescription } from "../skills";
import { effectiveSkill } from "../versatile";
import { Stepper } from "./Stepper";

interface Props {
  value: number;
  onChange: (level: number) => void;
  // Main skill de la especie elegida (para el nombre, la bajada y el nivel máximo).
  // undefined si todavía no se eligió especie.
  mainSkill?: string;
  // Mew (Versatile): the skills it can carry, the chosen one and its setter. When
  // given, the skill name opens a menu to pick it.
  versatileSkills?: string[];
  versatileSkill?: string;
  onVersatileChange?: (skill: string) => void;
}

function SkillIcon({ skill }: { skill: string }) {
  const icon = mainSkillIcon(skill);
  return (
    <span className="versatile-option__icon">
      {icon.kind === "img" ? (
        <img src={icon.src} alt="" aria-hidden="true" />
      ) : (
        <icon.Component aria-hidden="true" />
      )}
    </span>
  );
}

// Stepper del nivel de la main skill, al estilo del de listones: se avanza /
// retrocede con los botones y el panel muestra el nivel, el nombre de la skill y
// su bajada real del juego (con la cantidad del nivel ya resuelta). El máximo
// depende de la skill (E4E topa en 6; el resto en 7).
export function SkillLevelSelector({
  value,
  onChange,
  mainSkill,
  versatileSkills,
  versatileSkill,
  onVersatileChange,
}: Props) {
  const { t, lang, mainSkill: tMainSkill } = useI18n();
  const max = maxSkillLevel(mainSkill);
  const skill = effectiveSkill(mainSkill, versatileSkill);
  const picking = !!versatileSkills && !!onVersatileChange && skill !== mainSkill;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Si al cambiar de especie el nivel quedó por encima del tope de la nueva skill,
  // lo bajamos al tope (p. ej. de un Crustle en Nv.7 a un Sylveon, que topa en 6).
  useEffect(() => {
    if (value > max) onChange(max);
  }, [value, max, onChange]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const atStart = value <= 1;
  const atEnd = value >= max;

  const go = (delta: number) => {
    const next = value + delta;
    if (next >= 1 && next <= max) onChange(next);
  };

  // Mew's chosen skill tops out at its own maximum, below Versatile's 8.
  const desc = skillDescription(skill, Math.min(value, maxSkillLevel(skill)), lang);

  const name = skill ? tMainSkill(skill) : t("skillSel.pickSpecies");
  const primary = picking ? (
    <button
      type="button"
      className="versatile-trigger"
      onClick={() => setOpen((o) => !o)}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={t("skillSel.versatile")}
    >
      {name}
      <span className="versatile-trigger__caret" aria-hidden="true">
        ▾
      </span>
    </button>
  ) : (
    name
  );

  return (
    <div className="versatile-select" ref={ref}>
      <Stepper
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        disablePrev={atStart}
        disableNext={atEnd}
        prevLabel={t("skillSel.down")}
        nextLabel={t("skillSel.up")}
        leading={
          <span className="stepper__level" title={t("skillSel.title", { value, max })}>
            {value}
          </span>
        }
        primary={primary}
        secondary={desc || undefined}
      />
      {picking && open && (
        <div className="nature-dropdown versatile-dropdown" role="listbox" aria-label={t("skillSel.versatile")}>
          <div className="nature-group__items">
            {versatileSkills.map((s) => (
              <button
                type="button"
                key={s}
                role="option"
                aria-selected={s === skill}
                className={"nature-option" + (s === skill ? " nature-option--selected" : "")}
                onClick={() => {
                  onVersatileChange(s);
                  setOpen(false);
                }}
              >
                <SkillIcon skill={s} />
                <span className="nature-option__name">{tMainSkill(s)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
