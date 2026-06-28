import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

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
import type { Catalog, Member } from "../types";
import { IconMoon } from "./icons";
import { RibbonIcon } from "./RibbonIcon";

const TIER_CLASS: Record<string, string> = { Gold: "gold", Blue: "blue", Regular: "regular" };

// Normaliza para buscar: sin mayúsculas ni acentos, así "ralts" matchea "Ralts" y
// "pikachú" matchea "Pikachu".
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

interface Props {
  members: Member[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  catalog: Catalog;
  // ids de origen ya presentes en la comparación: no se pueden agregar dos veces.
  inComparison: Set<string>;
  onPick: (m: Member) => void;
}

// Picker "Mis Pokémon" del comparador. Vive en su propio componente para que el
// filtro de búsqueda se resetee al cerrar y reabrir el modal (se desmonta), y para
// no recargar Production con su estado local. Cada ítem muestra la config completa
// —derivada del propio Pokémon— para poder distinguir duplicados de un vistazo,
// reusando el mismo lenguaje visual que la Caja (MemberCard).
export function BoxPicker({
  members,
  isLoading,
  isError,
  onRetry,
  catalog,
  inComparison,
  onPick,
}: Props) {
  const { t, nature: natureLabel, natureStat, ingredient, subSkill } = useI18n();
  const [search, setSearch] = useState("");
  // Índice resaltado dentro de la lista filtrada (-1 = ninguno). Patrón combobox:
  // el foco se queda en el buscador; las flechas mueven este resaltado y Enter
  // agrega el resaltado. Así se puede seguir tipeando sin perder el teclado.
  const [highlighted, setHighlighted] = useState(-1);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  // Mantener el ítem resaltado a la vista al navegar con flechas.
  useEffect(() => {
    if (highlighted < 0 || !listRef.current) return;
    listRef.current
      .querySelector<HTMLElement>(`#${CSS.escape(`${listId}-opt-${highlighted}`)}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [highlighted, listId]);

  // Mapa especie→dex (sprite) y sub skill→tier, una sola vez por catálogo.
  const dexBySpecies = useMemo(
    () => new Map(catalog.species.map((s) => [s.name, s.dex])),
    [catalog.species],
  );
  const tierBySubSkill = useMemo(
    () => new Map(catalog.sub_skills.map((s) => [s.name, s.tier])),
    [catalog.sub_skills],
  );
  const natureByName = useMemo(
    () => new Map(catalog.natures.map((n) => [n.name, n])),
    [catalog.natures],
  );

  if (isLoading)
    return (
      <p className="muted" role="status">
        {t("team.loadingBox")}
      </p>
    );

  if (isError)
    return (
      <p className="error" role="alert">
        {t("prod.boxErrorRetry")}{" "}
        <button type="button" className="btn btn--ghost" onClick={onRetry}>
          {t("common.retry")}
        </button>
      </p>
    );

  if (!members || members.length === 0)
    return <p className="muted">{t("prod.boxEmptyTab")}</p>;

  // Filtra por nombre de especie. Hoy las especies no tienen traducción propia
  // (no hay tSpecies en i18n): m.species es el nombre canónico que también se
  // muestra. Si se agrega traducción de especies, filtrar por ese nombre.
  const q = normalize(search);
  const filtered = q ? members.filter((m) => normalize(m.species).includes(q)) : members;

  // Índices (dentro de filtered) que se pueden elegir: excluye los que ya están
  // en la comparación. Las flechas saltan entre estos; Enter agrega el resaltado.
  const selectable = filtered.flatMap((m, i) => (inComparison.has(m.id) ? [] : [i]));

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (selectable.length === 0) return;
      e.preventDefault();
      const pos = selectable.indexOf(highlighted);
      const next =
        e.key === "ArrowDown"
          ? selectable[(pos + 1) % selectable.length]
          : selectable[(pos - 1 + selectable.length) % selectable.length];
      setHighlighted(next);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // El resaltado si es válido; si no, el primero seleccionable. Sin resultados
      // seleccionables no hace nada (el vacío ya da feedback).
      const idx = selectable.includes(highlighted) ? highlighted : selectable[0];
      if (idx !== undefined) onPick(filtered[idx]);
    }
  };

  return (
    <>
      <input
        data-autofocus
        type="search"
        role="combobox"
        className="prod-box-search"
        placeholder={t("prod.boxSearch")}
        aria-label={t("prod.boxSearchAria")}
        aria-controls={listId}
        aria-expanded={filtered.length > 0}
        aria-autocomplete="list"
        aria-activedescendant={highlighted >= 0 ? `${listId}-opt-${highlighted}` : undefined}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setHighlighted(-1);
        }}
        onKeyDown={onSearchKeyDown}
      />

      {/* Anuncio del conteo de resultados al filtrar, para lectores de pantalla;
          el caso 0 lo cubre el mensaje visible de vacío (también role=status). */}
      <span className="sr-only" role="status" aria-live="polite">
        {search && filtered.length > 0
          ? filtered.length === 1
            ? t("prod.boxResultOne")
            : t("prod.boxResultCount", { count: filtered.length })
          : ""}
      </span>

      {filtered.length === 0 ? (
        <p className="muted prod-box-empty" role="status">
          {t("prod.boxSearchEmpty", { query: search })}
        </p>
      ) : (
        <ul id={listId} className="prod-box-list" role="listbox" ref={listRef}>
          {filtered.map((m, idx) => {
            const already = inComparison.has(m.id);
            const nature = natureByName.get(m.nature);
            const ribbonIdx = RIBBONS.findIndex((r) => r.name === m.ribbon);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  id={`${listId}-opt-${idx}`}
                  role="option"
                  aria-selected={highlighted === idx}
                  tabIndex={-1}
                  className={"prod-box-item" + (highlighted === idx ? " is-highlighted" : "")}
                  onClick={() => onPick(m)}
                  onMouseMove={() => !already && setHighlighted(idx)}
                  disabled={already}
                >
                  <div className="prod-box-item__topline">
                    <img
                      className="sprite"
                      src={spriteUrl(dexBySpecies.get(m.species) ?? 0)}
                      alt=""
                      loading="lazy"
                    />
                    <span className="prod-box-item__name">{m.species}</span>
                    {ribbonIdx > 0 && (
                      <RibbonIcon
                        index={ribbonIdx}
                        size={18}
                        title={t("member.ribbon", { hours: RIBBONS[ribbonIdx].hours })}
                      />
                    )}
                    {already && <span className="prod-box-item__tag">{t("prod.alreadyIn")}</span>}
                    {/* El nivel (único dorado del topline) queda siempre al extremo
                        derecho, independientemente de listón o tag. */}
                    <span className="badge badge--level">
                      {t("common.level", { level: m.level })}
                    </span>
                  </div>

                  <div className="prod-box-item__config">
                    <span className="prod-box-item__nature icon-row">
                      {nature && !nature.neutral && nature.increased && nature.decreased ? (
                        <>
                          <span className="nat-up">↑</span>
                          <img
                            className="mini-icon"
                            src={statIcon(nature.increased)}
                            alt={natureStat(nature.increased)}
                            title={natureStat(nature.increased)}
                          />
                          <span className="nat-down">↓</span>
                          <img
                            className="mini-icon"
                            src={statIcon(nature.decreased)}
                            alt={natureStat(nature.decreased)}
                            title={natureStat(nature.decreased)}
                          />
                        </>
                      ) : (
                        <span className="muted">
                          {m.nature ? natureLabel(m.nature) : t("card.noNature")}
                        </span>
                      )}
                    </span>

                    <span className="ingredient-row">
                      {m.ingredients.map((ing, idx) => {
                        const locked = m.level < (INGREDIENT_UNLOCK_LEVELS[idx] ?? 1);
                        return (
                          <img
                            key={`${ing}-${idx}`}
                            className={
                              "ingredient-row__icon" +
                              (locked ? " ingredient-row__icon--locked" : "")
                            }
                            src={ingredientIcon(ing)}
                            alt={ingredient(ing)}
                            title={ingredient(ing)}
                            loading="lazy"
                          />
                        );
                      })}
                    </span>

                    {m.sub_skills.length > 0 && (
                      <span className="ingredient-row">
                        {m.sub_skills.map((s, idx) => {
                          const unlock = SUB_SKILL_UNLOCK_LEVELS[idx] ?? SUB_SKILL_NEVER_UNLOCKS;
                          const locked = m.level < unlock;
                          const tier = TIER_CLASS[tierBySubSkill.get(s) ?? "Regular"];
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
                    )}

                    <span
                      className="prod-box-item__skill-lv"
                      title={t("prod.skillLevelShort", { level: m.skill_level })}
                    >
                      <IconMoon />
                      {m.skill_level}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
