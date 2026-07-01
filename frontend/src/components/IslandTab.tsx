import { useEffect, useRef, useState } from "react";
import { berryIcon } from "../berries";
import { useI18n } from "../i18n";
import type { Catalog, Island } from "../types";
import { LevelStepperInput } from "./LevelStepperInput";
import { IconChevronDown } from "./icons";

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

  // Estado del dropdown custom de isla
  const [islandOpen, setIslandOpen] = useState(false);
  const islandWrapRef = useRef<HTMLDivElement>(null);
  const islandTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!islandOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (
        islandWrapRef.current &&
        !islandWrapRef.current.contains(e.target as Node)
      ) {
        setIslandOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIslandOpen(false);
        islandTriggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [islandOpen]);

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
        // user_picks: array limpio, el usuario elige.
        onFavoriteBerries([]);
      }
    }
  };

  const handleBonusChange = (pct: number) => {
    const clamped = Math.max(0, Math.min(85, pct));
    onIslandBonus(clamped / 100);
  };

  // Handlers para la grilla de chips (solo cuando user_picks === true).
  const handleBerryToggle = (berry: string) => {
    if (favoriteBerries.includes(berry)) {
      // Quitar
      onFavoriteBerries(favoriteBerries.filter((b) => b !== berry));
    } else if (favoriteBerries.length < 3) {
      // Agregar si hay espacio
      onFavoriteBerries([...favoriteBerries, berry]);
    }
    // Si ya hay 3 y el chip no está seleccionado, el botón está disabled: no hace falta else.
  };

  const selectedCount = favoriteBerries.length;

  return (
    <div className="island-tab">
      {/* Selector de isla — dropdown custom */}
      <div className="island-tab__row">
        <span className="island-tab__label">{t("teams.selectIsland")}</span>
        <div
          className="filter-control island-tab__island-control"
          ref={islandWrapRef}
        >
          <button
            ref={islandTriggerRef}
            type="button"
            className={
              "filter-btn island-tab__island-trigger" +
              (islandOpen ? " filter-btn--open" : "")
            }
            aria-haspopup="listbox"
            aria-expanded={islandOpen}
            onClick={() => setIslandOpen((o) => !o)}
          >
            <span className="filter-btn__value">
              {selectedIsland ?? (
                <span className="filter-btn__placeholder">
                  {t("teams.noIsland")}
                </span>
              )}
            </span>
            <IconChevronDown className="filter-btn__chevron" />
          </button>

          {islandOpen && (
            <div
              className="filter-pop island-tab__island-pop"
              role="listbox"
              aria-label={t("teams.selectIsland")}
            >
              <div className="filter-list">
                {/* Opción "Sin isla" */}
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedIsland === null}
                  className={
                    "filter-list__item" +
                    (selectedIsland === null ? " is-selected" : "")
                  }
                  onClick={() => {
                    handleIslandChange("");
                    setIslandOpen(false);
                  }}
                >
                  <span className="filter-list__label">
                    {t("teams.noIsland")}
                  </span>
                </button>

                {/* Opciones de isla */}
                {islands.map((isl) => (
                  <button
                    key={isl.name}
                    type="button"
                    role="option"
                    aria-selected={selectedIsland === isl.name}
                    className={
                      "filter-list__item" +
                      (selectedIsland === isl.name ? " is-selected" : "")
                    }
                    onClick={() => {
                      handleIslandChange(isl.name);
                      setIslandOpen(false);
                    }}
                  >
                    <span className="filter-list__label">{isl.name}</span>
                    {!isl.user_picks && isl.favorite_berries.length > 0 && (
                      <span className="island-tab__island-berries">
                        {isl.favorite_berries.map((b) => (
                          <img
                            key={b}
                            src={berryIcon(b)}
                            alt={berryName(b)}
                            title={berryName(b)}
                            className="island-tab__berry-icon"
                          />
                        ))}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bayas favoritas */}
      {selectedIsland !== null && (
        <div className="island-tab__row">
          <span className="island-tab__label">{t("teams.favoriteBerries")}</span>

          {island?.user_picks ? (
            /* user_picks: grilla de chips togglable */
            <div className="island-tab__berry-picker">
              <div className="island-tab__berry-grid">
                {allBerries.map((b) => {
                  const isSelected = favoriteBerries.includes(b);
                  const isDisabled = !isSelected && selectedCount >= 3;
                  return (
                    <button
                      key={b}
                      type="button"
                      className={`island-tab__berry-toggle${isSelected ? " is-selected" : ""}`}
                      disabled={isDisabled}
                      onClick={() => handleBerryToggle(b)}
                      aria-pressed={isSelected}
                    >
                      <img
                        src={berryIcon(b)}
                        alt=""
                        className="island-tab__berry-icon"
                      />
                      {berryName(b)}
                    </button>
                  );
                })}
              </div>
              <p
                className={`island-tab__berry-count${selectedCount === 3 ? " island-tab__berry-count--full" : ""}`}
              >
                {selectedCount} / 3
              </p>
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

      {/* Bonus de zona */}
      <div className="island-tab__row">
        <label className="island-tab__label">
          {t("teams.islandBonus")}
        </label>
        <div className="island-tab__bonus-stepper">
          <div className="level-stepper">
            <LevelStepperInput
              value={bonusPct}
              min={0}
              max={85}
              onChange={handleBonusChange}
              ariaLabels={{
                down: t("teams.islandBonusDecrease"),
                input: t("teams.islandBonus"),
                up: t("teams.islandBonusIncrease"),
              }}
            />
          </div>
          <span className="island-tab__bonus-unit muted">%</span>
        </div>
      </div>
    </div>
  );
}
