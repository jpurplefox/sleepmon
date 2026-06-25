import { useEffect, useRef, useState } from "react";

import { subSkillIcon } from "../subskills";
import type { SubSkill } from "../types";

const TIER_ORDER = ["Gold", "Blue", "Regular"] as const;
const MAX_SUB_SKILLS = 5;

interface Props {
  subSkills: SubSkill[];
  value: string[];
  onChange: (next: string[]) => void;
}

export function SubSkillSelect({ subSkills, value, onChange }: Props) {
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

  // Primer click: al primer slot libre (append). Re-click: limpia ese slot.
  const toggle = (name: string) => {
    if (value.includes(name)) {
      onChange(value.filter((s) => s !== name));
    } else if (value.length < MAX_SUB_SKILLS) {
      onChange([...value, name]);
    }
  };

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
            return (
              <span
                key={i}
                className={"subskill-slot" + (name ? "" : " subskill-slot--empty")}
                title={name ?? "Vacío"}
              >
                {name && (
                  <img className="subskill-slot__icon" src={subSkillIcon(name)} alt={name} />
                )}
              </span>
            );
          })}
        </div>
        <span className="subskill-trigger__hint">{value.length}/5 · elegir</span>
      </button>

      {open && (
        <div className="subskill-dropdown" role="dialog" aria-label="Elegir sub skills">
          {TIER_ORDER.map((tier) => {
            const items = subSkills.filter((s) => s.tier === tier);
            if (items.length === 0) return null;
            return (
              <div key={tier} className={`subskill-group subskill-group--${tier.toLowerCase()}`}>
                <div className="subskill-group__title">{tier}</div>
                <div className="subskill-group__items">
                  {items.map((s) => {
                    const selected = value.includes(s.name);
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
                        <img className="subskill-option__icon" src={subSkillIcon(s.name)} alt="" />
                        <span>{s.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
