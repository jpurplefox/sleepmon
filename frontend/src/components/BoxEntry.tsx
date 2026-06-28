import { useEffect, useMemo, useRef, useState } from "react";

import { berryIcon } from "../berries";
import { RIBBONS } from "../constants";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { statIcon } from "../natures";
import { spriteUrl } from "../sprites";
import type { Member, Nature, Species } from "../types";
import { CHARGE_STRENGTH_ICON, mainSkillIcon } from "../skillIcons";
import { IconMore, IconSparkle } from "./icons";
import { IngredientLineup } from "./IngredientLineup";
import { MemberConfig } from "./MemberConfig";
import { RibbonIcon } from "./RibbonIcon";

// Producción diaria: un decimal, separador de miles. Suficiente para leer el
// panorama sin el ruido de dos decimales de la card comparativa.
const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
// Para magnitudes grandes y enteras (Vigor, fragmentos de sueño).
const fmtInt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

interface Props {
  member: Member;
  species?: Species;
  nature?: Nature;
  tierBySubSkill: (name: string) => string | undefined;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onCompare: () => void;
}

// Entrada de overview de la Caja: una card por Pokémon en tres zonas (identidad ·
// config · producción). Reemplaza a MemberCard. La config reusa el mismo lenguaje
// visual que el picker (MemberConfig). Las métricas de producción son de igual
// jerarquía y van en color neutro; el único dorado es el badge de nivel.
export function BoxEntry({
  member,
  species,
  nature,
  tierBySubSkill,
  onEdit,
  onDelete,
  onCompare,
}: Props) {
  const { t, berry, ingredient, mainSkill } = useI18n();
  // Editar/Eliminar/Comparar viven en un menú overflow "···" (no botones siempre
  // visibles: con muchas filas saturan). El borrado abre un modal de confirmación
  // (lo maneja la página), más claro que un paso inline.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Manejo del menú: foco al primer item (= Comparar) al abrir; al cerrar (click
  // afuera / Escape) el foco vuelve al disparador.
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        // Si el click NO cae sobre un control enfocable (que tomará el foco por sí
        // mismo), devolvemos el foco al disparador para no perderlo en el body al
        // desmontarse el item enfocado. Si cae sobre otro control, lo dejamos pasar.
        const target = e.target as HTMLElement;
        if (!target.closest("a, button, input, select, textarea, [tabindex]")) {
          menuBtnRef.current?.focus();
        }
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Navegación por teclado dentro del menú (patrón ARIA menu): flechas mueven el
  // foco entre items y Home/End van a los extremos; Tab queda atrapado (cicla) para
  // no escapar del menú abierto. Escape lo cierra (en el efecto de arriba).
  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    );
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      items[(idx + delta + items.length) % items.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      // Patrón ARIA de menu button: Tab cierra el menú y deja que el foco salga
      // naturalmente al siguiente elemento (no se atrapa el foco).
      setMenuOpen(false);
    }
  };

  const prod = member.production;
  const ribbonIdx = RIBBONS.findIndex((r) => r.name === member.ribbon);

  // Nivel de la main skill: se muestra en la columna de skill (junto a los
  // disparos), ya no en la fila de config. Mismo ícono/lenguaje que MemberConfig.
  const skillIcon = mainSkillIcon(species?.main_skill);
  const skillName = mainSkill(species?.main_skill ?? "");
  const skillLv = t("prod.skillLv", { level: member.skill_level });

  // Producción combinada por ingrediente: para cada ingrediente, la mecánica
  // normal (production.ingredients) + lo que aporta la main skill específica
  // (production.skill_ingredients). Mismo patrón "combined" que ProductionCard. El
  // pool de la skill puede incluir ingredientes que ningún slot normal produce
  // (slots bloqueados por nivel), así que se agregan al final conservando el orden.
  const combined = useMemo(() => {
    if (!prod) return [];
    const normal = new Map<string, number>();
    const order: string[] = [];
    for (const s of prod.ingredients) {
      if (!normal.has(s.ingredient)) order.push(s.ingredient);
      normal.set(s.ingredient, (normal.get(s.ingredient) ?? 0) + s.amount);
    }
    const skill = new Map<string, number>();
    for (const s of prod.skill_ingredients) {
      skill.set(s.ingredient, (skill.get(s.ingredient) ?? 0) + s.amount);
      if (!normal.has(s.ingredient)) order.push(s.ingredient);
    }
    return order
      .map((ing) => {
        const fromNormal = normal.get(ing) ?? 0;
        const fromSkill = skill.get(ing) ?? 0;
        return { ingredient: ing, total: fromNormal + fromSkill, fromNormal, fromSkill };
      })
      // Slots bloqueados por nivel rinden 0; no se muestran (coherente con
      // INGREDIENT_UNLOCK_LEVELS: solo los desbloqueados producen).
      .filter((g) => g.total > 0);
  }, [prod]);

  // Aporte de la main skill, para mostrarlo junto a sus disparos. Una especie
  // produce una sola de estas salidas (las demás vienen null). NO lleva ícono: sería
  // siempre el mismo que el de la skill (que ya se muestra en la línea de nivel), así
  // que se omite y el número se alinea con un sangrado. Los ingredientes específicos
  // (Ingredient Draw) NO van acá: ya se ven en la columna de ingredientes.
  const skillYield = useMemo<{ text: string; title: string } | null>(() => {
    if (!prod) return null;
    if (prod.skill_ingredient_total != null && prod.skill_ingredient_total > 0) {
      const v = fmt(prod.skill_ingredient_total);
      return {
        text: t("box.randomIngredients", { value: v }),
        title: t("box.randomIngredientsTitle", { value: v }),
      };
    }
    if (prod.skill_energy != null)
      return { text: fmt(prod.skill_energy), title: t("card.energyEachTitle") };
    if (prod.skill_self_energy != null)
      return { text: fmt(prod.skill_self_energy), title: t("card.selfEnergyTitle") };
    if (prod.skill_random_energy != null)
      return { text: fmt(prod.skill_random_energy), title: t("card.randomEnergy") };
    // La fuerza por Charge Strength NO va acá: se suma a la fuerza directa de las
    // bayas y se muestra en la zona de producción (junto a las bayas).
    if (prod.skill_dream_shards != null)
      return { text: fmtInt(prod.skill_dream_shards), title: t("card.dreamShardsTitle") };
    if (prod.skill_cooking_ingredients != null)
      return { text: fmt(prod.skill_cooking_ingredients), title: t("card.cookingTitle") };
    if (prod.skill_tasty_chance != null)
      return { text: `+${fmtInt(prod.skill_tasty_chance)}%`, title: t("card.extraTastyTitle") };
    if (prod.skill_extra_helpful != null)
      return { text: `×${fmt(prod.skill_extra_helpful)}`, title: t("card.helpMultTitle") };
    return null;
  }, [prod, t]);

  return (
    <article className="card box-entry">
      {/* Columna 1 — Identidad: sprite a la izquierda; a su derecha el nombre con
          el listón en una línea y el nivel (dorado) debajo. */}
      <div className="box-entry__identity">
        {species && (
          <img className="box-entry__sprite" src={spriteUrl(species.dex)} alt="" loading="lazy" />
        )}
        <div className="box-entry__id-text">
          <div className="box-entry__title">
            <span className="box-entry__name">{member.species}</span>
            {ribbonIdx > 0 && (
              <RibbonIcon
                index={ribbonIdx}
                size={18}
                title={t("member.ribbon", { hours: RIBBONS[ribbonIdx].hours })}
              />
            )}
          </div>
          <span className="badge badge--level">{t("common.level", { level: member.level })}</span>
        </div>
      </div>

      {/* Columna 2 — Ingredientes equipados: su propia columna (antes vivían arriba
          de la config). Atenuada igual que la config. */}
      <div className="box-entry__ing-config">
        <IngredientLineup level={member.level} ingredients={member.ingredients} />
      </div>

      {/* Columna 3 — Config: mismo lenguaje que el picker, en dos líneas
          (naturaleza / sub skills). El nivel de skill y los ingredientes se sacan de
          acá (van a sus propias columnas). Atenuada para retroceder frente a las
          métricas. */}
      <div className="box-entry__config prod-box-item__config">
        <MemberConfig
          level={member.level}
          nature={member.nature}
          ingredients={member.ingredients}
          subSkills={member.sub_skills}
          skillLevel={member.skill_level}
          natureMeta={nature}
          mainSkillName={species?.main_skill}
          tierBySubSkill={tierBySubSkill}
          showSkillLevel={false}
          showIngredients={false}
        />
      </div>

      {/* Columna 4 — Bayas + Fuerza, en dos líneas. Números neutros (el único
          dorado es el nivel). */}
      <div className="box-entry__berries" role="group" aria-label={t("box.productionAria")}>
        <div className="box-entry__metric" title={t("box.berriesTitle")}>
          {species ? (
            <img className="mini-icon" src={berryIcon(species.berry)} alt="" aria-hidden="true" />
          ) : (
            <span className="mini-icon" aria-hidden="true" />
          )}
          <span className="box-entry__metric-value">
            {prod ? fmt(prod.berries) : t("common.dash")}
          </span>
          <span className="sr-only">
            {t("box.berriesAria", {
              value: prod ? fmt(prod.berries) : t("common.dash"),
              berry: species ? berry(species.berry) : "",
            })}
          </span>
        </div>

        {/* Fuerza a Snorlax: directa por bayas + indirecta por la main skill
            (Charge Strength). Es la métrica que más importa en un Pokémon de bayas,
            por eso va junto a las bayas y no escondida en el aporte de skill. */}
        {prod && (prod.berry_strength > 0 || prod.skill_strength != null) && (
          <div
            className="box-entry__metric"
            title={
              prod.skill_strength != null
                ? `${t("box.strengthTitle")} · ${t("card.fromBerriesTitle")} ${fmtInt(
                    prod.berry_strength,
                  )} + ${t("card.skillTitle")} ${fmtInt(prod.skill_strength)}`
                : t("box.strengthTitle")
            }
          >
            <img className="mini-icon" src={CHARGE_STRENGTH_ICON} alt="" aria-hidden="true" />
            <span className="box-entry__metric-value">
              {fmtInt(prod.berry_strength + (prod.skill_strength ?? 0))}
            </span>
            {prod.skill_strength != null && (
              <img
                className="box-entry__ing-skill"
                src={statIcon("Main Skill Chance")}
                alt=""
                aria-hidden="true"
                title={t("card.skillTitle")}
              />
            )}
            <span className="sr-only">
              {prod.skill_strength != null
                ? t("box.strengthBreakdownAria", {
                    value: fmtInt(prod.berry_strength + prod.skill_strength),
                    berries: fmtInt(prod.berry_strength),
                    skill: fmtInt(prod.skill_strength),
                  })
                : t("box.strengthAria", { value: fmtInt(prod.berry_strength) })}
            </span>
          </div>
        )}
      </div>

      {/* Columna 5 — Producción de ingredientes: uno por línea, alineados entre
          Pokémon. */}
      <div
        className="box-entry__ingredients"
        title={
          prod
            ? t("box.ingredientsTitle", { total: fmt(prod.ingredients_total) })
            : t("box.ingredientsTitlePlain")
        }
      >
        {combined.length === 0 ? (
          <span className="box-entry__metric-value">{t("common.dash")}</span>
        ) : (
          combined.map((g) => (
            <span
              key={g.ingredient}
              className="box-entry__ing-pair"
              title={
                g.fromSkill > 0
                  ? `${ingredient(g.ingredient)} · ${t("card.normalTitle")} ${fmt(
                      g.fromNormal,
                    )} + ${t("card.skillTitle")} ${fmt(g.fromSkill)}`
                  : ingredient(g.ingredient)
              }
            >
              <img
                className="mini-icon"
                src={ingredientIcon(g.ingredient)}
                alt=""
                aria-hidden="true"
              />
              <span className="box-entry__metric-value">{fmt(g.total)}</span>
              {g.fromSkill > 0 && (
                <img
                  className="box-entry__ing-skill"
                  src={statIcon("Main Skill Chance")}
                  alt=""
                  aria-hidden="true"
                  title={t("card.skillTitle")}
                />
              )}
              <span className="sr-only">
                {g.fromSkill > 0
                  ? t("box.ingredientsBreakdownAria", {
                      value: fmt(g.total),
                      ingredient: ingredient(g.ingredient),
                      normal: fmt(g.fromNormal),
                      skill: fmt(g.fromSkill),
                    })
                  : t("box.ingredientsPlainAria", {
                      value: fmt(g.total),
                      ingredient: ingredient(g.ingredient),
                    })}
              </span>
            </span>
          ))
        )}
      </div>

      {/* Columna 6 — Skill: nivel de la main skill + disparos + ayuda extra que dan
          esos disparos, apilados. En su propia columna para alinear entre Pokémon,
          sin importar cuántos ingredientes tenga cada uno. */}
      <div className="box-entry__skill" role="group" aria-label={t("box.skillAria")}>
        <span className="box-entry__skill-lv" title={`${skillName} · ${skillLv}`}>
          {skillIcon.kind === "img" ? (
            <img className="mini-icon" src={skillIcon.src} alt="" />
          ) : (
            <skillIcon.Component aria-hidden="true" />
          )}
          <span className="box-entry__metric-value" aria-hidden="true">{skillLv}</span>
          <span className="sr-only">{`${skillName} ${skillLv}`}</span>
        </span>
        <div className="box-entry__metric" title={t("box.triggersTitle")}>
          <IconSparkle aria-hidden="true" />
          <span className="box-entry__metric-value">
            {prod ? fmt(prod.skill_triggers) : t("common.dash")}
          </span>
          <span className="sr-only">
            {t("box.triggersAria", {
              value: prod ? fmt(prod.skill_triggers) : t("common.dash"),
            })}
          </span>
        </div>
        {/* Aporte de la main skill: energía, ingredientes al azar, etc. Sin ícono
            (sería el mismo que el de la skill, ya visible arriba): solo el número,
            sangrado para alinearse con las líneas de nivel y disparos. */}
        {skillYield && (
          <span className="box-entry__skill-yield" title={skillYield.title}>
            <span className="box-entry__metric-value">{skillYield.text}</span>
            {/* El valor ya está en el texto visible; el sr-only solo aporta la
                descripción (que de otro modo solo se vería en el title al hover). */}
            <span className="sr-only">{skillYield.title}</span>
          </span>
        )}
      </div>

      {/* Acciones: overflow "···" con Comparar (primero) + Editar/Eliminar. */}
      <div className="box-entry__actions">
        <div className="box-entry__menu" ref={menuRef}>
          <button
            ref={menuBtnRef}
            type="button"
            className="icon-btn box-entry__menu-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t("box.moreActions", { species: member.species })}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <IconMore />
          </button>
          {menuOpen && (
            <div className="box-entry__menu-pop" role="menu" onKeyDown={onMenuKeyDown}>
              <button
                type="button"
                role="menuitem"
                className="box-entry__menu-item box-entry__menu-item--compare"
                aria-label={t("box.compareAria", { species: member.species })}
                onClick={() => {
                  setMenuOpen(false);
                  onCompare();
                }}
              >
                {t("box.compareMenu")}
              </button>
              <button
                type="button"
                role="menuitem"
                className="box-entry__menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
              >
                {t("common.edit")}
              </button>
              <button
                type="button"
                role="menuitem"
                className="box-entry__menu-item box-entry__menu-item--danger"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(member.id);
                }}
                aria-label={t("member.deleteAria", { species: member.species })}
              >
                {t("member.delete")}
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
