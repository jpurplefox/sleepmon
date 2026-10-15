import { forwardRef } from "react";

import { berryIcon } from "../berries";
import { berryRoleOf, MAX_FAVORITES, type ComparisonMap } from "../comparisonMap";
import { describeSessions } from "../comparisonShare";
import { pickedFavorites } from "../favoriteSlots";
import { useI18n } from "../i18n";
import type { RosterEntry } from "../roster";
import type { Catalog, Island, Production, SleepSchedule } from "../types";
import { ProductionCard } from "./ProductionCard";

const WEEKLY_KEY = {
  berry_strength: "teams.weeklyBerryStrength",
  ingredient: "teams.weeklyIngredient",
  skill_trigger: "teams.weeklySkillTrigger",
} as const;

const noop = () => {};

interface Props {
  catalog: Catalog;
  entries: RosterEntry[];
  productions: (Production | null | undefined)[];
  map: ComparisonMap;
  island: Island | null;
  sleep: SleepSchedule;
}

/**
 * The comparison as one picture (PRD 0020): every card side by side, whatever the
 * screen, under a strip with the map terms they were compared on. Rendered off
 * screen and drawn to an image; never shown as it is.
 */
export const ComparisonShareSheet = forwardRef<HTMLDivElement, Props>(function ComparisonShareSheet(
  { catalog, entries, productions, map, island, sleep },
  ref,
) {
  const { t, berry: berryName } = useI18n();
  const expert = island?.expert ?? false;
  const berryOf = (species: string) => catalog.species.find((s) => s.name === species)?.berry ?? "";
  const base = productions[0] ?? null;
  const favorites = pickedFavorites(map.favorites).length > 0;

  return (
    <div ref={ref} className="share-sheet">
      <header className="share-sheet__head">
        <span className="share-sheet__brand">
          <img src="/favicon.png" alt="" width={22} height={22} />
          sleepmon
        </span>
        <span className="share-sheet__terms">
          <span>{t("share.mapLabel", { map: map.island })}</span>
          {favorites && (
            <span className="share-sheet__berries">
              {Array.from({ length: MAX_FAVORITES }, (_, i) => {
                const b = map.favorites[i];
                return b ? (
                  <img key={i} className="mini-icon" src={berryIcon(b)} alt={berryName(b)} />
                ) : null;
              })}
            </span>
          )}
          {expert && <span>{t(WEEKLY_KEY[map.weeklyBonus])}</span>}
          <span className="share-sheet__sep" aria-hidden="true">
            ·
          </span>
          <span>{t("share.sleepLabel", { sleep: describeSessions(sleep, false, t) })}</span>
        </span>
        <span className="share-sheet__url">sleepmon.app</span>
      </header>
      <div className="share-sheet__cards">
        {entries.map((e, i) => (
          <ProductionCard
            key={e.id}
            snapshot
            config={e.config}
            catalog={catalog}
            production={productions[i] ?? null}
            productionError={null}
            base={i === 0 ? null : base}
            isBase={i === 0 && entries.length > 1}
            comparing={entries.length > 1}
            berryRole={berryRoleOf(map, expert, berryOf(e.config.species))}
            expert={expert}
            expertSpeed={island?.expert_speed ?? null}
            weeklyBonus={map.weeklyBonus}
            onEdit={noop}
            onClone={noop}
            onRemove={noop}
            onMakeBase={noop}
            onSaveToBox={noop}
          />
        ))}
      </div>
    </div>
  );
});
