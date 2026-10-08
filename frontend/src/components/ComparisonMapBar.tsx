import { useState } from "react";

import { berryIcon } from "../berries";
import { MAX_FAVORITES, comparisonIslands, selectIsland, toggleFavorite, type ComparisonMap } from "../comparisonMap";
import { speedLabels } from "../expertMarks";
import { useI18n } from "../i18n";
import type { Catalog, ExpertSpeed, WeeklyBonus } from "../types";
import { FilterPopover, gridKeyDown } from "./FilterPopover";
import { ContextField } from "./ToolHeader";

const WEEKLY: readonly [WeeklyBonus, string][] = [
  ["berry_strength", "teams.weeklyBerryStrength"],
  ["ingredient", "teams.weeklyIngredient"],
  ["skill_trigger", "teams.weeklySkillTrigger"],
];

interface Props {
  catalog: Catalog;
  value: ComparisonMap;
  onChange: (map: ComparisonMap) => void;
}

/** The expert map's two cadence marks: main favorite faster, non-favorites slower. */
function SpeedMarks({ speed }: { speed: ExpertSpeed | null }) {
  const { main, penalty } = speedLabels(speed);
  return (
    <span className="ctx-marks">
      <span className="metric-mark metric-mark--good">{main}</span>
      <span className="metric-mark metric-mark--bad">{penalty}</span>
    </span>
  );
}

/** Comparison's map terms: map, favorite berries and, on an expert map, the weekly bonus. */
export function ComparisonMapBar({ catalog, value, onChange }: Props) {
  const { t, berry: berryName } = useI18n();
  const [mapOpen, setMapOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const islands = comparisonIslands(catalog.islands);
  const island = islands.find((i) => i.name === value.island) ?? null;
  const expert = island !== null;
  const berries = [...new Set(catalog.species.map((s) => s.berry).filter(Boolean))].sort();
  const full = value.favorites.length >= MAX_FAVORITES;

  return (
    <>
      <ContextField label={t("ctx.map")}>
        <FilterPopover
          open={mapOpen}
          onOpenChange={setMapOpen}
          triggerLabel={t("ctx.map")}
          triggerContent={
            <span className="filter-btn__value">
              {island?.name ?? t("prod.mapNormal")}
              {island && <SpeedMarks speed={island.expert_speed} />}
            </span>
          }
        >
          <div className="filter-list cmp-map-pop" role="listbox" aria-label={t("ctx.map")} onKeyDown={gridKeyDown}>
            {[null, ...islands].map((option) => {
              const selected = (option?.name ?? null) === value.island;
              return (
                <button
                  key={option?.name ?? "normal"}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={"filter-list__item" + (selected ? " is-selected" : "")}
                  onClick={() => {
                    onChange(selectIsland(value, option));
                    setMapOpen(false);
                  }}
                >
                  <span className="filter-list__label">{option?.name ?? t("prod.mapNormal")}</span>
                  {option && <SpeedMarks speed={option.expert_speed} />}
                </button>
              );
            })}
          </div>
        </FilterPopover>
      </ContextField>

      <ContextField label={t("teams.favoriteBerries")}>
        <FilterPopover
          open={favOpen}
          onOpenChange={setFavOpen}
          triggerLabel={t("teams.favoriteBerries")}
          triggerContent={
            <span className="filter-btn__value">
              {value.favorites.length === 0 ? (
                <span className="filter-btn__placeholder">{t("prod.favoritesNone")}</span>
              ) : (
                <span className="filter-btn__icons">
                  {value.favorites.map((b) => (
                    <img key={b} className="mini-icon" src={berryIcon(b)} alt={berryName(b)} title={berryName(b)} />
                  ))}
                  {Array.from({ length: MAX_FAVORITES - value.favorites.length }, (_, i) => (
                    <span key={i} className="island-tab__berry-icon--unknown" aria-hidden="true">?</span>
                  ))}
                </span>
              )}
            </span>
          }
        >
          <div className="island-tab__berry-picker cmp-fav-pop">
            <div className="island-tab__berry-grid">
              {berries.map((b) => {
                const selected = value.favorites.includes(b);
                const primary = expert && selected && b === value.main;
                return (
                  <button
                    key={b}
                    type="button"
                    className={
                      "island-tab__berry-toggle" +
                      (selected ? " is-selected" : "") +
                      (primary ? " island-tab__berry-toggle--primary" : "")
                    }
                    disabled={!selected && full}
                    aria-pressed={selected}
                    title={primary ? t("teams.berryPrimary") : undefined}
                    onClick={() => onChange(toggleFavorite(value, b))}
                  >
                    <img src={berryIcon(b)} alt="" className="island-tab__berry-icon" />
                    {berryName(b)}
                  </button>
                );
              })}
            </div>
            <p className={"island-tab__berry-count" + (full ? " island-tab__berry-count--full" : "")}>
              {value.favorites.length} / {MAX_FAVORITES}
              {expert && ` · ${t("prod.favoritesMainHint")}`}
            </p>
          </div>
        </FilterPopover>
      </ContextField>

      {expert && (
        <ContextField label={t("teams.weeklyBonus")}>
          <div className="specialty-toggle" role="group" aria-label={t("teams.weeklyBonus")}>
            {WEEKLY.map(([bonus, key]) => (
              <button
                key={bonus}
                type="button"
                className={"specialty-toggle__btn" + (value.weeklyBonus === bonus ? " is-on" : "")}
                aria-pressed={value.weeklyBonus === bonus}
                onClick={() => onChange({ ...value, weeklyBonus: bonus })}
              >
                {t(key)}
              </button>
            ))}
          </div>
        </ContextField>
      )}
    </>
  );
}
