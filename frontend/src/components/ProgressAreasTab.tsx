import type React from "react";
import { useEffect, useRef, useState } from "react";

import { useI18n } from "../i18n";
import { areaBonusOf } from "../progress";
import type { Island, PlayerProgress, ProgressPatch } from "../types";

const MAX_BONUS_PCT = 85;
// A range input fires onChange on every pixel of a drag; wait for the value to
// settle before saving, so one drag produces one PATCH instead of dozens.
const SAVE_DEBOUNCE_MS = 300;

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
  // Shown value while dragging; kept separate from `pct` so the slider stays
  // responsive and isn't shadowed once the debounced save resolves.
  const [value, setValue] = useState(pct);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The cache never holds a stale document (useProgress drops out-of-order
  // responses at the source), so the only thing to protect here is a local
  // edit the user has made but hasn't sent yet.
  useEffect(() => {
    if (timerRef.current !== null) return;
    setValue(pct);
  }, [pct]);

  // Cancel an armed debounce if the row unmounts before it fires.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (next: number) => {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onSave({ area_bonuses: { [island.name]: next } });
    }, SAVE_DEBOUNCE_MS);
  };

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
