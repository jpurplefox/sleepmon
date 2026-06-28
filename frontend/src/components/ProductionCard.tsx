import { useEffect, useMemo, useRef, useState } from "react";

import { berryIcon } from "../berries";
import {
  INGREDIENT_UNLOCK_LEVELS,
  RIBBONS,
  SUB_SKILL_NEVER_UNLOCKS,
  SUB_SKILL_UNLOCK_LEVELS,
} from "../constants";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { statIcon } from "../natures";
import { spriteUrl } from "../sprites";
import { subSkillIcon } from "../subskills";
import type { Catalog, MemberInput, Production } from "../types";
import { RibbonIcon } from "./RibbonIcon";
import {
  IconClock,
  IconClose,
  IconCopy,
  IconEdit,
  IconGrip,
  IconHelp,
  IconHourglass,
  IconMagnifier,
  IconMoon,
  IconPackage,
  IconPot,
  IconSaveBox,
  IconSparkle,
  IconStrength,
} from "./icons";

const fmt = (n: number) => n.toFixed(2);
// Magnitudes grandes (fuerza, fragmentos de sueño): enteros con separador de miles.
const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (n: number) => `${n.toFixed(1)}%`;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const TIER_CLASS: Record<string, string> = { Gold: "gold", Blue: "blue", Regular: "regular" };
const hms = (hours: number) => {
  const total = Math.round(hours * 3600);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// Diferencia de un valor contra la base (la primera card). Verde si esta config
// rinde más, rojo si rinde menos. No se muestra en la card base ni cuando no hay
// un valor base comparable (p. ej. un ingrediente que la base no produce).
function Delta({ value, base }: { value: number; base: number | null | undefined }) {
  if (base == null) return null;
  const diff = value - base;
  if (Math.abs(diff) < 0.005) return <span className="prod-delta prod-delta--same">≈</span>;
  const cls = diff > 0 ? "prod-delta--up" : "prod-delta--down";
  return (
    <span className={`prod-delta ${cls}`}>
      {diff > 0 ? "+" : "−"}
      {fmt(Math.abs(diff))}
    </span>
  );
}

interface Props {
  config: MemberInput;
  catalog: Catalog;
  production: Production | null;
  productionError: Error | null;
  // Datos de la card base (índice 0) para calcular los deltas; null/undefined si
  // esta es la base.
  base?: Production | null;
  // True cuando esta card es la base y hay más de una en comparación: muestra el
  // chip "Base" y el borde lunar. comparing controla si se ofrece "Hacer base".
  isBase?: boolean;
  comparing?: boolean;
  onEdit: () => void;
  onClone: () => void;
  onRemove: () => void;
  onMakeBase: () => void;
  onSaveToBox: () => void;
  // Reordenamiento accesible por teclado: intercambia esta card con la anterior
  // / siguiente. undefined en los extremos (deshabilita el botón).
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  cloneDisabled?: boolean;
  inBox?: boolean;
  saveState?: "idle" | "saving" | "saved" | "error";
  saveError?: string | null;
  // Reordenamiento por arrastre (cambia cuál card es la base).
  dragging?: boolean;
  dragOver?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}

export function ProductionCard({
  config,
  catalog,
  production,
  productionError,
  base,
  isBase,
  comparing,
  onEdit,
  onClone,
  onRemove,
  onMakeBase,
  onSaveToBox,
  onMoveLeft,
  onMoveRight,
  cloneDisabled,
  inBox,
  saveState = "idle",
  saveError,
  dragging,
  dragOver,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}: Props) {
  const { t, ingredient, berry, subSkill, natureStat, nature: natureName } = useI18n();
  const cardRef = useRef<HTMLElement>(null);
  // La animación de entrada solo debe correr al montar (al agregar una card). Al
  // reordenar/intercambiar, el navegador reinicia las animaciones CSS de los nodos
  // movidos aunque React no los desmonte; por eso la clase de entrada se quita al
  // terminar, y los reordenamientos posteriores ya no la reinician.
  const [entering, setEntering] = useState(true);

  // Fallback para bajar la clase de entrada aunque onAnimationEnd no dispare:
  // bajo prefers-reduced-motion la animación es `none` y el evento nunca llega,
  // así que la clase quedaría pegada. Un timeout la limpia igual.
  useEffect(() => {
    if (!entering) return;
    const t = window.setTimeout(() => setEntering(false), 250);
    return () => window.clearTimeout(t);
  }, [entering]);

  const species = catalog.species.find((s) => s.name === config.species);
  const nature = catalog.natures.find((n) => n.name === config.nature);
  const tierClass = (name: string) =>
    TIER_CLASS[catalog.sub_skills.find((s) => s.name === name)?.tier ?? "Regular"];

  const d = production;

  // Si dos slots dan el mismo ingrediente, se muestra una vez sumando.
  const grouped = useMemo(() => {
    if (!d) return [];
    const map = new Map<string, number>();
    for (const s of d.ingredients) {
      map.set(s.ingredient, (map.get(s.ingredient) ?? 0) + s.amount);
    }
    return [...map.entries()].map(([ingredient, amount]) => ({ ingredient, amount }));
  }, [d]);

  // Ingredientes que aporta la main skill (Ingredient Draw S), por ingrediente del
  // pool. Vacío para la enorme mayoría de especies (la skill no produce ingredientes).
  const skillIng = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of d?.skill_ingredients ?? []) {
      map.set(s.ingredient, (map.get(s.ingredient) ?? 0) + s.amount);
    }
    return map;
  }, [d]);

  // Total por ingrediente = mecánica normal (slots) + skill. El pool de la skill
  // puede incluir ingredientes que ningún slot normal produce (slots bloqueados a
  // bajo nivel), así que se agregan al final conservando el orden.
  const combined = useMemo(() => {
    const normal = new Map<string, number>();
    const order: string[] = [];
    for (const g of grouped) {
      normal.set(g.ingredient, g.amount);
      order.push(g.ingredient);
    }
    for (const ing of skillIng.keys()) {
      if (!normal.has(ing)) order.push(ing);
    }
    return order.map((ingredient) => {
      const fromNormal = normal.get(ingredient) ?? 0;
      const fromSkill = skillIng.get(ingredient) ?? 0;
      return { ingredient, total: fromNormal + fromSkill, fromNormal, fromSkill };
    });
  }, [grouped, skillIng]);

  // Mismo total combinado para la base: permite el delta por ingrediente cuando ambas
  // cards comparten ese ingrediente (el caso típico al clonar una variante).
  // Las entradas con cantidad 0 NO se incluyen: "0" y "ausente" deben tratarse
  // igual para el delta (si no, un ingrediente que la base produce en 0 mostraría
  // un delta positivo grande, distinto de uno que la base no produce).
  const baseIng = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of base?.ingredients ?? []) {
      map.set(s.ingredient, (map.get(s.ingredient) ?? 0) + s.amount);
    }
    for (const s of base?.skill_ingredients ?? []) {
      map.set(s.ingredient, (map.get(s.ingredient) ?? 0) + s.amount);
    }
    for (const [k, v] of map) {
      if (v === 0) map.delete(k);
    }
    return map;
  }, [base]);

  return (
    <div className="prod-card-cell">
      {/* Acciones fuera del cuerpo de la card, en una barra arriba: liberan la
          primera fila de la card para el nombre / nivel / listón. */}
      <div className="prod-card__toolbar">
        {/* Feedback del guardado, junto al botón que lo dispara. */}
        <span className="prod-card__toolbar-status" role="status" aria-live="polite">
          {saveState === "saving" && (
            <span className="prod-card__save muted">{t("card.saving")}</span>
          )}
          {saveState === "saved" && (
            <span className="prod-card__save prod-card__save--ok">{t("card.saved")}</span>
          )}
          {saveState === "error" && (
            <span className="prod-card__save prod-card__save--error">
              {saveError ?? t("card.saveError")}
            </span>
          )}
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={onEdit}
          title={t("common.edit")}
          aria-label={t("common.edit")}
        >
          <IconEdit />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onClone}
          disabled={cloneDisabled}
          title={cloneDisabled ? t("card.cloneMax") : t("card.clone")}
          aria-label={t("card.clone")}
        >
          <IconCopy />
        </button>
        <button
          type="button"
          className={
            "icon-btn" +
            (inBox ? " icon-btn--inbox" : "") +
            (saveState === "saving" ? " icon-btn--saving" : "")
          }
          onClick={onSaveToBox}
          disabled={saveState === "saving"}
          title={inBox ? t("card.saveUpdate") : t("card.saveNew")}
          aria-label={inBox ? t("card.saveUpdate") : t("card.saveNew")}
        >
          <IconSaveBox />
        </button>
        <button
          type="button"
          className="icon-btn prod-card__remove"
          onClick={onRemove}
          title={t("card.remove")}
          aria-label={t("card.remove")}
        >
          <IconClose />
        </button>
      </div>
      <article
        ref={cardRef}
        className={
          "prod-card" +
          (entering ? " prod-card--enter" : "") +
          (isBase ? " prod-card--base" : "") +
          (dragging ? " prod-card--dragging" : "") +
          (dragOver ? " prod-card--dragover" : "")
        }
        onAnimationEnd={(e) => {
          if (e.animationName === "prod-card-in") setEntering(false);
        }}
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onDrop?.();
        }}
      >
        <header className="prod-card__head">
          {/* Fila 1: grip de arrastre + reordenar por teclado + nombre / nivel / listón. */}
          <div className="prod-card__topline">
            <button
              type="button"
              className="icon-btn prod-card__grip"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", config.species);
                if (cardRef.current) e.dataTransfer.setDragImage(cardRef.current, 20, 20);
                onDragStart?.();
              }}
              onDragEnd={onDragEnd}
              onKeyDown={(e) => {
                // Alternativa de teclado al arrastre: flechas mueven la card.
                if (e.key === "ArrowLeft" && onMoveLeft) {
                  e.preventDefault();
                  onMoveLeft();
                } else if (e.key === "ArrowRight" && onMoveRight) {
                  e.preventDefault();
                  onMoveRight();
                }
              }}
              title={t("card.gripTitle")}
              aria-label={t("card.gripAria")}
            >
              <IconGrip />
            </button>
            <button
              type="button"
              className="icon-btn prod-card__move"
              onClick={onMoveLeft}
              disabled={!onMoveLeft}
              title={t("card.moveLeft")}
              aria-label={t("card.moveLeft")}
            >
              ‹
            </button>
            <button
              type="button"
              className="icon-btn prod-card__move"
              onClick={onMoveRight}
              disabled={!onMoveRight}
              title={t("card.moveRight")}
              aria-label={t("card.moveRight")}
            >
              ›
            </button>
            <div className="prod-card__title">
              <strong>{config.species}</strong>{" "}
              <span className="muted">{t("common.level", { level: config.level })}</span>
              {(() => {
                const idx = RIBBONS.findIndex((r) => r.name === config.ribbon);
                return idx > 0 ? (
                  <RibbonIcon
                    index={idx}
                    size={16}
                    title={t("member.ribbon", { hours: RIBBONS[idx].hours })}
                  />
                ) : null;
              })()}
            </div>
          </div>
          {/* Fila de altura reservada: evita que las cards salten al pasar de 1 a 2
              (cuando aparecen el chip "Base" / el botón "Hacer base"). */}
          <div className="prod-card__base-row">
            {comparing &&
              (isBase ? (
                <span className="prod-card__base-tag" title={t("card.baseTitle")}>
                  {t("card.base")}
                </span>
              ) : (
                <button
                  type="button"
                  className="prod-card__base-tag prod-card__base-tag--action"
                  onClick={onMakeBase}
                  title={t("card.makeBaseTitle")}
                >
                  {t("card.makeBase")}
                </button>
              ))}
          </div>
          {/* Sprite centrado: foco visual de la card. */}
          {species && (
            <img className="prod-card__sprite" src={spriteUrl(species.dex)} alt="" loading="lazy" />
          )}
        </header>

      <div className="prod-card__tags">
        <div className="icon-row">
          {config.ingredients.map((ing, i) => {
            const locked = config.level < (INGREDIENT_UNLOCK_LEVELS[i] ?? 1);
            return (
              <img
                key={i}
                className={"mini-icon" + (locked ? " mini-icon--locked" : "")}
                src={ingredientIcon(ing)}
                alt={ingredient(ing)}
                title={
                  locked
                    ? t("card.ingredientLocked", {
                        ing: ingredient(ing),
                        level: INGREDIENT_UNLOCK_LEVELS[i],
                      })
                    : ingredient(ing)
                }
              />
            );
          })}
        </div>
        <div className="icon-row">
          {config.sub_skills.length === 0 && <span className="muted">{t("card.noSubSkills")}</span>}
          {config.sub_skills.map((s, i) => {
            const unlock = SUB_SKILL_UNLOCK_LEVELS[i] ?? SUB_SKILL_NEVER_UNLOCKS;
            const locked = config.level < unlock;
            const title = !locked
              ? subSkill(s)
              : Number.isFinite(unlock)
                ? t("card.subSkillLocked", { name: subSkill(s), level: unlock })
                : t("card.subSkillSlotUnavailable", { name: subSkill(s) });
            return (
              <span
                key={i}
                className={`ss-icon ss-icon--${tierClass(s)}` + (locked ? " is-locked" : "")}
                title={title}
              >
                <img src={subSkillIcon(s)} alt={subSkill(s)} />
              </span>
            );
          })}
        </div>
        <div className="icon-row prod-card__nature">
          {!config.nature ? (
            <span className="muted">{t("card.noNature")}</span>
          ) : nature && !nature.neutral && nature.increased && nature.decreased ? (
            <>
              <span className="nat-up">↑</span>
              <img className="mini-icon" src={statIcon(nature.increased)} alt={natureStat(nature.increased)} title={natureStat(nature.increased)} />
              <span className="nat-down">↓</span>
              <img className="mini-icon" src={statIcon(nature.decreased)} alt={natureStat(nature.decreased)} title={natureStat(nature.decreased)} />
              <span className="muted">{natureName(config.nature)}</span>
            </>
          ) : (
            <span className="muted">{natureName(config.nature)}</span>
          )}
        </div>
      </div>

      {!d ? (
        productionError ? (
          <p className="error prod-card__calc" role="alert">
            {productionError.message}
          </p>
        ) : (
          <p className="muted prod-card__calc">{t("card.calculating")}</p>
        )
      ) : (
        <>
          <div className="prod-card__line">
            <span title={t("card.helpCadence")}>
              <IconClock /> {mmss(d.seconds_per_help)}
            </span>
            <span title={t("card.helpsPerDay")}>
              <IconHelp /> {fmt(d.helps_per_day)} <Delta value={d.helps_per_day} base={base?.helps_per_day} />
            </span>
          </div>

          <div className="prod-card__line">
            <span title={t("card.inventory")}>
              <IconPackage /> {d.inventory}
            </span>
            <span title={t("card.fillsIn")}>
              <IconHourglass /> {hms(d.inventory_fill_hours)}
            </span>
          </div>

          <div className="prod-card__block prod-card__block--berry">
            <div className="prod-card__block-head">
              {t("card.berries")} <span className="muted">{pct(d.berry_percentage)}</span>
            </div>
            <ul className="prod-card__ings">
              <li>
                {species && (
                  <img className="mini-icon" src={berryIcon(species.berry)} alt={berry(d.berry)} title={berry(d.berry)} />
                )}
                <strong>{fmt(d.berry_amount)}</strong>
                <Delta value={d.berry_amount} base={base?.berry_amount} />
              </li>
            </ul>
          </div>

          <div className="prod-card__block prod-card__block--ing">
            <div className="prod-card__block-head">
              {t("card.ingredientsBlock")}{" "}
              <span className="muted">
                {pct(d.ingredient_percentage)}
                {skillIng.size > 0 && ` ${t("card.plusSkill")}`}
              </span>
            </div>
            <ul className="prod-card__ings">
              {combined.map((g) => (
                <li key={g.ingredient}>
                  <img className="mini-icon" src={ingredientIcon(g.ingredient)} alt={ingredient(g.ingredient)} title={ingredient(g.ingredient)} />
                  <strong>{fmt(g.total)}</strong>
                  <Delta value={g.total} base={baseIng.get(g.ingredient)} />
                  {g.fromSkill > 0 && (
                    <span className="prod-ing__breakdown" title={t("card.breakdownTitle")}>
                      <img src={statIcon("Ingredient Finding")} alt="" title={t("card.normalTitle")} />{" "}
                      {fmt(g.fromNormal)}
                      <img src={statIcon("Main Skill Chance")} alt="" title={t("card.skillTitle")} /> {fmt(g.fromSkill)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="prod-card__block prod-card__block--skill">
            <div className="prod-card__block-head">
              {t("card.skill")} <span className="muted">{pct(d.effective_skill_percentage)}</span>
            </div>
            <div className="prod-card__line">
              <span title={t("card.triggersTitle")}>
                <IconSparkle /> {fmt(d.skill_triggers)} <Delta value={d.skill_triggers} base={base?.skill_triggers} />
              </span>
            </div>
            {d.skill_energy != null && (
              <div className="prod-card__line">
                <span title={t("card.energyEachTitle")}>
                  <img className="mini-icon" src={statIcon("Energy Recovery")} alt="" />{" "}
                  {fmt(d.skill_energy)} <Delta value={d.skill_energy} base={base?.skill_energy ?? null} />
                  <span className="muted"> {t("card.energyEach")}</span>
                </span>
              </div>
            )}
            {d.skill_ingredient_total != null && (
              <div className="prod-card__line">
                <span title={t("card.randomIngredientsTitle")}>
                  <img className="mini-icon" src={statIcon("Ingredient Finding")} alt="" />{" "}
                  {fmt(d.skill_ingredient_total)}{" "}
                  <Delta value={d.skill_ingredient_total} base={base?.skill_ingredient_total ?? null} />
                  <span className="muted"> {t("card.randomIngredients")}</span>
                </span>
              </div>
            )}
            {d.skill_cooking_ingredients != null && (
              <div className="prod-card__line">
                <span title={t("card.cookingTitle")}>
                  <IconPot /> {fmt(d.skill_cooking_ingredients)}{" "}
                  <Delta value={d.skill_cooking_ingredients} base={base?.skill_cooking_ingredients ?? null} />
                  <span className="muted"> {t("card.cookingExtra")}</span>
                </span>
              </div>
            )}
            {d.skill_strength != null && (
              <div className="prod-card__line">
                <span title={t("card.strengthTitle")}>
                  <IconStrength /> {fmtInt(d.skill_strength)}{" "}
                  <Delta value={d.skill_strength} base={base?.skill_strength ?? null} />
                  <span className="muted"> {t("card.strength")}</span>
                </span>
              </div>
            )}
            {d.skill_dream_shards != null && (
              <div className="prod-card__line">
                <span title={t("card.dreamShardsTitle")}>
                  <img className="mini-icon" src="/shard.png" alt="" />{" "}
                  {fmtInt(d.skill_dream_shards)}{" "}
                  <Delta value={d.skill_dream_shards} base={base?.skill_dream_shards ?? null} />
                  <span className="muted"> {t("card.dreamShards")}</span>
                </span>
              </div>
            )}
            {d.skill_tasty_chance != null && (
              <div className="prod-card__line">
                <span title={t("card.extraTastyTitle")}>
                  <img className="mini-icon" src="/extra-tasty.png" alt="" />{" "}
                  +{fmtInt(d.skill_tasty_chance)}%{" "}
                  <Delta value={d.skill_tasty_chance} base={base?.skill_tasty_chance ?? null} />
                  <span className="muted"> {t("card.extraTasty")}</span>
                </span>
              </div>
            )}
            {d.skill_extra_helpful != null && (
              <div className="prod-card__line">
                <span title={t("card.helpMultTitle")}>
                  <IconMagnifier /> ×{fmt(d.skill_extra_helpful)}{" "}
                  <Delta value={d.skill_extra_helpful} base={base?.skill_extra_helpful ?? null} />
                  <span className="muted"> {t("card.helpMult")}</span>
                </span>
              </div>
            )}
            {d.skill_self_energy != null && (
              <div className="prod-card__line">
                <span title={t("card.selfEnergyTitle")}>
                  <img className="mini-icon" src={statIcon("Energy Recovery")} alt="" />{" "}
                  {fmt(d.skill_self_energy)} <Delta value={d.skill_self_energy} base={base?.skill_self_energy ?? null} />
                  <span className="muted"> {t("card.selfEnergy")}</span>
                </span>
              </div>
            )}
            {d.skill_random_energy != null && (
              <div className="prod-card__line">
                <span title={t("card.randomEnergyTitle")}>
                  <img className="mini-icon" src={statIcon("Energy Recovery")} alt="" />{" "}
                  {fmt(d.skill_random_energy)} <Delta value={d.skill_random_energy} base={base?.skill_random_energy ?? null} />
                  <span className="muted"> {t("card.randomEnergy")}</span>
                </span>
              </div>
            )}
            <div className="prod-card__night">
              {d.night_skill_chances.length >= 2 ? (
                <>
                  <span title={t("card.nightOnceTitle")}>
                    <IconMoon />
                    <span className="muted">{t("card.nightOnce")}</span>{" "}
                    {pct((d.night_skill_chances[0] - d.night_skill_chances[1]) * 100)}
                  </span>
                  <span title={t("card.nightTwiceTitle")}>
                    <IconMoon />
                    <span className="muted">{t("card.nightTwice")}</span> {pct(d.night_skill_chances[1] * 100)}
                  </span>
                </>
              ) : d.night_skill_chances.length === 1 ? (
                <span title={t("card.nightSleepTitle")}>
                  <IconMoon />
                  <span className="muted">{t("card.nightSleep")}</span> {pct(d.night_skill_chances[0] * 100)}
                </span>
              ) : (
                <span title={t("card.nightSleepTitle")}>
                  <IconMoon />
                  <span className="muted">{t("card.nightSleep")}</span> {t("common.dash")}
                </span>
              )}
            </div>
          </div>
        </>
      )}
      </article>
    </div>
  );
}
