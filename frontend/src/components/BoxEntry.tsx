import { useEffect, useMemo, useRef, useState } from "react";

import { berryIcon } from "../berries";
import { RIBBONS } from "../constants";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { statIcon } from "../natures";
import { spriteUrl } from "../sprites";
import type { Member, Nature, Species } from "../types";
import { IconMore, IconSparkle } from "./icons";
import { MemberConfig } from "./MemberConfig";
import { RibbonIcon } from "./RibbonIcon";

// Producción diaria: un decimal, separador de miles. Suficiente para leer el
// panorama sin el ruido de dos decimales de la card comparativa.
const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
  const { t, berry, ingredient } = useI18n();
  // Editar/Eliminar/Comparar viven en un menú overflow "···" (no botones siempre
  // visibles: con muchas filas saturan y exponen el borrado). Comparar es el primer
  // ítem (acción rápida); el borrado se confirma en dos pasos dentro del menú.
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Manejo del menú: foco al primer item (= Comparar) al abrir; al cerrar (click
  // afuera / Escape) se resetea la confirmación y el foco vuelve al disparador. No
  // hay auto-reset por tiempo: confunde tener el botón "Eliminar" volviendo solo
  // mientras el menú sigue abierto.
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const close = () => {
      setMenuOpen(false);
      setConfirming(false);
      menuBtnRef.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirming(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleDelete = () => {
    if (confirming) {
      onDelete(member.id);
      setMenuOpen(false);
    } else {
      setConfirming(true);
    }
  };

  const prod = member.production;
  const ribbonIdx = RIBBONS.findIndex((r) => r.name === member.ribbon);

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

  // Ingredientes al azar de la main skill (Ingredient Magnet S): total sin
  // desglosar por tipo. Se muestra como marcador "✦ +N al azar" al final.
  const randomTotal =
    prod && prod.skill_ingredient_total != null && prod.skill_ingredient_total > 0
      ? prod.skill_ingredient_total
      : null;

  return (
    <article className="card box-entry">
      {/* Zona 1 — Identidad: sprite + nombre + listón + badge de nivel (dorado). */}
      <div className="box-entry__identity">
        {species && (
          <img className="box-entry__sprite" src={spriteUrl(species.dex)} alt="" loading="lazy" />
        )}
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

      {/* Zona 2 — Config: mismo lenguaje que el picker, atenuada para retroceder
          frente a las métricas. */}
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
        />
      </div>

      {/* Zona 3 — Producción: bayas + todos los ingredientes desbloqueados +
          disparos de skill. Números neutros (el único dorado es el nivel). */}
      <div className="box-entry__production" role="group" aria-label={t("box.productionAria")}>
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

        <div
          className="box-entry__ingredients"
          title={
            prod
              ? t("box.ingredientsTitle", { total: fmt(prod.ingredients_total) })
              : t("box.ingredientsTitlePlain")
          }
        >
          {combined.length === 0 && randomTotal == null ? (
            <span className="box-entry__metric-value">{t("common.dash")}</span>
          ) : (
            <>
              {combined.map((g) => (
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
              ))}
              {randomTotal != null && (
                <span
                  className="box-entry__ing-pair box-entry__ing-random"
                  title={t("box.randomIngredientsTitle", { value: fmt(randomTotal) })}
                >
                  {/* Ingredientes al azar (Ingredient Magnet): ícono de ingrediente
                      genérico, no el de skill — son ingredientes, de cualquier tipo. */}
                  <img
                    className="mini-icon"
                    src={statIcon("Ingredient Finding")}
                    alt=""
                    aria-hidden="true"
                  />
                  <span className="box-entry__metric-value">
                    {t("box.randomIngredients", { value: fmt(randomTotal) })}
                  </span>
                  <span className="sr-only">
                    {t("box.randomIngredientsAria", { value: fmt(randomTotal) })}
                  </span>
                </span>
              )}
            </>
          )}
        </div>

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
            <div className="box-entry__menu-pop" role="menu">
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
                onClick={handleDelete}
                aria-label={
                  confirming
                    ? t("member.deleteConfirmAria", { species: member.species })
                    : t("member.deleteAria", { species: member.species })
                }
              >
                {confirming ? t("member.confirm") : t("member.delete")}
              </button>
            </div>
          )}
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {confirming ? t("member.deleteConfirmStatus", { species: member.species }) : ""}
        </span>
      </div>
    </article>
  );
}
