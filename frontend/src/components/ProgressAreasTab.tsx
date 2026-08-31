import type React from "react";

import { useI18n } from "../i18n";
import { areaBonusOf } from "../progress";
import { useDebouncedSave } from "../useDebouncedSave";
import type { Island, PlayerProgress, ProgressPatch } from "../types";

const MAX_BONUS_PCT = 85;

interface Props {
  progress: PlayerProgress;
  islands: Island[];
  onSave: (patch: ProgressPatch) => void;
}

export function ProgressAreasTab({ progress, islands, onSave }: Props) {
  return (
    <div className="progress-section">
      {islands.map((island) => (
        <AreaRow
          key={island.name}
          island={island}
          pct={areaBonusOf(progress, island.name)}
          onSave={onSave}
        />
      ))}
    </div>
  );
}

function AreaRow({
  island,
  pct,
  onSave,
}: {
  island: Island;
  pct: number;
  onSave: (patch: ProgressPatch) => void;
}) {
  const { t } = useI18n();
  const [value, handleChange] = useDebouncedSave(pct, (next) =>
    onSave({ area_bonuses: { [island.name]: next } }),
  );

  return (
    <div className="progress-area-row">
      <span className="progress-area-row__name">
        {island.name}
        {island.expert && <span className="badge">{t("progress.expert")}</span>}
        {value === 0 && (
          <span className="muted progress-area__zero">{t("progress.noBonusYet")}</span>
        )}
      </span>
      <div
        className="bonus-slider"
        style={{ "--ratio": (value / MAX_BONUS_PCT).toFixed(4) } as React.CSSProperties}
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
              value={value}
              onChange={(e) => handleChange(Number(e.target.value))}
              aria-label={`${t("progress.areas")} — ${island.name}`}
              aria-valuetext={`${value}%`}
            />
          </div>
          <span className="bonus-slider__value" aria-hidden="true">
            {value}
            <span className="bonus-slider__unit">%</span>
          </span>
        </div>
      </div>
    </div>
  );
}
