import { useId, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

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
import type { Catalog, Member } from "../types";
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
  const { t, nature: natureLabel, ingredient, subSkill } = useI18n();
  const [search, setSearch] = useState("");
  const listId = useId();

  // Navegación con flechas entre ítems (además de Tab), útil cuando la caja es
  // grande: ↓/↑ mueven el foco al siguiente/anterior ítem seleccionable, con wrap.
  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const btns = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>("button.prod-box-item:not([disabled])"),
    );
    if (btns.length === 0) return;
    e.preventDefault();
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "ArrowDown"
        ? i < 0
          ? 0
          : (i + 1) % btns.length
        : i <= 0
          ? btns.length - 1
          : i - 1;
    btns[next].focus();
  };

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

  return (
    <>
      <input
        data-autofocus
        type="search"
        className="prod-box-search"
        placeholder={t("prod.boxSearch")}
        aria-label={t("prod.boxSearchAria")}
        aria-controls={listId}
        aria-autocomplete="list"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Anuncio del conteo de resultados al filtrar, para lectores de pantalla;
          el caso 0 lo cubre el mensaje visible de vacío (también role=status). */}
      <span className="sr-only" role="status" aria-live="polite">
        {search && filtered.length > 0 ? t("prod.boxResultCount", { count: filtered.length }) : ""}
      </span>

      {filtered.length === 0 ? (
        <p className="muted prod-box-empty" role="status">
          {t("prod.boxSearchEmpty", { query: search })}
        </p>
      ) : (
        <ul id={listId} className="prod-box-list" onKeyDown={onListKeyDown}>
          {filtered.map((m) => {
            const already = inComparison.has(m.id);
            const nature = natureByName.get(m.nature);
            const ribbonIdx = RIBBONS.findIndex((r) => r.name === m.ribbon);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className="prod-box-item"
                  onClick={() => onPick(m)}
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
                    {already && <span className="prod-box-item__tag">{t("prod.alreadyIn")}</span>}
                    {ribbonIdx > 0 && (
                      <RibbonIcon
                        index={ribbonIdx}
                        size={18}
                        title={t("member.ribbon", { hours: RIBBONS[ribbonIdx].hours })}
                      />
                    )}
                    {/* El nivel (único dorado del topline) queda siempre al extremo
                        derecho, independientemente de listón o tag. */}
                    <span className="badge badge--level">
                      {t("common.level", { level: m.level })}
                    </span>
                  </div>

                  <div className="prod-box-item__config">
                    <span className="prod-box-item__nature">
                      {nature && !nature.neutral ? (
                        <span className="nature-effect">
                          <span className="up">↑{nature.increased}</span>{" "}
                          <span className="down">↓{nature.decreased}</span>
                        </span>
                      ) : (
                        <span className="muted">{natureLabel(m.nature)}</span>
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

                    <span className="prod-box-item__skill-lv">
                      {t("prod.skillLevelShort", { level: m.skill_level })}
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
