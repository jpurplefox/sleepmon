import { useEffect, useState } from "react";

import {
  INGREDIENT_UNLOCK_LEVELS,
  RIBBONS,
  SUB_SKILL_NEVER_UNLOCKS,
  SUB_SKILL_UNLOCK_LEVELS,
} from "../constants";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { spriteUrl } from "../sprites";
import { subSkillIcon } from "../subskills";
import type { Member, Nature } from "../types";
import { RibbonIcon } from "./RibbonIcon";

const TIER_CLASS: Record<string, string> = { Gold: "gold", Blue: "blue", Regular: "regular" };

interface Props {
  member: Member;
  nature?: Nature;
  dex?: number;
  subSkillTiers?: Record<string, string>;
  onEdit?: () => void;
  onDelete: (id: string) => void;
}

export function MemberCard({ member, nature, dex, subSkillTiers, onEdit, onDelete }: Props) {
  const { t, nature: natureLabel, ingredient, subSkill } = useI18n();
  // Confirmación en dos pasos: el primer click pide confirmar; si pasan ~3s sin
  // confirmar, vuelve al estado normal.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const handleDelete = () => {
    if (confirming) {
      onDelete(member.id);
    } else {
      setConfirming(true);
    }
  };

  return (
    <article className="card member-card">
      <header className="member-card__head">
        <div className="member-card__title">
          {dex !== undefined && (
            <img className="member-card__sprite" src={spriteUrl(dex)} alt="" loading="lazy" />
          )}
          <div>
            <h3>{member.species}</h3>
          </div>
        </div>
        <div className="member-card__head-right">
          {(() => {
            const idx = RIBBONS.findIndex((r) => r.name === member.ribbon);
            return idx > 0 ? (
              <RibbonIcon
                index={idx}
                size={22}
                title={t("member.ribbon", { hours: RIBBONS[idx].hours })}
              />
            ) : null;
          })()}
          <span className="badge badge--level">{t("common.level", { level: member.level })}</span>
        </div>
      </header>

      <dl className="member-card__body">
        <div>
          <dt>{t("member.nature")}</dt>
          <dd>
            {natureLabel(member.nature)}
            {nature && !nature.neutral && (
              <span className="nature-effect">
                {" "}
                <span className="up">↑{nature.increased}</span>{" "}
                <span className="down">↓{nature.decreased}</span>
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>{t("member.ingredients")}</dt>
          <dd className="ingredient-row">
            {member.ingredients.map((ing, idx) => {
              const locked = member.level < (INGREDIENT_UNLOCK_LEVELS[idx] ?? 1);
              return (
                <img
                  key={`${ing}-${idx}`}
                  className={
                    "ingredient-row__icon" + (locked ? " ingredient-row__icon--locked" : "")
                  }
                  src={ingredientIcon(ing)}
                  alt={ingredient(ing)}
                  title={
                    locked
                      ? t("member.ingredientLocked", {
                          ing: ingredient(ing),
                          level: INGREDIENT_UNLOCK_LEVELS[idx],
                        })
                      : ingredient(ing)
                  }
                  loading="lazy"
                />
              );
            })}
          </dd>
        </div>
        <div>
          <dt>{t("member.subSkills")}</dt>
          <dd className="ingredient-row">
            {member.sub_skills.length === 0 && <span className="muted">{t("common.dash")}</span>}
            {member.sub_skills.map((s, idx) => {
              const unlock = SUB_SKILL_UNLOCK_LEVELS[idx] ?? SUB_SKILL_NEVER_UNLOCKS;
              const locked = member.level < unlock;
              const tier = TIER_CLASS[subSkillTiers?.[s] ?? "Regular"];
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
          </dd>
        </div>
      </dl>

      <div className="member-card__actions">
        {onEdit && (
          <button className="btn btn--ghost btn--edit" onClick={onEdit}>
            {t("common.edit")}
          </button>
        )}
        <button
          className="btn btn--ghost btn--danger"
          onClick={handleDelete}
          aria-label={
            confirming
              ? t("member.deleteConfirmAria", { species: member.species })
              : t("member.deleteAria", { species: member.species })
          }
        >
          {confirming ? t("member.confirm") : t("member.delete")}
        </button>
        {/* El anuncio del estado de confirmación vive en un status separado: el
            aria-live sobre el propio botón cuyo label cambia es poco fiable. */}
        <span className="sr-only" role="status" aria-live="polite">
          {confirming ? t("member.deleteConfirmStatus", { species: member.species }) : ""}
        </span>
      </div>
    </article>
  );
}
