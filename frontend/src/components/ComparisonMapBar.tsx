import { useState } from "react";

import { berryIcon } from "../berries";
import { MAX_FAVORITES, fixedFavorites, mainOf, selectIsland, toggleFavorite, type ComparisonMap } from "../comparisonMap";
import { pickedFavorites } from "../favoriteSlots";
import { speedLabels } from "../expertMarks";
import { useI18n } from "../i18n";
import type { Catalog, ExpertSpeed, WeeklyBonus } from "../types";
import { BerryCount } from "./BerryCount";
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
  const islands = catalog.islands;
  const island = islands.find((i) => i.name === value.island) ?? null;
  const expert = island?.expert ?? false;
  const fixed = fixedFavorites(island);
  const berries = [...new Set(catalog.species.map((s) => s.berry).filter(Boolean))].sort();
  const picked = pickedFavorites(value.favorites).length;
  const full = picked >= MAX_FAVORITES;
  const main = mainOf(value, expert);

  return (
    <>
      <ContextField label={t("ctx.map")}>
        <FilterPopover
          open={mapOpen}
          onOpenChange={setMapOpen}
          triggerLabel={t("ctx.map")}
          triggerContent={
            <span className="filter-btn__value">
              {value.island}
              {expert && <SpeedMarks speed={island?.expert_speed ?? null} />}
            </span>
          }
        >
          <div className="filter-list cmp-map-pop" role="listbox" aria-label={t("ctx.map")} onKeyDown={gridKeyDown}>
            {islands.map((option) => {
              const selected = option.name === value.island;
              return (
                <button
                  key={option.name}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={"filter-list__item" + (selected ? " is-selected" : "")}
                  onClick={() => {
                    onChange(selectIsland(value, option));
                    setMapOpen(false);
                  }}
                >
                  <span className="filter-list__label">{option.name}</span>
                  {option.expert && <SpeedMarks speed={option.expert_speed} />}
                </button>
              );
            })}
          </div>
        </FilterPopover>
      </ContextField>

      <ContextField label={t("teams.favoriteBerries")}>
        {fixed ? (
          // The game sets this map's favorites: shown, not picked.
          <span className="ctx-field__static" title={t("prod.favoritesFixed")}>
            <span className="filter-btn__icons">
              {value.favorites.filter(Boolean).map((b) => (
                <img key={b} className="mini-icon" src={berryIcon(b)} alt={berryName(b)} title={berryName(b)} />
              ))}
            </span>
          </span>
        ) : (
          <FilterPopover
            open={favOpen}
            onOpenChange={setFavOpen}
            triggerLabel={t("teams.favoriteBerries")}
            triggerContent={
              <span className="filter-btn__value">
                {picked === 0 ? (
                  <span className="filter-btn__placeholder">{t("prod.favoritesNone")}</span>
                ) : (
                  <span className="filter-btn__icons">
                    {/* Each slot in its place: an open one shows "?" where its berry was. */}
                    {Array.from({ length: MAX_FAVORITES }, (_, i) => {
                      const b = value.favorites[i];
                      return b ? (
                        <img key={i} className="mini-icon" src={berryIcon(b)} alt={berryName(b)} title={berryName(b)} />
                      ) : (
                        <span key={i} className="island-tab__berry-icon--unknown" aria-hidden="true">?</span>
                      );
                    })}
                  </span>
                )}
              </span>
            }
          >
            <div className="island-tab__berry-picker cmp-fav-pop">
              <div className="island-tab__berry-grid">
                {berries.map((b) => {
                  const selected = value.favorites.includes(b);
                  const primary = b === main;
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
              <BerryCount
                slots={value.favorites}
                max={MAX_FAVORITES}
                label={t("teams.favoriteBerries")}
              />
            </div>
          </FilterPopover>
        )}
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
