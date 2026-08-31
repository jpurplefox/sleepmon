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
  onSave: (patch: ProgressPatch) => Promise<void>;
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
  onSave: (patch: ProgressPatch) => Promise<void>;
}) {
  const { t } = useI18n();
  // Shown value while dragging; kept separate from `pct` so the slider stays
  // responsive and isn't shadowed once the debounced save resolves.
  const [value, setValue] = useState(pct);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Count of saves in flight. A single "last value" slot can't represent two
  // overlapping sends; this gates any resync at all while something is still out.
  const pendingRef = useRef(0);
  // The value of the most recently issued send, consulted only once nothing is
  // outstanding (see the resync effect below): unlike the old single-slot guard,
  // this is never cleared just because one response happens to match it while a
  // newer send is still in flight — only once pendingRef reaches zero do we look
  // at it at all, and every path that reaches zero also releases it.
  const lastSentRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  // Follow the saved value only when this row has nothing outstanding at all: no
  // armed debounce timer and no save in flight. Even then, an incoming value that
  // doesn't match our last send is the stale echo of an older, superseded send
  // settling last (its response can still land after a newer one's) — keep the
  // value we already show and release the guard so the *next* change is trusted.
  useEffect(() => {
    if (timerRef.current !== null) return;
    if (pendingRef.current !== 0) return;
    if (lastSentRef.current !== null && pct !== lastSentRef.current) {
      lastSentRef.current = null;
      return;
    }
    lastSentRef.current = null;
    setValue(pct);
  }, [pct]);

  // A pending save/timer cannot touch state after the modal (and this row) unmounts.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      pendingRef.current = 0;
    };
  }, []);

  const handleChange = (next: number) => {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pendingRef.current += 1;
      lastSentRef.current = next;
      onSave({ area_bonuses: { [island.name]: next } })
        .catch(() => {
          // A failed save has no informed opinion about the value anymore
          // (surfaced to the user via the hook's `saveError`); release the guard
          // so a later external update isn't mistaken for a stale echo forever.
          lastSentRef.current = null;
        })
        .finally(() => {
          if (!mountedRef.current) return;
          pendingRef.current = Math.max(0, pendingRef.current - 1);
        });
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
