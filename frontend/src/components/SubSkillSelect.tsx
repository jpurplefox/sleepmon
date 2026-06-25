import { useEffect, useRef, useState } from "react";

import { SUB_SKILL_UNLOCK_LEVELS } from "../constants";
import { subSkillIcon } from "../subskills";
import type { SubSkill } from "../types";

const MAX_SUB_SKILLS = 5;

// Grupos por familia, en el orden pedido. "Otros" = los que no tienen variantes S/M/L.
const FAMILIES = [
  { title: "Helping Speed", prefix: "Helping Speed " },
  { title: "Inventario", prefix: "Inventory Up " },
  { title: "Skill Level Up", prefix: "Skill Level Up " },
  { title: "Ingrediente", prefix: "Ingredient Finder " },
  { title: "Skill Trigger", prefix: "Skill Trigger " },
];

const TIER_CLASS: Record<string, string> = { Gold: "gold", Blue: "blue", Regular: "regular" };

interface Props {
  subSkills: SubSkill[];
  value: string[];
  level: number;
  onChange: (next: string[]) => void;
}

export function SubSkillSelect({ subSkills, value, level, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const tierOf = (name: string) => subSkills.find((s) => s.name === name)?.tier ?? "Regular";

  // Primer click: al primer slot libre (append). Re-click: limpia ese slot.
  const toggle = (name: string) => {
    if (value.includes(name)) onChange(value.filter((s) => s !== name));
    else if (value.length < MAX_SUB_SKILLS) onChange([...value, name]);
  };

  const used = new Set<string>();
  const familyGroups = FAMILIES.map((f) => {
    const items = subSkills.filter((s) => s.name.startsWith(f.prefix));
    items.forEach((s) => used.add(s.name));
    return { title: f.title, items };
  });
  const groups = [
    { title: "Otros", items: subSkills.filter((s) => !used.has(s.name)) },
    ...familyGroups,
  ];

  return (
    <div className="subskill-select" ref={ref}>
      <button
        type="button"
        className="subskill-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <div className="subskill-slots">
          {Array.from({ length: MAX_SUB_SKILLS }, (_, i) => {
            const name = value[i];
            const unlock = SUB_SKILL_UNLOCK_LEVELS[i];
            const locked = level < unlock;
            const tier = name ? TIER_CLASS[tierOf(name)] : "empty";
            return (
              <span
                key={i}
                className={`ss-icon ss-icon--${tier}` + (locked ? " is-locked" : "")}
                title={name ?? `Slot de nivel ${unlock}`}
              >
                {name && <img src={subSkillIcon(name)} alt={name} />}
                <span className="ss-icon__lv">{unlock}</span>
              </span>
            );
          })}
        </div>
        <span className="subskill-trigger__hint">{value.length}/5 · elegir</span>
      </button>

      {open && (
        <div className="subskill-dropdown" role="dialog" aria-label="Elegir sub skills">
          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.title} className="subskill-group">
                <div className="subskill-group__title">{g.title}</div>
                <div className="subskill-group__items">
                  {g.items.map((s) => {
                    const idx = value.indexOf(s.name);
                    const selected = idx !== -1;
                    const disabled = !selected && value.length >= MAX_SUB_SKILLS;
                    return (
                      <button
                        type="button"
                        key={s.name}
                        className={
                          "subskill-option" + (selected ? " subskill-option--selected" : "")
                        }
                        onClick={() => toggle(s.name)}
                        disabled={disabled}
                        aria-pressed={selected}
                      >
                        <span className={`ss-icon ss-icon--${TIER_CLASS[s.tier]}`}>
                          <img src={subSkillIcon(s.name)} alt="" />
                          {selected && (
                            <span className="ss-icon__lv">{SUB_SKILL_UNLOCK_LEVELS[idx]}</span>
                          )}
                        </span>
                        <span>{s.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
