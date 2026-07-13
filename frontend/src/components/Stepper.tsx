import type React from "react";

interface StepperProps {
  onPrev: () => void;
  onNext: () => void;
  disablePrev?: boolean;
  disableNext?: boolean;
  /** Accessible labels for the ‹ / › buttons. */
  prevLabel: string;
  nextLabel: string;
  /** Leading visual in the display: a level badge, an icon, etc. */
  leading?: React.ReactNode;
  /** Primary line (name / label). */
  primary: React.ReactNode;
  /** Secondary line (description / effect). */
  secondary?: React.ReactNode;
}

/**
 * A `‹ value ›` stepper: two nav buttons flanking a display with a leading visual
 * and a two-line label. Bounds and domain data live in the caller; this is the
 * shared shell behind the skill-level and ribbon steppers. (The level stepper is
 * separate — it has an editable input and quick-pick shortcuts.)
 */
export function Stepper({
  onPrev,
  onNext,
  disablePrev,
  disableNext,
  prevLabel,
  nextLabel,
  leading,
  primary,
  secondary,
}: StepperProps) {
  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper__btn"
        onClick={onPrev}
        disabled={disablePrev}
        aria-label={prevLabel}
      >
        ‹
      </button>

      <div className="stepper__display">
        {leading}
        <div className="stepper__text">
          <span className="stepper__primary">{primary}</span>
          {secondary && <span className="stepper__secondary">{secondary}</span>}
        </div>
      </div>

      <button
        type="button"
        className="stepper__btn"
        onClick={onNext}
        disabled={disableNext}
        aria-label={nextLabel}
      >
        ›
      </button>
    </div>
  );
}
