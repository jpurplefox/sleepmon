import { berryIcon } from "../berries";
import { useI18n } from "../i18n";
import type { Catalog, Island } from "../types";

interface Props {
  catalog: Catalog;
  selectedIsland: string | null;
  favoriteBerries: string[];
  islandBonus: number; // fracción 0.0–0.85
  onSelectIsland: (islandName: string | null) => void;
  onFavoriteBerries: (berries: string[]) => void;
  onIslandBonus: (bonus: number) => void;
}

// Derivar todas las bayas disponibles en el catálogo a partir de las especies.
// No hardcodeamos la lista: usamos las bayas reales del catálogo ordenadas.
function allBerriesFromCatalog(catalog: Catalog): string[] {
  const set = new Set<string>();
  for (const s of catalog.species) {
    if (s.berry) set.add(s.berry);
  }
  return [...set].sort();
}

export function IslandTab({
  catalog,
  selectedIsland,
  favoriteBerries,
  islandBonus,
  onSelectIsland,
  onFavoriteBerries,
  onIslandBonus,
}: Props) {
  const { t, berry: berryName } = useI18n();

  const islands: Island[] = catalog.islands;
  const island = islands.find((i) => i.name === selectedIsland) ?? null;
  const allBerries = allBerriesFromCatalog(catalog);

  // Bonus en porcentaje para el input (0–85).
  const bonusPct = Math.round(islandBonus * 100);

  const handleIslandChange = (name: string) => {
    if (name === "") {
      // "Sin isla"
      onSelectIsland(null);
      onFavoriteBerries([]);
      // El bonus es independiente: no lo reseteamos.
    } else {
      const found = islands.find((i) => i.name === name) ?? null;
      onSelectIsland(name);
      if (found && !found.user_picks) {
        // Isla con favoritas fijas: las seteamos automáticamente.
        onFavoriteBerries(found.favorite_berries);
      } else {
        // user_picks: resetear para que el usuario elija.
        onFavoriteBerries(["", "", ""]);
      }
    }
  };

  const handleBonusChange = (pct: number) => {
    const clamped = Math.max(0, Math.min(85, pct));
    onIslandBonus(clamped / 100);
  };

  // Handlers para los 3 selectores de baya (solo cuando user_picks === true).
  const handleBerryPick = (slotIdx: number, berry: string) => {
    const next = [...favoriteBerries];
    // Aseguramos que haya 3 slots.
    while (next.length < 3) next.push("");
    next[slotIdx] = berry;
    onFavoriteBerries(next);
  };

  return (
    <div className="island-tab">
      {/* Selector de isla */}
      <div className="island-tab__row">
        <label htmlFor="island-select" className="island-tab__label">
          {t("teams.selectIsland")}
        </label>
        <select
          id="island-select"
          className="island-tab__select"
          value={selectedIsland ?? ""}
          onChange={(e) => handleIslandChange(e.target.value)}
        >
          <option value="">{t("teams.noIsland")}</option>
          {islands.map((isl) => (
            <option key={isl.name} value={isl.name}>
              {isl.name}
            </option>
          ))}
        </select>
      </div>

      {/* Bayas favoritas */}
      {selectedIsland !== null && (
        <div className="island-tab__row">
          <span className="island-tab__label">{t("teams.favoriteBerries")}</span>

          {island?.user_picks ? (
            /* user_picks: 3 selectores */
            <div className="island-tab__berry-pickers">
              {[0, 1, 2].map((slotIdx) => {
                const currentVal = favoriteBerries[slotIdx] ?? "";
                return (
                  <div key={slotIdx} className="island-tab__berry-slot">
                    <label
                      htmlFor={`island-berry-${slotIdx}`}
                      className="island-tab__berry-slot-label muted"
                    >
                      {slotIdx === 0
                        ? t("teams.mainBerry")
                        : t("teams.secondaryBerry")}
                    </label>
                    <div className="island-tab__berry-sel-wrap">
                      {currentVal && (
                        <img
                          src={berryIcon(currentVal)}
                          alt=""
                          className="island-tab__berry-icon"
                        />
                      )}
                      <select
                        id={`island-berry-${slotIdx}`}
                        className="island-tab__berry-select"
                        value={currentVal}
                        onChange={(e) => handleBerryPick(slotIdx, e.target.value)}
                      >
                        <option value="">—</option>
                        {allBerries.map((b) => {
                          // Deshabilitar bayas ya elegidas en otros slots.
                          const isUsedElsewhere = favoriteBerries.some(
                            (pb, pi) => pi !== slotIdx && pb === b,
                          );
                          return (
                            <option key={b} value={b} disabled={isUsedElsewhere}>
                              {berryName(b)}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Favoritas fijas: chips de solo lectura */
            <div className="island-tab__berry-chips">
              {favoriteBerries.length === 0 ? (
                <span className="muted">—</span>
              ) : (
                favoriteBerries.map((b) => (
                  <span key={b} className="island-tab__berry-chip">
                    <img
                      src={berryIcon(b)}
                      alt={berryName(b)}
                      className="island-tab__berry-icon"
                    />
                    <span>{berryName(b)}</span>
                  </span>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Bonus de isla */}
      <div className="island-tab__row">
        <label htmlFor="island-bonus" className="island-tab__label">
          {t("teams.islandBonus")}
        </label>
        <div className="island-tab__bonus-wrap">
          <input
            id="island-bonus"
            type="number"
            className="island-tab__bonus-input"
            min={0}
            max={85}
            step={1}
            value={bonusPct}
            onChange={(e) => handleBonusChange(Number(e.target.value))}
            aria-label={t("teams.islandBonus")}
          />
          <span className="island-tab__bonus-unit muted">%</span>
        </div>
      </div>

      {/* Recordatorio visual cuando hay bonus activo */}
      {islandBonus > 0 && (
        <p className="muted island-tab__bonus-hint" style={{ fontSize: "var(--text-sm)" }}>
          ×{(1 + islandBonus).toFixed(2)}
        </p>
      )}
    </div>
  );
}
