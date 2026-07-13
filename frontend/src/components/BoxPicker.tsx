import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { RIBBONS } from "../constants";
import { useI18n } from "../i18n";
import { spriteUrl } from "../sprites";
import type { Catalog, Member } from "../types";
import { MemberConfig } from "./MemberConfig";
import { Placeholder } from "./Placeholder";
import { RibbonIcon } from "./RibbonIcon";

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
// reusando el mismo lenguaje visual que la Caja (MemberConfig).
export function BoxPicker({
  members,
  isLoading,
  isError,
  onRetry,
  catalog,
  inComparison,
  onPick,
}: Props) {
  const { t } = useI18n();
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
  const mainSkillBySpecies = useMemo(
    () => new Map(catalog.species.map((s) => [s.name, s.main_skill])),
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

  if (isLoading) return <Placeholder loading>{t("team.loadingBox")}</Placeholder>;

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
    return <Placeholder>{t("prod.boxEmptyTab")}</Placeholder>;

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
        <Placeholder>{t("prod.boxSearchEmpty", { query: search })}</Placeholder>
      ) : (
        <ul id={listId} className="prod-box-list" role="listbox" ref={listRef}>
          {filtered.map((m, idx) => {
            const already = inComparison.has(m.id);
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
                    {/* Nombre + listón pegados; el grupo crece y empuja tag y nivel
                        al extremo derecho. */}
                    <span className="prod-box-item__title">
                      <span className="prod-box-item__name">{m.species}</span>
                      {ribbonIdx > 0 && (
                        <RibbonIcon
                          index={ribbonIdx}
                          size={18}
                          title={t("member.ribbon", { hours: RIBBONS[ribbonIdx].hours })}
                        />
                      )}
                    </span>
                    {already && <span className="prod-box-item__tag">{t("prod.alreadyIn")}</span>}
                    {/* El nivel (único dorado del topline) queda siempre al extremo
                        derecho, independientemente de listón o tag. */}
                    <span className="badge badge--level">
                      {t("common.level", { level: m.level })}
                    </span>
                  </div>

                  <div className="prod-box-item__config">
                    <MemberConfig
                      level={m.level}
                      nature={m.nature}
                      ingredients={m.ingredients}
                      subSkills={m.sub_skills}
                      skillLevel={m.skill_level}
                      natureMeta={natureByName.get(m.nature)}
                      mainSkillName={mainSkillBySpecies.get(m.species)}
                      tierBySubSkill={(name) => tierBySubSkill.get(name)}
                    />
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
