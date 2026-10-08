import { useI18n } from "../i18n";
import type { SleepSession } from "../types";
import { IconMoon, IconSun } from "./icons";
import { Tooltip } from "./Tooltip";

const fracPct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** Skill chances per sleep: specialists read "≥ 1" and "2", others "1" (PRD 0015). */
export function SleepSkillGrid({ sessions }: { sessions: SleepSession[] }) {
  const { t } = useI18n();
  const specialist = sessions.some((s) => s.skill_chances.length >= 2);
  const alone = sessions.length === 1;
  const name = (s: SleepSession) =>
    alone ? t("card.sleepOnly") : t(s.kind === "nap" ? "card.sleepNap" : "card.sleepNight");
  const cell = (v: number | undefined) => (v === undefined ? t("common.dash") : fracPct(v));
  return (
    <div className={"night-grid" + (specialist ? "" : " night-grid--one")}>
      <span />
      {specialist ? (
        <>
          <Tooltip content={t("card.sleepAtLeastOnceTitle")} className="tooltip--inline night-grid__h">
            {t("card.sleepAtLeastOnce")}
          </Tooltip>
          <Tooltip content={t("card.sleepTwiceTitle")} className="tooltip--inline night-grid__h">
            {t("card.sleepTwice")}
          </Tooltip>
        </>
      ) : (
        <Tooltip content={t("card.sleepOnceTitle")} className="tooltip--inline night-grid__h">
          {t("card.sleepOnce")}
        </Tooltip>
      )}
      {sessions.map((s) => (
        <div key={s.kind} className="night-grid__row">
          <span className="night-grid__who">
            {s.kind === "nap" ? <IconSun /> : <IconMoon />}
            <span className="muted">{name(s)}</span>
          </span>
          <span>{cell(s.skill_chances[0])}</span>
          {specialist && <span>{cell(s.skill_chances[1])}</span>}
        </div>
      ))}
    </div>
  );
}
