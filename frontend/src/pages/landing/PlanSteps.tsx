import { useI18n } from "../../i18n";
import { PLAN_STEPS, shotUrl, type PlanStepId, type ShotName } from "./content";
import { MARKS, Pointer, aim, box, type Rect } from "./demo";
import { StepStory } from "./StepStory";

/** How long each step shows before the next one. */
export const PLAN_DURATIONS: Record<PlanStepId, number> = {
  team: 4500,
  map: 9000,
  meals: 7000,
  week: 7000,
};

const CARDS = [1, 2, 3, 4, 5] as const;

const HOVER_MS = 450;

/** When each phase of a step starts, in ms from the step's start. */
export function planTimeline(id: PlanStepId, mapTarget: number): number[] {
  switch (id) {
    // One card dealt per phase.
    case "team":
      return CARDS.map((k) => 300 + (k - 1) * 350);
    // One phase per map the pointer passes on its way down to the target, then click, the map
    // applied, the cards back, and their tint.
    case "map": {
      const hovers = Array.from({ length: mapTarget }, (_, k) => 900 + k * HOVER_MS);
      const atTarget = 900 + mapTarget * HOVER_MS;
      return [...hovers, atTarget + 300, atTarget + 900, atTarget + 2600, atTarget + 3200];
    }
    // The three recipes, then the cooking strength, then what is missing.
    case "meals":
      return [800, 1500, 2200, 3000, 3900];
    // Berries and skills, cooking, the day's total, the week (×7), the rating.
    case "week":
      return [600, 1300, 2000, 2900, 3800];
  }
}

/** A highlight band over a capture; `kind` picks its color (and names it for tests). */
function Band({ rect, on, kind }: { rect: Rect; on: boolean; kind: "recipe" | "up" | "down" | "accent" }) {
  return <span className={`landing-band landing-band--${kind}` + (on ? " is-on" : "")} style={box(rect)} data-kind={kind} aria-hidden="true" />;
}

/** The plan tile's story: build the team, pick the map, check the meals, see the week. */
export function PlanSteps() {
  const { t, lang } = useI18n();
  const marks = MARKS[lang];
  const maps = marks.planMaps;

  const img = (name: ShotName, className = "", alt = "") => (
    <img className={`landing-stage__shot landing-stage__shot--${name} ${className}`} src={shotUrl(name, lang)} alt={alt} loading="lazy" decoding="async" />
  );

  // The team's five cards fanned out; `tint` lays each card's favorite-berry version over it.
  const deal = (dealt: number, tint: boolean) => (
    <div className="landing-deal">
      {CARDS.map((k) => (
        <div key={k} className={`landing-deal__card landing-deal__card--${k}` + (dealt >= k ? " is-in" : "")}>
          {img(`plan-card-${k}`)}
          {img(`plan-fav-${k}`, "landing-deal__over" + (tint ? " is-on" : ""))}
        </div>
      ))}
    </div>
  );

  const frame = (step: PlanStepId, p: number) => {
    const at = (n: number) => p >= n;
    switch (step) {
      case "team":
        return deal(p, false);
      case "map": {
        const { options, target } = maps;
        const hover = options[Math.min(p, target)];
        const applied = at(target + 2);
        const back = at(target + 3);
        return (
          <>
            <div className={"landing-demo landing-stage__layer" + (back ? " is-off" : "")}>
              {img("plan-map-list", "landing-demo__base")}
              {img("plan-map", "landing-demo__over" + (applied ? " is-on" : ""))}
              <span className={"landing-demo__hover" + (at(target + 1) ? " is-picked" : "") + (applied ? " is-off" : "")} style={box(hover)} aria-hidden="true" />
              <Pointer style={aim(hover)} clicking={at(target + 1) && !applied} gone={applied} />
            </div>
            <div className={"landing-stage__layer landing-stage__layer--wide" + (back ? "" : " is-off")}>{deal(CARDS.length, at(target + 4))}</div>
          </>
        );
      }
      case "meals": {
        const { recipes, strength, missing } = marks.planCooking;
        return (
          <div className="landing-demo">
            {img("plan-cooking", "landing-demo__base")}
            {recipes.map((r, k) => (
              <Band key={k} rect={r} on={at(k + 1)} kind="recipe" />
            ))}
            <Band rect={strength} on={at(4)} kind="up" />
            <Band rect={missing} on={at(5)} kind="down" />
          </div>
        );
      }
      case "week": {
        const w = marks.planWeek;
        return (
          <div className="landing-demo">
            {/* The outcome; the steps already narrate the rest. */}
            {img("plan-totals", "landing-demo__base", t("landing.case.plan.alt"))}
            <Band rect={w.berries} on={at(1)} kind="accent" />
            <Band rect={w.cooking} on={at(2)} kind="accent" />
            <Band rect={w.grand} on={at(3)} kind="up" />
            <Band rect={w.weekly} on={at(4)} kind="up" />
            <Band rect={w.rating} on={at(5)} kind="accent" />
          </div>
        );
      }
    }
  };

  return (
    <StepStory
      steps={PLAN_STEPS.map((id) => ({
        id,
        label: t(`landing.plan.step.${id}`),
        durationMs: PLAN_DURATIONS[id],
        times: planTimeline(id, maps.target),
        render: (p: number) => frame(id, p),
      }))}
    />
  );
}
