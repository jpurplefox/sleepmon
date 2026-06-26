import { useMemo, useRef } from "react";

import { berryIcon } from "../berries";
import { INGREDIENT_UNLOCK_LEVELS, RIBBONS, SUB_SKILL_UNLOCK_LEVELS } from "../constants";
import { ingredientIcon } from "../ingredients";
import { statIcon } from "../natures";
import { spriteUrl } from "../sprites";
import { subSkillIcon } from "../subskills";
import type { Catalog, MemberInput, Production } from "../types";
import { RibbonIcon } from "./RibbonIcon";
import {
  IconClock,
  IconGrip,
  IconHelp,
  IconHourglass,
  IconMoon,
  IconPackage,
  IconSaveBox,
  IconSparkle,
} from "./icons";

const fmt = (n: number) => n.toFixed(2);
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
  if (Math.abs(diff) < 0.005) return <span className="prod-delta prod-delta--same">=</span>;
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
  isBase?: boolean;
  onEdit: () => void;
  onClone: () => void;
  onRemove: () => void;
  onSaveToBox: () => void;
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
  onEdit,
  onClone,
  onRemove,
  onSaveToBox,
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
  const cardRef = useRef<HTMLElement>(null);
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

  // Mismo agrupado para la base: permite el delta por ingrediente cuando ambas
  // cards comparten ese ingrediente (el caso típico al clonar una variante).
  const baseIng = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of base?.ingredients ?? []) {
      map.set(s.ingredient, (map.get(s.ingredient) ?? 0) + s.amount);
    }
    return map;
  }, [base]);

  return (
    <article
      ref={cardRef}
      className={
        "prod-card" +
        (isBase ? " prod-card--base" : "") +
        (dragging ? " prod-card--dragging" : "") +
        (dragOver ? " prod-card--dragover" : "")
      }
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
    >
      <header className="prod-card__head">
        <div className="prod-card__topline">
          {species && (
            <img className="prod-card__sprite" src={spriteUrl(species.dex)} alt="" loading="lazy" />
          )}
          <div className="prod-card__actions">
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
              title="Arrastrar para reordenar (la primera card es la base)"
              aria-label="Arrastrar para reordenar"
            >
              <IconGrip />
            </button>
            <button type="button" className="icon-btn" onClick={onEdit} title="Editar" aria-label="Editar">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={onClone}
              disabled={cloneDisabled}
              title={cloneDisabled ? "Máximo 5 en la comparación" : "Clonar"}
              aria-label="Clonar"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="8" y="8" width="14" height="14" rx="2" ry="2" />
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
              </svg>
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={onSaveToBox}
              disabled={saveState === "saving"}
              title={inBox ? "Guardar cambios en la caja" : "Guardar en la caja"}
              aria-label={inBox ? "Guardar cambios en la caja" : "Guardar en la caja"}
            >
              <IconSaveBox />
            </button>
            <button type="button" className="icon-btn" onClick={onRemove} title="Quitar" aria-label="Quitar">
              ×
            </button>
          </div>
        </div>
        <div className="prod-card__title">
          <strong>{config.species}</strong> <span className="muted">Nv.&nbsp;{config.level}</span>
          {(() => {
            const idx = RIBBONS.findIndex((r) => r.name === config.ribbon);
            return idx > 0 ? (
              <RibbonIcon index={idx} size={20} title={`Listón ${RIBBONS[idx].hours} h`} />
            ) : null;
          })()}
          {isBase && (
            <span className="prod-card__base-tag" title="Base de la comparación: el resto se mide contra esta card">
              base
            </span>
          )}
        </div>
        {saveState === "saving" && <p className="prod-card__save muted">Guardando…</p>}
        {saveState === "saved" && <p className="prod-card__save prod-card__save--ok">Guardado</p>}
        {saveState === "error" && (
          <p className="prod-card__save error">{saveError ?? "No se pudo guardar."}</p>
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
                alt={ing}
                title={locked ? `${ing} (se activa a nivel ${INGREDIENT_UNLOCK_LEVELS[i]})` : ing}
              />
            );
          })}
        </div>
        <div className="icon-row">
          {config.sub_skills.length === 0 && <span className="muted">sin sub skills</span>}
          {config.sub_skills.map((s, i) => {
            const unlock = SUB_SKILL_UNLOCK_LEVELS[i] ?? 999;
            const locked = config.level < unlock;
            return (
              <span
                key={i}
                className={`ss-icon ss-icon--${tierClass(s)}` + (locked ? " is-locked" : "")}
                title={locked ? `${s} (se activa a nivel ${unlock})` : s}
              >
                <img src={subSkillIcon(s)} alt={s} />
              </span>
            );
          })}
        </div>
        <div className="icon-row prod-card__nature">
          {!config.nature ? (
            <span className="muted">Sin naturaleza</span>
          ) : nature && !nature.neutral && nature.increased && nature.decreased ? (
            <>
              <span className="up">↑</span>
              <img className="mini-icon" src={statIcon(nature.increased)} alt={nature.increased} title={nature.increased} />
              <span className="down">↓</span>
              <img className="mini-icon" src={statIcon(nature.decreased)} alt={nature.decreased} title={nature.decreased} />
              <span className="muted">{config.nature}</span>
            </>
          ) : (
            <span className="muted">{config.nature}</span>
          )}
        </div>
      </div>

      {!d ? (
        productionError ? (
          <p className="error">{productionError.message}</p>
        ) : (
          <p className="muted">Calculando…</p>
        )
      ) : (
        <>
          <div className="prod-card__line">
            <span title="Cadencia de ayuda">
              <IconClock /> {mmss(d.seconds_per_help)}
            </span>
            <span title="Ayudas por día">
              <IconHelp /> {fmt(d.helps_per_day)} <Delta value={d.helps_per_day} base={base?.helps_per_day} />
            </span>
          </div>

          <div className="prod-card__line">
            <span title="Inventario">
              <IconPackage /> {d.inventory}
            </span>
            <span title="Se llena en">
              <IconHourglass /> {hms(d.inventory_fill_hours)}
            </span>
          </div>

          <div className="prod-card__block">
            <div className="prod-card__block-head">
              Bayas <span className="muted">{pct(d.berry_percentage)}</span>
            </div>
            <ul className="prod-card__ings">
              <li>
                {species && (
                  <img className="mini-icon" src={berryIcon(species.berry)} alt={d.berry} title={d.berry} />
                )}
                <strong>{fmt(d.berry_amount)}</strong>
                <Delta value={d.berry_amount} base={base?.berry_amount} />
              </li>
            </ul>
          </div>

          <div className="prod-card__block">
            <div className="prod-card__block-head">
              Ingredientes <span className="muted">{pct(d.ingredient_percentage)}</span>
            </div>
            <ul className="prod-card__ings">
              {grouped.map((g) => (
                <li key={g.ingredient}>
                  <img className="mini-icon" src={ingredientIcon(g.ingredient)} alt={g.ingredient} title={g.ingredient} />
                  <strong>{fmt(g.amount)}</strong>
                  <Delta value={g.amount} base={baseIng.get(g.ingredient)} />
                </li>
              ))}
            </ul>
          </div>

          <div className="prod-card__block">
            <div className="prod-card__block-head">
              Skill <span className="muted">{pct(d.effective_skill_percentage)}</span>
            </div>
            <div className="prod-card__line">
              <span title="Activaciones de skill por día">
                <IconSparkle /> {fmt(d.skill_triggers)} <Delta value={d.skill_triggers} base={base?.skill_triggers} />
              </span>
            </div>
            <div className="prod-card__night">
              <IconMoon className="prod-card__moon" />
              {d.night_skill_chances.length >= 2 ? (
                <>
                  <span title="Probabilidad de activar la skill exactamente 1 vez mientras dormís">
                    <span className="muted">1 vez</span>{" "}
                    {pct((d.night_skill_chances[0] - d.night_skill_chances[1]) * 100)}
                  </span>
                  <span title="Probabilidad de activar la skill 2 veces mientras dormís (el tope)">
                    <span className="muted">2 veces</span> {pct(d.night_skill_chances[1] * 100)}
                  </span>
                </>
              ) : (
                <span title="Probabilidad de activar la skill mientras dormís">
                  <span className="muted">al dormir</span> {pct(d.night_skill_chances[0] * 100)}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </article>
  );
}
