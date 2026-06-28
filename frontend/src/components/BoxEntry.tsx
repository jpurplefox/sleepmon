import { useEffect, useRef, useState } from "react";

import { berryIcon } from "../berries";
import { RIBBONS } from "../constants";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { spriteUrl } from "../sprites";
import type { Member, Nature, Species } from "../types";
import { IconSparkle } from "./icons";
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
// visual que el picker (MemberConfig). Las tres métricas de producción son de
// igual jerarquía y van en color neutro; el único dorado es el badge de nivel.
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
  // Editar/Eliminar viven en un menú overflow "···" (no botones siempre visibles:
  // con muchas filas saturan y exponen el borrado). Comparar es acción rápida y
  // visible. El borrado se confirma en dos pasos dentro del menú.
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  // Cerrar el menú al click afuera o con Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirming(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setConfirming(false);
      }
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

  // Ingrediente "principal" del overview: el de mayor amount de la producción. El
  // total disponible (ingredients_total) se muestra en el tooltip. Si hay empate o
  // no hay ingredientes, queda undefined y la métrica cae al placeholder.
  const mainIngredient =
    prod && prod.ingredients.length > 0
      ? prod.ingredients.reduce((best, cur) => (cur.amount > best.amount ? cur : best))
      : undefined;

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

      {/* Zona 3 — Producción: tres métricas de igual jerarquía, números neutros. */}
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
          className="box-entry__metric"
          title={
            prod
              ? t("box.ingredientsTitle", { total: fmt(prod.ingredients_total) })
              : t("box.ingredientsTitlePlain")
          }
        >
          {mainIngredient ? (
            <img
              className="mini-icon"
              src={ingredientIcon(mainIngredient.ingredient)}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <span className="mini-icon" aria-hidden="true" />
          )}
          <span className="box-entry__metric-value">
            {mainIngredient ? fmt(mainIngredient.amount) : t("common.dash")}
          </span>
          <span className="sr-only">
            {mainIngredient && prod
              ? t("box.ingredientsAria", {
                  value: fmt(mainIngredient.amount),
                  ingredient: ingredient(mainIngredient.ingredient),
                  total: fmt(prod.ingredients_total),
                })
              : t("box.ingredientsAriaEmpty")}
          </span>
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

      {/* Acciones: Comparar (rápida, acento) + overflow "···" con Editar/Eliminar. */}
      <div className="box-entry__actions">
        <button className="btn btn--ghost box-entry__compare" onClick={onCompare}>
          {t("box.compare")}
        </button>
        <div className="box-entry__menu" ref={menuRef}>
          <button
            type="button"
            className="icon-btn box-entry__menu-btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t("box.moreActions", { species: member.species })}
            onClick={() => setMenuOpen((o) => !o)}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="box-entry__menu-pop" role="menu">
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
