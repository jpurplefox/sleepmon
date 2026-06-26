import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { api } from "../api/client";
import { berryIcon } from "../berries";
import { INGREDIENT_UNLOCK_LEVELS, SUB_SKILL_UNLOCK_LEVELS } from "../constants";
import { ingredientIcon } from "../ingredients";
import { statIcon } from "../natures";
import { spriteUrl } from "../sprites";
import { subSkillIcon } from "../subskills";
import type { Catalog, MemberInput } from "../types";
import {
  IconClock,
  IconHelp,
  IconHourglass,
  IconMoon,
  IconPackage,
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

interface Props {
  config: MemberInput;
  catalog: Catalog;
  onEdit: () => void;
  onRemove: () => void;
}

export function ProductionCard({ config, catalog, onEdit, onRemove }: Props) {
  const species = catalog.species.find((s) => s.name === config.species);
  const nature = catalog.natures.find((n) => n.name === config.nature);
  const tierClass = (name: string) =>
    TIER_CLASS[catalog.sub_skills.find((s) => s.name === name)?.tier ?? "Regular"];

  const production = useQuery({
    queryKey: ["production", config],
    queryFn: () =>
      api.computeProduction({
        species: config.species,
        level: config.level,
        ingredients: config.ingredients,
        nature: config.nature,
        sub_skills: config.sub_skills,
      }),
  });

  // Si dos slots dan el mismo ingrediente, se muestra una vez sumando.
  const grouped = useMemo(() => {
    if (!production.data) return [];
    const map = new Map<string, number>();
    for (const s of production.data.ingredients) {
      map.set(s.ingredient, (map.get(s.ingredient) ?? 0) + s.amount);
    }
    return [...map.entries()].map(([ingredient, amount]) => ({ ingredient, amount }));
  }, [production.data]);

  const d = production.data;

  return (
    <article className="prod-card">
      <header className="prod-card__head">
        <div className="prod-card__topline">
          {species && (
            <img className="prod-card__sprite" src={spriteUrl(species.dex)} alt="" loading="lazy" />
          )}
          <div className="prod-card__actions">
            <button type="button" className="icon-btn" onClick={onEdit} title="Editar" aria-label="Editar">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
            <button type="button" className="icon-btn" onClick={onRemove} title="Quitar" aria-label="Quitar">
              ×
            </button>
          </div>
        </div>
        <div className="prod-card__title">
          <strong>{config.species}</strong> <span className="muted">Nv.&nbsp;{config.level}</span>
        </div>
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
        production.isError ? (
          <p className="error">{(production.error as Error).message}</p>
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
              <IconHelp /> {fmt(d.helps_per_day)}
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
                <IconSparkle /> {fmt(d.skill_triggers)}
              </span>
            </div>
            <div className="prod-card__night">
              <IconMoon className="prod-card__moon" />
              {d.night_skill_chances.length >= 2 ? (
                <>
                  <span title="Probabilidad de exactamente 1 activación al dormir">
                    <span className="muted">1 disparo</span>{" "}
                    {pct((d.night_skill_chances[0] - d.night_skill_chances[1]) * 100)}
                  </span>
                  <span title="Probabilidad de 2 activaciones al dormir (el tope)">
                    <span className="muted">2 disparos</span> {pct(d.night_skill_chances[1] * 100)}
                  </span>
                </>
              ) : (
                <span title="Probabilidad de disparar la skill al dormir">
                  <span className="muted">skill al dormir</span> {pct(d.night_skill_chances[0] * 100)}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </article>
  );
}
