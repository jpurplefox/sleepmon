import { useMemo, useState } from "react";

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
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="muted prod-box-empty" role="status">
          {t("prod.boxSearchEmpty", { query: search })}
        </p>
      ) : (
        <ul className="prod-box-list">
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
                    {ribbonIdx > 0 && (
                      <RibbonIcon
                        index={ribbonIdx}
                        size={18}
                        title={t("member.ribbon", { hours: RIBBONS[ribbonIdx].hours })}
                      />
                    )}
                    {already && <span className="prod-box-item__tag">{t("prod.alreadyIn")}</span>}
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
                          return (
                            <span
                              key={`${s}-${idx}`}
                              className={`ss-icon ss-icon--${tier}` + (locked ? " is-locked" : "")}
                              data-tooltip={subSkill(s)}
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
