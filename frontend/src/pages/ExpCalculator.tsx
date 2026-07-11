import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { LevelSelector } from "../components/LevelSelector";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import type { CandyBoost, ExpNatureModifier, GrowthCurve } from "../types";

const MAX_LEVEL = 70;
const CURVES: GrowthCurve[] = ["normal", "pseudo_legendary", "legendary", "mythical"];
const BOOSTS: CandyBoost[] = ["none", "full", "mini"];

export function ExpCalculator() {
  const { t } = useI18n();
  const [current, setCurrent] = useState(1);
  const [target, setTarget] = useState(10);
  const [curve, setCurve] = useState<GrowthCurve>("normal");
  const [nature, setNature] = useState<ExpNatureModifier>("neutral");
  const [boost, setBoost] = useState<CandyBoost>("none");

  const valid = current >= 1 && target > current && target <= MAX_LEVEL;

  const query = useQuery({
    queryKey: ["exp-calculator", current, target, curve, nature, boost],
    queryFn: () =>
      api.computeLevelUpCost({
        current_level: current,
        target_level: target,
        curve,
        nature,
        boost,
      }),
    enabled: valid,
  });

  const result = query.data;
  const toggleNature = (n: ExpNatureModifier) =>
    setNature((prev) => (prev === n ? "neutral" : n));

  return (
    <div className="card exp-calc">
      <h2>{t("expCalc.title")}</h2>
      <p className="muted">{t("expCalc.intro")}</p>

      <div className="exp-calc__group">
        <LevelSelector
          value={current}
          onChange={setCurrent}
          max={MAX_LEVEL}
          label={t("expCalc.currentLevel")}
        />
        <LevelSelector
          value={target}
          onChange={setTarget}
          max={MAX_LEVEL}
          label={t("expCalc.targetLevel")}
        />
      </div>

      <div className="exp-calc__group">
        <p className="exp-calc__label">{t("expCalc.curve")}</p>
        <div className="option-toggle">
          {CURVES.map((c) => (
            <button
              type="button"
              key={c}
              className={"option-toggle__btn" + (curve === c ? " is-on" : "")}
              onClick={() => setCurve(c)}
            >
              {t(`expCalc.curve.${c}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="exp-calc__group">
        <p className="exp-calc__label">{t("expCalc.nature")}</p>
        <div className="option-toggle">
          <button
            type="button"
            className={"option-toggle__btn up" + (nature === "up" ? " is-on" : "")}
            onClick={() => toggleNature("up")}
          >
            {t("expCalc.nature.up")}
          </button>
          <button
            type="button"
            className={"option-toggle__btn down" + (nature === "down" ? " is-on" : "")}
            onClick={() => toggleNature("down")}
          >
            {t("expCalc.nature.down")}
          </button>
        </div>
      </div>

      <div className="exp-calc__group">
        <p className="exp-calc__label">{t("expCalc.boost")}</p>
        <div className="option-toggle">
          {BOOSTS.map((b) => (
            <button
              type="button"
              key={b}
              className={"option-toggle__btn" + (boost === b ? " is-on" : "")}
              onClick={() => setBoost(b)}
            >
              {t(`expCalc.boost.${b}`)}
            </button>
          ))}
        </div>
      </div>

      {!valid && (
        <p className="exp-calc__error" role="alert">
          {t("expCalc.error.range")}
        </p>
      )}

      {valid && !result && (
        <p className="exp-calc__empty" role="status">
          {t("expCalc.empty")}
        </p>
      )}

      {valid && result && (
        <>
          <div className="exp-calc__result">
            <div className="exp-calc__metric">
              <span className="exp-calc__value">
                {result.candies.toLocaleString()}
              </span>
              <span className="exp-calc__metric-label">
                {t("expCalc.result.candies")}
              </span>
            </div>
            <div className="exp-calc__metric">
              <span className="exp-calc__value">
                {result.dream_shards.toLocaleString()}
              </span>
              <span className="exp-calc__metric-label">
                {t("expCalc.result.dreamShards")}
              </span>
            </div>
          </div>
          <p className="exp-calc__note">
            {t("expCalc.result.totalExp", { n: result.total_exp.toLocaleString() })}
          </p>
          {result.boosted_candies > 0 && (
            <p className="exp-calc__note">
              {t("expCalc.result.boostedNote", { n: result.boosted_candies })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
