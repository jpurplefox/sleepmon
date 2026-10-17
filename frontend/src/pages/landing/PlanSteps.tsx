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

/** When each phase of a step starts, in ms from the step's start. */
export function planTimeline(id: PlanStepId, berries: number): number[] {
  switch (id) {
    // One card dealt per phase.
    case "team":
      return CARDS.map((k) => 300 + (k - 1) * 350);
    // Per berry: the pointer reaches it, then clicks; then the dialog settles, the cards return, and they tint.
    case "map": {
      const clicks = Array.from({ length: berries }, (_, k) => [700 + k * 1100, 1300 + k * 1100]).flat();
      const done = 1300 + (berries - 1) * 1100;
      return [...clicks, done + 900, done + 1900, done + 2500];
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
  const berries = marks.planBerries;

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
        const n = berries.length;
        // Phases 2k+1 (reach) and 2k+2 (click) belong to berry k.
        const current = Math.min(Math.max(Math.ceil(p / 2) - 1, 0), n - 1);
        const settled = at(2 * n + 1);
        const back = at(2 * n + 2);
        return (
          <>
            <div className={"landing-demo landing-stage__layer" + (back ? " is-off" : "")}>
              {img("plan-map-before", "landing-demo__base")}
              {img("plan-map-after", "landing-demo__over" + (settled ? " is-on" : ""))}
              {berries.map((r, k) => (
                <span key={k} className={"landing-demo__pick" + (at(2 * k + 2) && !settled ? " is-on" : "")} style={box(r)} aria-hidden="true" />
              ))}
              <Pointer
                style={at(1) ? aim(berries[current]) : { left: "85%", top: "110%" }}
                clicking={p >= 2 && p <= 2 * n && p % 2 === 0}
                gone={!at(1) || settled}
              />
            </div>
            <div className={"landing-stage__layer landing-stage__layer--wide" + (back ? "" : " is-off")}>{deal(CARDS.length, at(2 * n + 3))}</div>
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
        times: planTimeline(id, berries.length),
        render: (p: number) => frame(id, p),
      }))}
    />
  );
}
