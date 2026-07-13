import { useEffect, useRef, useState } from "react";

import { maxSubSkillSlots, SUB_SKILL_UNLOCK_LEVELS } from "../constants";
import { useI18n } from "../i18n";
import { subSkillIcon } from "../subskills";
import type { SubSkill } from "../types";
import { Tooltip } from "./Tooltip";

const MAX_SUB_SKILLS = 5;

// Grupos por familia, en el orden pedido. "Otros" = los que no tienen variantes S/M/L.
// `labelKey` es la clave i18n que se traduce al renderizar el encabezado del grupo.
const FAMILIES = [
  { labelKey: "subSel.family.helpingSpeed", prefix: "Helping Speed " },
  { labelKey: "subSel.family.inventory", prefix: "Inventory Up " },
  { labelKey: "subSel.family.skillLevelUp", prefix: "Skill Level Up " },
  { labelKey: "subSel.family.ingredient", prefix: "Ingredient Finder " },
  { labelKey: "subSel.family.skillTrigger", prefix: "Skill Trigger " },
];

const TIER_CLASS: Record<string, string> = { Gold: "gold", Blue: "blue", Regular: "regular" };

interface Props {
  subSkills: SubSkill[];
  value: string[];
  level: number;
  onChange: (next: string[]) => void;
  ariaLabel?: string;
}

export function SubSkillSelect({ subSkills, value, level, onChange, ariaLabel }: Props) {
  const { t, subSkill } = useI18n();
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
    // Cerrar al tabular fuera del componente, así el dropdown no queda suspendido
    // con navegación por teclado.
    const onFocusOut = (e: FocusEvent) => {
      if (ref.current && !ref.current.contains(e.relatedTarget as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    const node = ref.current;
    node?.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      node?.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);

  const tierOf = (name: string) => subSkills.find((s) => s.name === name)?.tier ?? "Regular";

  // Slots de posición fija (con huecos). value puede traer "" en un slot vacío.
  const slots = Array.from({ length: MAX_SUB_SKILLS }, (_, i) => value[i] ?? "");
  const count = slots.filter(Boolean).length;
  // Slots realmente disponibles al nivel actual (el resto se desbloquea al subir).
  const available = maxSubSkillSlots(level);

  // Primer click: al primer slot libre. Re-click: limpia ESE slot (deja el hueco,
  // sin reacomodar los demás).
  const toggle = (name: string) => {
    const next = [...slots];
    const idx = next.indexOf(name);
    if (idx !== -1) {
      next[idx] = "";
    } else {
      const empty = next.indexOf("");
      if (empty === -1) return;
      next[empty] = name;
    }
    onChange(next);
  };

  // Orden de variante dentro de una familia: primero S, luego M, luego L.
  const variantRank = (name: string) =>
    name.endsWith(" S") ? 0 : name.endsWith(" M") ? 1 : name.endsWith(" L") ? 2 : 0;
  const sorted = (items: SubSkill[]) =>
    [...items].sort((a, b) => variantRank(a.name) - variantRank(b.name));

  const used = new Set<string>();
  const familyGroups = FAMILIES.map((f) => {
    const items = subSkills.filter((s) => s.name.startsWith(f.prefix));
    items.forEach((s) => used.add(s.name));
    return { labelKey: f.labelKey, items: sorted(items) };
  });
  const groups = [
    { labelKey: "subSel.family.others", items: sorted(subSkills.filter((s) => !used.has(s.name))) },
    ...familyGroups,
  ];

  return (
    <div className="subskill-select" ref={ref}>
      <button
        type="button"
        className="subskill-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <div className="subskill-slots">
          {Array.from({ length: MAX_SUB_SKILLS }, (_, i) => {
            const name = slots[i];
            const unlock = SUB_SKILL_UNLOCK_LEVELS[i];
            const locked = level < unlock;
            const tier = name ? TIER_CLASS[tierOf(name)] : "empty";
            return (
              <Tooltip
                key={i}
                content={name ? subSkill(name) : t("subSel.slotEmpty", { unlock })}
              >
                <span className={`ss-icon ss-icon--${tier}` + (locked ? " is-locked" : "")}>
                  {name && <img src={subSkillIcon(name)} alt={name} />}
                  <span className="ss-icon__lv">{unlock}</span>
                </span>
              </Tooltip>
            );
          })}
        </div>
        <span
          className="subskill-trigger__hint"
          title={
            available < MAX_SUB_SKILLS
              ? t("subSel.hintActive", { level, available })
              : t("subSel.hintAllActive")
          }
        >
          {count >= MAX_SUB_SKILLS
            ? t("subSel.change", { count })
            : t("subSel.choose", { count })}
        </span>
      </button>

      {open && (
        <div
          className="subskill-dropdown"
          role="listbox"
          aria-multiselectable
          aria-label={t("subSel.aria")}
        >
          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.labelKey} className="subskill-group">
                <div className="subskill-group__title">{t(g.labelKey)}</div>
                <div className="subskill-group__items">
                  {g.items.map((s) => {
                    const idx = slots.indexOf(s.name);
                    const selected = idx !== -1;
                    const disabled = !selected && count >= MAX_SUB_SKILLS;
                    return (
                      <button
                        type="button"
                        key={s.name}
                        role="option"
                        aria-selected={selected}
                        className={
                          "subskill-option" + (selected ? " subskill-option--selected" : "")
                        }
                        onClick={() => toggle(s.name)}
                        disabled={disabled}
                        title={
                          selected ? t("subSel.remove", { name: subSkill(s.name) }) : subSkill(s.name)
                        }
                        aria-label={
                          selected ? t("subSel.remove", { name: subSkill(s.name) }) : subSkill(s.name)
                        }
                      >
                        <span className={`ss-icon ss-icon--${TIER_CLASS[s.tier]}`}>
                          <img src={subSkillIcon(s.name)} alt="" />
                          {selected && (
                            <span className="ss-icon__lv">{SUB_SKILL_UNLOCK_LEVELS[idx]}</span>
                          )}
                        </span>
                        <span>{subSkill(s.name)}</span>
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
