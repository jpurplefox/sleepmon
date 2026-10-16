import type React from "react";

import { useI18n } from "../i18n";
import { ingredientIcon } from "../ingredients";
import { comparisonRows, levelUpGain, spanUnlocks, type ComparisonRow, type Gain } from "../levelUp";
import { CHARGE_STRENGTH_ICON, GENERIC_CANDY_ICON } from "../skillIcons";
import { subSkillIcon } from "../subskills";
import type { LevelUp, Member, MemberProduction } from "../types";
import { IconHelp, IconSparkle, IconTriangle } from "./icons";
import { Tooltip } from "./Tooltip";

// PRD 0021 — what leveling a Box entry costs and what it buys: the span (tooltip
// trigger with the now-vs-target comparison), the role-based gain pill and the
// candies + dream shards. Same number formats as the rest of the Box entry.
const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtInt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const SHARD_ICON = "/shard.png";
const TIER_CLASS: Record<string, string> = { Gold: "gold", Blue: "blue", Regular: "regular" };

type Digits = 0 | 1;
type Dir = "up" | "down" | "same";

// The direction and magnitude of a change, rounded the way it's shown: a change
// that rounds to zero reads as "same" (≈), as Comparison's deltas do.
function deltaParts(now: number, then: number, digits: Digits): { dir: Dir; text: string } {
  const f = digits === 0 ? fmtInt : fmt;
  const diff = Number(then.toFixed(digits)) - Number(now.toFixed(digits));
  const text = f(Math.abs(diff));
  if (text === f(0)) return { dir: "same", text: "≈" };
  return { dir: diff > 0 ? "up" : "down", text };
}

// The delta's body: ▲/▼ (shape carries direction, not just color), the sign for
// screen readers, then the magnitude.
function DeltaBody({ dir, text }: { dir: Dir; text: string }) {
  if (dir === "same") return <>{text}</>;
  return (
    <>
      <IconTriangle dir={dir} className="prod-delta__arrow" />
      <span className="sr-only">{dir === "up" ? "+" : "−"}</span>
      {text}
    </>
  );
}

function Delta({ now, then, digits }: { now: number; then: number; digits: Digits }) {
  const parts = deltaParts(now, then, digits);
  return (
    <span className={`prod-delta prod-delta--${parts.dir}`}>
      <DeltaBody {...parts} />
    </span>
  );
}

function GainPill({ gain }: { gain: Gain }) {
  const { t, ingredient } = useI18n();
  let icon: React.ReactNode;
  let name: string;
  if (gain.kind === "strength") {
    icon = <img src={CHARGE_STRENGTH_ICON} alt="" aria-hidden="true" />;
    name = t("levelUp.strength");
  } else if (gain.kind === "triggers") {
    icon = <IconSparkle className="levelup-gain__sparkle" aria-hidden="true" />;
    name = t("levelUp.skill");
  } else {
    icon = <img src={ingredientIcon(gain.ingredient)} alt="" aria-hidden="true" />;
    name = ingredient(gain.ingredient);
  }
  const label = <span className="sr-only">{name} </span>;
  if (gain.kind === "newIngredient")
    return (
      <span className="prod-delta prod-delta--up levelup-gain" title={name}>
        {icon}
        {label}+{fmt(gain.then)} {t("levelUp.new")}
      </span>
    );
  const parts = deltaParts(gain.now, gain.then, gain.kind === "strength" ? 0 : 1);
  return (
    <span className={`prod-delta prod-delta--${parts.dir} levelup-gain`} title={name}>
      {icon}
      {label}
      <DeltaBody {...parts} />
    </span>
  );
}

function Row({ row }: { row: ComparisonRow }) {
  const { t, ingredient } = useI18n();
  const label =
    row.metric === "ingredient" ? (
      <>
        <img src={ingredientIcon(row.ingredient)} alt="" />
        {ingredient(row.ingredient)}
      </>
    ) : row.metric === "helps" ? (
      <>
        <IconHelp aria-hidden="true" />
        {t("levelUp.helps")}
      </>
    ) : row.metric === "strength" ? (
      <>
        <img src={CHARGE_STRENGTH_ICON} alt="" />
        {t("levelUp.strength")}
      </>
    ) : (
      <>
        <IconSparkle aria-hidden="true" />
        {t("levelUp.skill")}
      </>
    );
  const digits: Digits = row.metric === "strength" ? 0 : 1;
  const f = digits === 0 ? fmtInt : fmt;
  const prefix = row.metric === "triggers" ? "×" : "";
  return (
    <span className="levelup-tip__row">
      <span className="levelup-tip__label">{label}</span>
      <span className="levelup-tip__vals">
        <span className="levelup-tip__now">{row.now === null ? "—" : prefix + f(row.now)}</span>
        <span className="levelup-tip__sep">›</span>
        <span className="levelup-tip__then">{prefix + f(row.then)}</span>
      </span>
      <span className="levelup-tip__delta">
        {row.now === null ? (
          <span className="prod-delta prod-delta--up">{t("levelUp.new")}</span>
        ) : (
          <Delta now={row.now} then={row.then} digits={digits} />
        )}
      </span>
    </span>
  );
}

function LevelUpTooltip({
  member,
  production,
  levelUp,
  tierBySubSkill,
}: {
  member: Member;
  production: MemberProduction;
  levelUp: LevelUp;
  tierBySubSkill: (name: string) => string | undefined;
}) {
  const { t, subSkill, ingredient } = useI18n();
  const unlocks = spanUnlocks(member, levelUp.target_level);
  return (
    <span className="levelup-tip">
      <span className="levelup-tip__head">
        <span className="levelup-tip__span">
          {`${t("common.level", { level: member.level })} → ${t("common.level", { level: levelUp.target_level })}`}
        </span>
        {unlocks.map((u) => (
          <span key={`${u.kind}-${u.level}`} className="levelup-tip__unlock">
            <span className="levelup-tip__lv">{t("common.level", { level: u.level })}</span>
            {u.kind === "ingredient" ? (
              <>
                <img className="levelup-tip__img" src={ingredientIcon(u.ingredient)} alt="" />
                <span>{ingredient(u.ingredient)}</span>
              </>
            ) : u.subSkill ? (
              <>
                <span
                  className={`ss-icon ss-icon--${TIER_CLASS[tierBySubSkill(u.subSkill) ?? "Regular"]} levelup-tip__ss`}
                >
                  <img src={subSkillIcon(u.subSkill)} alt="" />
                </span>
                <span>{subSkill(u.subSkill)}</span>
              </>
            ) : (
              <>
                <span className="ss-icon ss-icon--empty levelup-tip__ss" />
                <span>{t("levelUp.notRecorded")}</span>
              </>
            )}
          </span>
        ))}
      </span>
      {comparisonRows(production, levelUp.at_target).map((r) => (
        <Row key={r.metric === "ingredient" ? `ing-${r.ingredient}` : r.metric} row={r} />
      ))}
      {unlocks.some((u) => u.kind === "subSkill" && u.subSkill === null) && (
        <span className="levelup-tip__note">{t("levelUp.notRecordedNote")}</span>
      )}
    </span>
  );
}

interface Props {
  member: Member;
  specialty: string | undefined;
  skill: string | undefined;
  production: MemberProduction;
  /** "cell": the Box entry's own column (desktop/tablet). "section": the expanded phone rows. */
  layout: "cell" | "section";
  tierBySubSkill: (name: string) => string | undefined;
}

/** Renders nothing when there is no next level to reach (level 70+). */
export function LevelUpCell({ member, specialty, skill, production, layout, tierBySubSkill }: Props) {
  const { t } = useI18n();
  const levelUp = production.level_up;
  if (!levelUp) return null;
  const gain = levelUpGain(member, specialty, skill, production, levelUp);
  const span = (
    <Tooltip
      wide
      label={t("levelUp.spanAria", {
        from: member.level,
        to: levelUp.target_level,
        candies: fmtInt(levelUp.candies),
        shards: fmtInt(levelUp.dream_shards),
      })}
      content={
        <LevelUpTooltip
          member={member}
          production={production}
          levelUp={levelUp}
          tierBySubSkill={tierBySubSkill}
        />
      }
    >
      <span className="levelup-span strength-value__cue" tabIndex={0}>
        {t("levelUp.span", { from: member.level, to: levelUp.target_level })}
      </span>
    </Tooltip>
  );
  const cost = (
    <span className="levelup-cost">
      <span className="box-entry__metric" title={t("levelUp.candies")}>
        <img className="mini-icon mini-icon--candy" src={GENERIC_CANDY_ICON} alt="" aria-hidden="true" />
        <span className="box-entry__metric-value">{fmtInt(levelUp.candies)}</span>
      </span>
      <span className="box-entry__metric" title={t("levelUp.shards")}>
        <img className="mini-icon" src={SHARD_ICON} alt="" aria-hidden="true" />
        <span className="box-entry__metric-value">{fmtInt(levelUp.dream_shards)}</span>
      </span>
    </span>
  );
  if (layout === "section")
    return (
      <>
        <div className="box-entry__divider box-entry__divider--levelup" aria-hidden="true" />
        <span className="box-entry__label box-entry__label--next">{t("box.labelNextLevel")}</span>
        <span className="box-entry__levelup-next">
          {span}
          <GainPill gain={gain} />
        </span>
        <span className="box-entry__label box-entry__label--cost">{t("box.labelCost")}</span>
        <span className="box-entry__levelup-cost">{cost}</span>
      </>
    );
  return (
    <div className="box-entry__levelup">
      {span}
      <GainPill gain={gain} />
      {cost}
    </div>
  );
}
