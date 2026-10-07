import { useI18n } from "../i18n";
import { formatHm, formatHours } from "../sleep";
import type { SleepSession } from "../types";
import { IconHourglass } from "./icons";
import { Tooltip } from "./Tooltip";

const hms = (hours: number) => {
  const total = Math.round(hours * 3600);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const overflows = (s: SleepSession) => Math.round(s.overflow_hours * 60) >= 1;

/** The ⏳ figure: marked with a "+" when some sleep's overflow rounds to at least one minute. */
export function FillTime({ fillHours, sessions }: { fillHours: number; sessions: SleepSession[] }) {
  const { t } = useI18n();
  const time = hms(fillHours);
  if (!sessions.some((s) => overflows(s))) {
    return (
      <span title={t("card.fillsIn")}>
        <IconHourglass /> {time}
      </span>
    );
  }
  const rows = sessions.map((s) => {
    const name = t(s.kind === "nap" ? "card.fillNap" : "card.fillNight", {
      hm: formatHm(Math.round(s.hours * 60)),
    });
    const what =
      overflows(s)
        ? t("card.fillOverflows", { hm: formatHours(s.overflow_hours) })
        : t("card.fillNoOverflow");
    return { kind: s.kind, name, what, over: overflows(s) };
  });
  const label = t("card.fillAria", {
    time,
    sessions: rows.map((r) => `${r.name}: ${r.what}.`).join(" "),
  });
  return (
    <span>
      <IconHourglass />{" "}
      <Tooltip
        label={label}
        content={rows.map((r) => (
          <Tooltip.Row key={r.kind}>
            <Tooltip.Label>{r.name}</Tooltip.Label>
            <Tooltip.Value>
              <span className={r.over ? "fill-time__over" : "fill-time__ok"}>{r.what}</span>
            </Tooltip.Value>
          </Tooltip.Row>
        ))}
      >
        <span className="strength-value__cue" tabIndex={0}>
          {time}
        </span>
        <span className="overflow-mark" aria-hidden="true">
          +
        </span>
      </Tooltip>
    </span>
  );
}
