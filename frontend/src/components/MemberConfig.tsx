import {
  INGREDIENT_UNLOCK_LEVELS,
  SUB_SKILL_NEVER_UNLOCKS,
  SUB_SKILL_UNLOCK_LEVELS,
} from "../constants";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { statIcon } from "../natures";
import { mainSkillIcon } from "../skillIcons";
import { subSkillIcon } from "../subskills";
import type { Nature } from "../types";

const TIER_CLASS: Record<string, string> = { Gold: "gold", Blue: "blue", Regular: "regular" };

// Slots de sub skill del juego (1..5). Se pintan SIEMPRE los 5: los no cargados,
// como cuadrados vacíos y opacos, para que la fila quede alineada entre Pokémon.
const SUB_SKILL_SLOTS = SUB_SKILL_UNLOCK_LEVELS.length;

interface Props {
  // Lo necesario de un ejemplar para pintar su config (subconjunto de Member):
  // se pasan primitivos en vez del objeto entero para no atar el componente a la
  // forma exacta de Member/MemberInput.
  level: number;
  nature: string;
  ingredients: string[];
  subSkills: string[];
  skillLevel: number;
  // Naturaleza resuelta del catálogo (para los íconos ↑/↓); undefined = neutra/sin
  // dato, se cae al nombre en texto.
  natureMeta?: Nature;
  // Main skill de la especie (para el ícono representativo); undefined = destello
  // genérico.
  mainSkillName?: string;
  // Tier de cada sub skill por nombre (marco coloreado). Las ausentes = Regular.
  tierBySubSkill: (name: string) => string | undefined;
}

// Fila de config compartida entre el picker (BoxPicker) y la entrada de la Caja
// (BoxEntry): ingredientes → naturaleza (↑/↓) → sub skills (tier + tooltip) →
// ícono de main skill + "Lv. N". Es el mismo lenguaje visual; extraerlo evita
// duplicar la lógica de locked/tier/tooltip. No tiene contenedor propio: el
// consumidor envuelve con `.prod-box-item__config` (o equivalente).
export function MemberConfig({
  level,
  nature,
  ingredients,
  subSkills,
  skillLevel,
  natureMeta,
  mainSkillName,
  tierBySubSkill,
}: Props) {
  const { t, nature: natureLabel, natureStat, ingredient, subSkill, mainSkill } = useI18n();

  const skillIcon = mainSkillIcon(mainSkillName);
  const skillName = mainSkill(mainSkillName ?? "");
  const skillLv = t("prod.skillLv", { level: skillLevel });

  return (
    <>
      {/* Orden: ingredientes → naturaleza → sub skills → skill. */}
      <span className="ingredient-row">
        {ingredients.map((ing, idx) => {
          const locked = level < (INGREDIENT_UNLOCK_LEVELS[idx] ?? 1);
          return (
            <img
              key={`${ing}-${idx}`}
              className={
                "ingredient-row__icon" + (locked ? " ingredient-row__icon--locked" : "")
              }
              src={ingredientIcon(ing)}
              alt={ingredient(ing)}
              title={ingredient(ing)}
              loading="lazy"
            />
          );
        })}
      </span>

      {/* Naturaleza: si tiene efecto, ↑/↓ con íconos de stat; si es neutra o no
          tiene, un placeholder que ocupa el MISMO espacio (cuadrados vacíos) para
          que la fila quede alineada. El nombre va en title/sr-only. */}
      <span
        className="prod-box-item__nature icon-row"
        title={nature ? natureLabel(nature) : t("card.noNature")}
      >
        {natureMeta && !natureMeta.neutral && natureMeta.increased && natureMeta.decreased ? (
          <>
            <span className="nat-up">↑</span>
            <img
              className="mini-icon"
              src={statIcon(natureMeta.increased)}
              alt={natureStat(natureMeta.increased)}
              title={natureStat(natureMeta.increased)}
            />
            <span className="nat-down">↓</span>
            <img
              className="mini-icon"
              src={statIcon(natureMeta.decreased)}
              alt={natureStat(natureMeta.decreased)}
              title={natureStat(natureMeta.decreased)}
            />
          </>
        ) : (
          <>
            <span className="nat-up nat-up--muted">↑</span>
            <span className="mini-icon mini-icon--empty" aria-hidden="true" />
            <span className="nat-down nat-down--muted">↓</span>
            <span className="mini-icon mini-icon--empty" aria-hidden="true" />
            <span className="sr-only">{nature ? natureLabel(nature) : t("card.noNature")}</span>
          </>
        )}
      </span>

      {/* Sub skills: siempre los 5 slots; los no cargados como cuadrado vacío. */}
      <span className="ingredient-row">
        {Array.from({ length: SUB_SKILL_SLOTS }, (_, idx) => {
          const s = subSkills[idx];
          if (!s) {
            return <span key={`empty-${idx}`} className="ss-icon ss-icon--empty" aria-hidden="true" />;
          }
          const unlock = SUB_SKILL_UNLOCK_LEVELS[idx] ?? SUB_SKILL_NEVER_UNLOCKS;
          const locked = level < unlock;
          const tier = TIER_CLASS[tierBySubSkill(s) ?? "Regular"];
          const tooltip = !locked
            ? subSkill(s)
            : Number.isFinite(unlock)
              ? t("member.subSkillLocked", { name: subSkill(s), level: unlock })
              : t("member.subSkillSlotUnavailable", { name: subSkill(s) });
          return (
            <span
              key={`${s}-${idx}`}
              className={`ss-icon ss-icon--${tier}` + (locked ? " is-locked" : "")}
              data-tooltip={tooltip}
            >
              <img src={subSkillIcon(s)} alt={subSkill(s)} loading="lazy" />
            </span>
          );
        })}
      </span>

      {/* Skill: el ícono propio de la main skill + "Lv. N". Color neutro (el
          dorado es para el nivel del Pokémon). El nombre de la skill va en
          sr-only/title para no depender solo del ícono. */}
      <span className="prod-box-item__skill-lv" title={`${skillName} · ${skillLv}`}>
        {skillIcon.kind === "img" ? (
          <img className="mini-icon" src={skillIcon.src} alt="" />
        ) : (
          <skillIcon.Component aria-hidden="true" />
        )}
        <span aria-hidden="true">{skillLv}</span>
        <span className="sr-only">{`${skillName} ${skillLv}`}</span>
      </span>
    </>
  );
}
