import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useI18n } from "../i18n";
import type { CandyBoost, ExpNatureModifier, GrowthCurve } from "../types";

const MAX_LEVEL = 55;
const TARGET_SHORTCUTS = [10, 25, 30, 50, 55];
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

  const shortcuts = useMemo(
    () => TARGET_SHORTCUTS.filter((l) => l > current),
    [current],
  );

  return (
    <div className="layout">
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <div className="form__row">
          <label>
            {t("expCalc.currentLevel")}
            <input
              type="number"
              min={1}
              max={MAX_LEVEL - 1}
              value={current}
              onChange={(e) => setCurrent(Number(e.target.value))}
            />
          </label>
          <label>
            {t("expCalc.targetLevel")}
            <input
              type="number"
              min={2}
              max={MAX_LEVEL}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="level-shortcuts">
          {shortcuts.map((lvl) => (
            <button
              type="button"
              key={lvl}
              className={"level-chip" + (target === lvl ? " level-chip--active" : "")}
              onClick={() => setTarget(lvl)}
            >
              {lvl}
            </button>
          ))}
        </div>

        <fieldset className="calc-group">
          <legend>{t("expCalc.curve")}</legend>
          <div className="calc-options">
            {CURVES.map((c) => (
              <button
                type="button"
                key={c}
                className={"chip" + (curve === c ? " chip--active" : "")}
                onClick={() => setCurve(c)}
              >
                {t(`expCalc.curve.${c}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="calc-group">
          <legend>{t("expCalc.nature")}</legend>
          <div className="calc-options">
            <button
              type="button"
              className={"chip" + (nature === "up" ? " chip--active" : "")}
              onClick={() => toggleNature("up")}
            >
              {t("expCalc.nature.up")}
            </button>
            <button
              type="button"
              className={"chip" + (nature === "down" ? " chip--active" : "")}
              onClick={() => toggleNature("down")}
            >
              {t("expCalc.nature.down")}
            </button>
          </div>
        </fieldset>

        <fieldset className="calc-group">
          <legend>{t("expCalc.boost")}</legend>
          <div className="calc-options">
            {BOOSTS.map((b) => (
              <button
                type="button"
                key={b}
                className={"chip" + (boost === b ? " chip--active" : "")}
                onClick={() => setBoost(b)}
              >
                {t(`expCalc.boost.${b}`)}
              </button>
            ))}
          </div>
        </fieldset>
      </form>

      <div className="card">
        <h2>{t("expCalc.title")}</h2>
        <p className="muted">{t("expCalc.intro")}</p>
        {!valid && <p className="calc-error">{t("expCalc.error.range")}</p>}
        {valid && result && (
          <div className="calc-result">
            <div className="calc-result__item">
              <span className="calc-result__value">{result.candies}</span>
              <span className="calc-result__label">{t("expCalc.result.candies")}</span>
            </div>
            <div className="calc-result__item">
              <span className="calc-result__value">{result.dream_shards}</span>
              <span className="calc-result__label">
                {t("expCalc.result.dreamShards")}
              </span>
            </div>
          </div>
        )}
        {valid && result && result.boosted_candies > 0 && (
          <p className="muted">
            {t("expCalc.result.boostedNote", { n: result.boosted_candies })}
          </p>
        )}
      </div>
    </div>
  );
}
