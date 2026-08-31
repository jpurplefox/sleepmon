import type React from "react";

import { useI18n } from "../i18n";
import { areaBonusOf } from "../progress";
import type { Island, PlayerProgress, ProgressPatch } from "../types";

const MAX_BONUS_PCT = 85;

interface Props {
  /** The in-memory draft being edited (PRD 0011) — nothing here is saved yet. */
  draft: PlayerProgress;
  islands: Island[];
  onChange: (patch: ProgressPatch) => void;
}

export function ProgressAreasTab({ draft, islands, onChange }: Props) {
  return (
    <div className="progress-section">
      {islands.map((island) => (
        <AreaRow
          key={island.name}
          island={island}
          pct={areaBonusOf(draft, island.name)}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function AreaRow({
  island,
  pct,
  onChange,
}: {
  island: Island;
  pct: number;
  onChange: (patch: ProgressPatch) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="progress-area-row">
      <span className="progress-area-row__name">
        {island.name}
        {island.expert && <span className="badge">{t("progress.expert")}</span>}
        {pct === 0 && (
          <span className="muted progress-area__zero">
            {t("progress.noBonusYet")}
          </span>
        )}
      </span>
      <div
        className="bonus-slider"
        style={
          { "--ratio": (pct / MAX_BONUS_PCT).toFixed(4) } as React.CSSProperties
        }
      >
        <div className="bonus-slider__row">
          <div className="bonus-slider__track">
            <div className="bonus-slider__fill" />
            <div className="bonus-slider__thumb" />
            <input
              type="range"
              className="bonus-slider__input"
              min={0}
              max={MAX_BONUS_PCT}
              step={1}
              value={pct}
              onChange={(e) =>
                onChange({
                  area_bonuses: { [island.name]: Number(e.target.value) },
                })
              }
              aria-label={`${t("progress.areas")} — ${island.name}`}
              aria-valuetext={`${pct}%`}
            />
          </div>
          <span className="bonus-slider__value" aria-hidden="true">
            {pct}
            <span className="bonus-slider__unit">%</span>
          </span>
        </div>
      </div>
    </div>
  );
}
