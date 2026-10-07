import { useI18n } from "../i18n";
import {
  asleepMinutes,
  awakeMinutes,
  formatHm,
  napBounds,
  nightBounds,
  setNap,
  stepNap,
  stepNight,
} from "../sleep";
import type { PlayerProgress, ProgressPatch, SleepSchedule } from "../types";
import { IconMoon, IconSun } from "./icons";
import { Stepper } from "./Stepper";

interface Props {
  /** The in-memory draft (PRD 0011) — nothing here is saved until Guardar. */
  draft: PlayerProgress;
  onChange: (patch: ProgressPatch) => void;
}

export function ProgressSleepTab({ draft, onChange }: Props) {
  const { t } = useI18n();
  const sleep = draft.sleep;
  const night = nightBounds(sleep);
  const nap = napBounds(sleep);
  const set = (next: SleepSchedule) => onChange({ sleep: next });
  const napOn = sleep.nap_minutes !== null;

  return (
    <div className="progress-section">
      <h3 className="progress-section__head">{t("sleep.heading")}</h3>
      <div className="sleep-rows">
        <div className="sleep-row">
          <span className="sleep-row__label">{t("sleep.night")}</span>
          <Stepper
            className="sleep-stepper"
            onPrev={() => set(stepNight(sleep, -1))}
            onNext={() => set(stepNight(sleep, 1))}
            disablePrev={night.atMin}
            disableNext={night.atMax}
            prevLabel={t("sleep.nightLess")}
            nextLabel={t("sleep.nightMore")}
            leading={<IconMoon width={20} height={20} />}
            primary={t("sleep.hours", { hm: formatHm(sleep.night_minutes) })}
          />
        </div>
        <div className="sleep-row">
          <span className="sleep-row__label" id="sleep-nap-toggle">
            {t("sleep.napToggle")}
          </span>
          <div className="specialty-toggle" role="group" aria-labelledby="sleep-nap-toggle">
            <button
              type="button"
              className={"specialty-toggle__btn" + (napOn ? "" : " is-on")}
              aria-pressed={!napOn}
              onClick={() => set(setNap(sleep, false))}
            >
              {t("common.no")}
            </button>
            <button
              type="button"
              className={"specialty-toggle__btn" + (napOn ? " is-on" : "")}
              aria-pressed={napOn}
              onClick={() => set(setNap(sleep, true))}
            >
              {t("common.yes")}
            </button>
          </div>
        </div>
        {sleep.nap_minutes !== null && (
          <div className="sleep-row">
            <span className="sleep-row__label">{t("sleep.nap")}</span>
            <Stepper
              className="sleep-stepper"
              onPrev={() => set(stepNap(sleep, -1))}
              onNext={() => set(stepNap(sleep, 1))}
              disablePrev={nap.atMin}
              disableNext={nap.atMax}
              prevLabel={t("sleep.napLess")}
              nextLabel={t("sleep.napMore")}
              leading={<IconSun width={20} height={20} />}
              primary={t("sleep.hours", { hm: formatHm(sleep.nap_minutes) })}
            />
          </div>
        )}
      </div>
      <p className="sleep-sum">
        {t("sleep.summary", {
          asleep: formatHm(asleepMinutes(sleep)),
          awake: formatHm(awakeMinutes(sleep)),
        })}
      </p>
    </div>
  );
}
