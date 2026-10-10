import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { berryIcon } from "../berries";
import {
  INGREDIENT_UNLOCK_LEVELS,
  RIBBONS,
  SUB_SKILL_NEVER_UNLOCKS,
  SUB_SKILL_UNLOCK_LEVELS,
} from "../constants";
import { expertMarks, type MetricMark } from "../expertMarks";
import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { statIcon } from "../natures";
import {
  BERRY_JUICE_ICON,
  CHARGE_STRENGTH_ICON,
  GENERIC_BERRY_ICON,
  GENERIC_CANDY_ICON,
  POT_EXPANSION_ICON,
} from "../skillIcons";
import { spriteUrl } from "../sprites";
import { unmodeledSkillKey } from "../skills";
import { subSkillIcon } from "../subskills";
import { effectiveSkill } from "../versatile";
import type {
  BerryRole,
  BerryYield,
  Catalog,
  ExpertSpeed,
  MemberInput,
  Production,
  WeeklyBonus,
} from "../types";
import { RibbonIcon } from "./RibbonIcon";
import { FillTime } from "./FillTime";
import { NaturePill } from "./NaturePill";
import { SleepSkillGrid } from "./SleepSkillGrid";
import { Tooltip } from "./Tooltip";
import {
  IconAlert,
  IconBackpack,
  IconClose,
  IconCopy,
  IconEdit,
  IconHelp,
  IconMagnifier,
  IconSaveBox,
  IconSparkle,
  IconStopwatch,
} from "./icons";

const fmt = (n: number) => n.toFixed(2);
// Magnitudes grandes (fuerza, fragmentos de sueño): enteros con separador de miles.
const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");

const sumYields = (ys: BerryYield[] | null, key: "amount" | "strength") =>
  (ys ?? []).reduce((s, y) => s + y[key], 0);

// Strength the card reports: berries (own skill berries included) + strength skills
// + berries obtained from teammates (team only).
const cardStrength = (p: Production) =>
  p.berry_strength + (p.skill_strength ?? 0) + sumYields(p.teammate_berries, "strength");
const pct = (n: number) => `${n.toFixed(1)}%`;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const TIER_CLASS: Record<string, string> = { Gold: "gold", Blue: "blue", Regular: "regular" };

// Diferencia de un valor contra la base (la primera card). Verde si esta config
// rinde más, rojo si rinde menos. No se muestra en la card base ni cuando no hay
// un valor base comparable (p. ej. un ingrediente que la base no produce).
function Delta({ value, base }: { value: number; base: number | null | undefined }) {
  if (base == null) return null;
  const diff = value - base;
  if (Math.abs(diff) < 0.005) return <span className="prod-delta prod-delta--same">≈</span>;
  const cls = diff > 0 ? "prod-delta--up" : "prod-delta--down";
  // Shape (▲/▼) carries the direction too, so it doesn't rest on color alone.
  return (
    <span className={`prod-delta ${cls}`}>
      <span aria-hidden="true">{diff > 0 ? "▲" : "▼"}</span>
      <span className="sr-only">{diff > 0 ? "+" : "−"}</span>
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
  // chip "Base". comparing controla si se ofrece "Hacer base".
  isBase?: boolean;
  comparing?: boolean;
  // Modo solo lectura: oculta la barra de acciones (editar/clonar/guardar/mover/arrastre)
  // y los deltas/chip "Base". Conserva el botón × (onRemove) para poder quitar la card.
  readOnly?: boolean;
  /** Cabecera de slot (página de Equipos): reemplaza la toolbar readOnly por este
   *  nodo (pestañas de split + slider). Sin efecto fuera de readOnly. */
  slotHeader?: ReactNode;
  /** Inline message shown at the top of the card body (e.g. a failed save). */
  notice?: ReactNode;
  onEdit: () => void;
  onClone: () => void;
  onRemove: () => void;
  onMakeBase: () => void;
  onSaveToBox: () => void;
  // Reorder: swaps this card with the previous / next one. undefined at the
  // ends (disables the button).
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  cloneDisabled?: boolean;
  inBox?: boolean;
  saveState?: "idle" | "saving" | "saved" | "error";
  saveError?: string | null;
  /** Role of this species' berry relative to the active map. */
  berryRole?: BerryRole;
  expert?: boolean;
  expertSpeed?: ExpertSpeed | null;
  weeklyBonus?: WeeklyBonus;
}

export function ProductionCard({
  config,
  catalog,
  production,
  productionError,
  base,
  isBase,
  comparing,
  readOnly = false,
  slotHeader,
  notice,
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
  berryRole = "none",
  expert = false,
  expertSpeed = null,
  weeklyBonus = "berry_strength",
}: Props) {
  const { t, ingredient, berry, subSkill, nature: natureName } = useI18n();
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
  const ownSkillBerries = d?.skill_berry_amount ?? 0;
  const teammates = d?.teammate_berries ?? null; // null outside a team
  const teammateAmount = sumYields(teammates, "amount");
  const teammateStrength = sumYields(teammates, "strength");
  const teammateIngs = d?.teammate_ingredients ?? [];
  const teammateIngAmount = teammateIngs.reduce((acc, s) => acc + s.amount, 0);

  const unmodeledKey = unmodeledSkillKey(effectiveSkill(species?.main_skill, config.versatile_skill));

  const marks = d
    ? expertMarks({
        role: berryRole,
        expert,
        weeklyBonus,
        speed: expertSpeed,
        skillLevel: config.skill_level,
        effectiveSkillLevel: d.effective_skill_level,
        t,
      })
    : [];

  // A metric can carry more than one mark at once (e.g. the main favorite's
  // "Skill +1" alongside the skill-trigger weekly bonus's "×1,25").
  const markFor = (metric: MetricMark["metric"]) =>
    marks
      .filter((m) => m.metric === metric)
      .map((m) => (
        // A tooltip, not a `title`: a phone has no hover to reveal what the mark does.
        <Tooltip key={m.label} content={m.effect}>
          <span className={`metric-mark metric-mark--${m.tone}`}>{m.label}</span>
        </Tooltip>
      ));

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
          primera fila de la card para el nombre / nivel / listón.
          En modo readOnly solo se muestra el botón × (quitar). */}
      {readOnly ? (
        slotHeader !== undefined ? (
          <div className="prod-card__toolbar prod-card__toolbar--readonly prod-card__toolbar--slot">
            {slotHeader}
          </div>
        ) : (
          <div className="prod-card__toolbar prod-card__toolbar--readonly">
            <span className="prod-card__toolbar-status" aria-hidden="true" />
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
        )
      ) : (
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
      )}
      <article
        className={
          "prod-card" +
          (entering ? " prod-card--enter" : "") +
          (readOnly ? " prod-card--readonly" : "") +
          (berryRole !== "none" ? " prod-card--favorite-berry" : "") +
          (berryRole === "main" ? " prod-card--main-favorite" : "") +
          (expert && berryRole === "none" ? " prod-card--no-favorite" : "")
        }
        onAnimationEnd={(e) => {
          // `appear-in` is shared, so ignore the same animation bubbling up from
          // anything nested inside the card.
          if (e.target === e.currentTarget && e.animationName === "appear-in") {
            setEntering(false);
          }
        }}
      >
        <div className="prod-card__identity">
          {notice}
          <header className="prod-card__head">
            {/* Row 1: reorder ‹ › + name / level / ribbon + base. No reorder when readOnly. */}
            <div className="prod-card__topline">
              {!readOnly && (
                <>
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
                </>
              )}
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
              {/* Base chip / "Make base", at the right of the name. Fits within the
                  name's line, so going from 1 to 2 cards doesn't shift anything. */}
              {!readOnly &&
                comparing &&
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
            <div className="icon-row prod-card__ingredients">
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
                  <Tooltip key={i} content={title}>
                    <span className={`ss-icon ss-icon--${tierClass(s)}` + (locked ? " is-locked" : "")}>
                      <img src={subSkillIcon(s)} alt={subSkill(s)} />
                    </span>
                  </Tooltip>
                );
              })}
            </div>
            <div className="icon-row prod-card__nature">
              {!config.nature ? (
                <span className="muted">{t("card.noNature")}</span>
              ) : (
                <NaturePill nature={nature} name={natureName(config.nature)} />
              )}
            </div>
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
            <span>
              <Tooltip content={t("card.helpCadence")} className="tooltip--inline">
                <IconStopwatch className="prod-card__icon--stopwatch" /> {mmss(d.seconds_per_help)}
              </Tooltip>
              {/* Beside its metric's tooltip, not inside it: one tap, one bubble. */}
              {markFor("cadence")}
            </span>
            <Tooltip content={t("card.helpsPerDay")} className="tooltip--inline">
              <IconHelp className="prod-card__icon--help" /> {fmt(d.helps_per_day)} <Delta value={d.helps_per_day} base={base?.helps_per_day} />
            </Tooltip>
          </div>

          <div className="prod-card__line">
            <Tooltip content={t("card.inventory")} className="tooltip--inline">
              <IconBackpack /> {d.inventory}
            </Tooltip>
            <FillTime fillHours={d.inventory_fill_hours} sessions={d.sleep_sessions} />
          </div>

          <div className="prod-card__block prod-card__block--berry">
            <div className="prod-card__block-head">
              {t("card.berries")} <span className="muted">{pct(d.berry_percentage)}</span>
              {markFor("berries")}
            </div>
            <ul className="prod-card__ings">
              <li>
                {species && (
                  <img className="mini-icon" src={berryIcon(species.berry)} alt={berry(d.berry)} title={berry(d.berry)} />
                )}
                <strong>{fmt(d.berry_amount)}</strong>
                <Delta value={d.berry_amount} base={base?.berry_amount} />
                {ownSkillBerries > 0 && species && (
                  <Tooltip content={t("card.berryBreakdownTitle")} className="tooltip--inline prod-ing__breakdown">
                    <img src={berryIcon(species.berry)} alt="" title={t("card.fromHelpsTitle")} />{" "}
                    {fmt(d.berry_amount - ownSkillBerries)}
                    <img src={statIcon("Main Skill Chance")} alt="" title={t("card.skillTitle")} />{" "}
                    {fmt(ownSkillBerries)}
                  </Tooltip>
                )}
              </li>
              {teammates && teammateAmount > 0 && (
                <li>
                  <img
                    className="mini-icon"
                    src={GENERIC_BERRY_ICON}
                    alt={t("card.teammateBerriesTitle")}
                    title={t("card.teammateBerriesTitle")}
                  />
                  <Tooltip
                    className="tooltip--sources"
                    label={teammates
                      .map((y) => `${berry(y.berry)} ×${fmt(y.amount)}: ${fmtInt(y.strength)}`)
                      .join(" · ")}
                    content={teammates.map((y) => (
                      <Tooltip.Row key={y.berry}>
                        <Tooltip.Label>
                          <img src={berryIcon(y.berry)} alt="" /> {berry(y.berry)} · ×{fmt(y.amount)}
                        </Tooltip.Label>
                        <Tooltip.Value>{fmtInt(y.strength)}</Tooltip.Value>
                      </Tooltip.Row>
                    ))}
                  >
                    <strong className="strength-value__cue">{fmt(teammateAmount)}</strong>
                  </Tooltip>
                </li>
              )}
              {/* Fuerza a Snorlax: DIRECTA por bayas + INDIRECTA por la main skill
                  (Charge Strength). Se muestra acá, no en el bloque skill. */}
              <li>
                <img className="mini-icon" src={CHARGE_STRENGTH_ICON} alt={t("card.strength")} title={t("card.strengthTitle")} />
                <strong>{fmtInt(cardStrength(d))}</strong>
                <Delta value={cardStrength(d)} base={base ? cardStrength(base) : undefined} />
                {species && d.skill_strength != null && (
                  <Tooltip content={t("card.strengthBreakdownTitle")} className="tooltip--inline prod-ing__breakdown">
                    <img src={berryIcon(species.berry)} alt="" title={t("card.fromBerriesTitle")} />{" "}
                    {fmtInt(d.berry_strength)}
                    <img src={statIcon("Main Skill Chance")} alt="" title={t("card.skillTitle")} /> {fmtInt(d.skill_strength)}
                  </Tooltip>
                )}
                {species && d.skill_strength == null && teammateStrength > 0 && (
                  <Tooltip content={t("card.strengthBreakdownTitle")} className="tooltip--inline prod-ing__breakdown">
                    <img src={berryIcon(species.berry)} alt="" title={t("card.fromBerriesTitle")} />{" "}
                    {fmtInt(d.berry_strength)}
                    <img src={GENERIC_BERRY_ICON} alt="" title={t("card.teammateBerriesTitle")} />{" "}
                    {fmtInt(teammateStrength)}
                  </Tooltip>
                )}
                {species && d.skill_strength == null && teammateStrength === 0 && ownSkillBerries > 0 && (
                  <Tooltip content={t("card.strengthBreakdownTitle")} className="tooltip--inline prod-ing__breakdown">
                    <img src={berryIcon(species.berry)} alt="" title={t("card.fromHelpsTitle")} />{" "}
                    {fmtInt(d.berry_strength - (d.skill_berry_strength ?? 0))}
                    <img src={statIcon("Main Skill Chance")} alt="" title={t("card.skillTitle")} />{" "}
                    {fmtInt(d.skill_berry_strength ?? 0)}
                  </Tooltip>
                )}
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
              {markFor("ingredients")}
            </div>
            <ul className="prod-card__ings">
              {combined.map((g) => (
                <li key={g.ingredient}>
                  <img className="mini-icon" src={ingredientIcon(g.ingredient)} alt={ingredient(g.ingredient)} title={ingredient(g.ingredient)} />
                  <strong>{fmt(g.total)}</strong>
                  <Delta value={g.total} base={baseIng.get(g.ingredient)} />
                  {g.fromSkill > 0 && (
                    <Tooltip content={t("card.breakdownTitle")} className="tooltip--inline prod-ing__breakdown">
                      <img src={statIcon("Ingredient Finding")} alt="" title={t("card.normalTitle")} />{" "}
                      {fmt(g.fromNormal)}
                      <img src={statIcon("Main Skill Chance")} alt="" title={t("card.skillTitle")} /> {fmt(g.fromSkill)}
                    </Tooltip>
                  )}
                </li>
              ))}
              {teammateIngAmount > 0 && (
                <li>
                  <img
                    className="mini-icon"
                    src={statIcon("Ingredient Finding")}
                    alt={t("card.teammateIngredientsTitle")}
                    title={t("card.teammateIngredientsTitle")}
                  />
                  <Tooltip
                    className="tooltip--sources"
                    label={teammateIngs.map((s) => `${ingredient(s.ingredient)} ×${fmt(s.amount)}`).join(" · ")}
                    content={teammateIngs.map((s) => (
                      <Tooltip.Row key={s.ingredient}>
                        <Tooltip.Label>
                          <img src={ingredientIcon(s.ingredient)} alt="" /> {ingredient(s.ingredient)}
                        </Tooltip.Label>
                        <Tooltip.Value>×{fmt(s.amount)}</Tooltip.Value>
                      </Tooltip.Row>
                    ))}
                  >
                    <strong className="strength-value__cue">{fmt(teammateIngAmount)}</strong>
                  </Tooltip>
                </li>
              )}
            </ul>
          </div>

          <div className="prod-card__block prod-card__block--skill">
            <div className="prod-card__block-head">
              {t("card.skill")} <span className="muted">{pct(d.effective_skill_percentage)}</span>
              {markFor("skill")}
              {unmodeledKey && (
                <Tooltip className="skill-alert" content={t(unmodeledKey)}>
                  <span tabIndex={0} role="img" aria-label={t(unmodeledKey)}>
                    <IconAlert />
                  </span>
                </Tooltip>
              )}
            </div>
            <div className="prod-card__line">
              <Tooltip content={t("card.triggersTitle")} className="tooltip--inline">
                <IconSparkle /> {fmt(d.skill_triggers)} <Delta value={d.skill_triggers} base={base?.skill_triggers} />
              </Tooltip>
            </div>
            {teammates === null && d.skill_berries_per_teammate != null && (
              <div className="prod-card__line">
                <Tooltip content={t("card.perTeammateTitle")} className="tooltip--inline">
                  <img className="mini-icon" src={GENERIC_BERRY_ICON} alt="" />{" "}
                  +{fmt(d.skill_berries_per_teammate)}{" "}
                  <Delta value={d.skill_berries_per_teammate} base={base?.skill_berries_per_teammate ?? null} />
                  <span className="muted"> {t("card.perTeammate")}</span>
                </Tooltip>
              </div>
            )}
            {d.skill_energy != null && (
              <div className="prod-card__line">
                <Tooltip content={t("card.energyEachTitle")} className="tooltip--inline">
                  <img className="mini-icon" src={statIcon("Energy Recovery")} alt="" />{" "}
                  {fmt(d.skill_energy)} <Delta value={d.skill_energy} base={base?.skill_energy ?? null} />
                  <span className="muted"> {t("card.energyEach")}</span>
                </Tooltip>
              </div>
            )}
            {d.skill_energy_drain != null && (
              <div className="prod-card__line">
                <Tooltip content={t("card.energyDrainTitle")} className="tooltip--inline">
                  <img className="mini-icon" src={statIcon("Energy Recovery")} alt="" />{" "}
                  {fmt(d.skill_energy_drain)} <Delta value={d.skill_energy_drain} base={base?.skill_energy_drain ?? null} />
                  <span className="muted"> {t("card.energyDrain")}</span>
                </Tooltip>
              </div>
            )}
            {d.skill_ingredient_total != null && (
              <div className="prod-card__line">
                <Tooltip content={t("card.randomIngredientsTitle")} className="tooltip--inline">
                  <img className="mini-icon" src={statIcon("Ingredient Finding")} alt="" />{" "}
                  {fmt(d.skill_ingredient_total)}{" "}
                  <Delta value={d.skill_ingredient_total} base={base?.skill_ingredient_total ?? null} />
                  <span className="muted"> {t("card.randomIngredients")}</span>
                </Tooltip>
              </div>
            )}
            {d.skill_cooking_ingredients != null && (
              <div className="prod-card__line">
                <Tooltip content={t("card.cookingTitle")} className="tooltip--inline">
                  <img className="mini-icon" src={POT_EXPANSION_ICON} alt="" />{" "}
                  {fmt(d.skill_cooking_ingredients)}{" "}
                  <Delta value={d.skill_cooking_ingredients} base={base?.skill_cooking_ingredients ?? null} />
                  <span className="muted"> {t("card.cookingExtra")}</span>
                </Tooltip>
              </div>
            )}
            {/* La fuerza por Charge Strength se muestra en el bloque de bayas
                (es aporte de fuerza a Snorlax, junto con la fuerza directa de bayas). */}
            {d.skill_dream_shards != null && (
              <div className="prod-card__line">
                <Tooltip content={t("card.dreamShardsTitle")} className="tooltip--inline">
                  <img className="mini-icon" src="/shard.png" alt="" />{" "}
                  {fmtInt(d.skill_dream_shards)}{" "}
                  <Delta value={d.skill_dream_shards} base={base?.skill_dream_shards ?? null} />
                  <span className="muted"> {t("card.dreamShards")}</span>
                </Tooltip>
              </div>
            )}
            {d.skill_tasty_chance != null && (
              <div className="prod-card__line">
                <Tooltip content={t("card.extraTastyTitle")} className="tooltip--inline">
                  <img className="mini-icon" src="/extra-tasty.png" alt="" />{" "}
                  +{fmtInt(d.skill_tasty_chance)}%{" "}
                  <Delta value={d.skill_tasty_chance} base={base?.skill_tasty_chance ?? null} />
                  <span className="muted"> {t("card.extraTasty")}</span>
                </Tooltip>
              </div>
            )}
            {d.skill_extra_helpful != null && (
              <div className="prod-card__line">
                <Tooltip content={t("card.helpMultTitle")} className="tooltip--inline">
                  <IconMagnifier /> ×{fmt(d.skill_extra_helpful)}{" "}
                  <Delta value={d.skill_extra_helpful} base={base?.skill_extra_helpful ?? null} />
                  <span className="muted">
                    {" "}
                    {t(
                      d.skill_help_targets === 2
                        ? "card.helpMultTwo"
                        : (d.skill_help_targets ?? 1) > 2
                          ? "card.helpMultTeam"
                          : "card.helpMult",
                    )}
                  </span>
                </Tooltip>
              </div>
            )}
            {d.skill_self_energy != null && (
              <div className="prod-card__line">
                <Tooltip content={t("card.selfEnergyTitle")} className="tooltip--inline">
                  <img className="mini-icon" src={statIcon("Energy Recovery")} alt="" />{" "}
                  {fmt(d.skill_self_energy)} <Delta value={d.skill_self_energy} base={base?.skill_self_energy ?? null} />
                  <span className="muted"> {t("card.selfEnergy")}</span>
                </Tooltip>
              </div>
            )}
            {d.skill_random_energy != null && (
              <div className="prod-card__line">
                <Tooltip content={t("card.randomEnergyTitle")} className="tooltip--inline">
                  <img className="mini-icon" src={statIcon("Energy Recovery")} alt="" />{" "}
                  {fmt(d.skill_random_energy)} <Delta value={d.skill_random_energy} base={base?.skill_random_energy ?? null} />
                  <span className="muted"> {t("card.randomEnergy")}</span>
                </Tooltip>
              </div>
            )}
            {d.skill_candy != null && (
              <div className="prod-card__line">
                <Tooltip content={t("card.candyTitle")} className="tooltip--inline">
                  <img className="mini-icon mini-icon--candy" src={GENERIC_CANDY_ICON} alt="" />{" "}
                  {fmt(d.skill_candy)} <Delta value={d.skill_candy} base={base?.skill_candy ?? null} />
                  <span className="muted"> {t("card.candy")}</span>
                </Tooltip>
              </div>
            )}
            {d.skill_berry_juice != null && (
              <div className="prod-card__line">
                <Tooltip content={t("card.berryJuiceTitle")} className="tooltip--inline">
                  <img className="mini-icon" src={BERRY_JUICE_ICON} alt="" />{" "}
                  {fmt(d.skill_berry_juice)} <Delta value={d.skill_berry_juice} base={base?.skill_berry_juice ?? null} />
                  <span className="muted"> {t("card.berryJuice")}</span>
                </Tooltip>
              </div>
            )}
            <div className="prod-card__night">
              <SleepSkillGrid sessions={d.sleep_sessions} />
            </div>
          </div>
        </>
      )}
      </article>
    </div>
  );
}
