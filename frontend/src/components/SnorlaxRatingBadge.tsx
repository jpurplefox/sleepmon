import { useI18n } from "../i18n";
import { resolveRating } from "../snorlaxRating";
import type { Rating, RatingTier } from "../types";

const BALL: Record<RatingTier, string> = {
  basic: "/poke-ball.png",
  great: "/great-ball.png",
  ultra: "/ultra-ball.png",
  master: "/master-ball.png",
};

interface Props {
  weeklyStrength: number;
  ratings: Rating[];
  islandName: string;
}

// Formatea la fuerza restante en forma compacta (12k / 1.2M).
function fcompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function SnorlaxRatingBadge({ weeklyStrength, ratings, islandName }: Props) {
  const { t } = useI18n();
  const resolved = resolveRating(weeklyStrength, ratings);
  if (!resolved) return null;
  const { reached, next, remaining } = resolved;
  // Tope del tramo actual, derivado de los datos (Basic/Great/Ultra = 5, Master = 20).
  const tierMax = ratings.filter((r) => r.tier === reached.tier).length;
  // Avance dentro del tramo actual hacia el siguiente rating (0–100).
  const pct = next
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((weeklyStrength - reached.required_strength) /
              (next.required_strength - reached.required_strength)) *
              100,
          ),
        ),
      )
    : 100;
  return (
    <span
      className="snorlax-rating-badge"
      aria-label={t("teams.rating.aria", {
        island: islandName,
        tier: reached.tier,
        level: reached.level,
        cap: tierMax,
      })}
    >
      <span className="snorlax-rating-badge__top">
        <img
          className="snorlax-rating-badge__ball"
          src={BALL[reached.tier]}
          alt=""
          width={18}
          height={18}
        />
        <span className="snorlax-rating-badge__level">
          {reached.level}/{tierMax}
        </span>
        <span
          className={
            next
              ? "snorlax-rating-badge__next"
              : "snorlax-rating-badge__next snorlax-rating-badge__next--max"
          }
        >
          {next
            ? t("teams.rating.toNext", { remaining: fcompact(remaining) })
            : t("teams.rating.max")}
        </span>
      </span>
      <span
        className="snorlax-rating-badge__bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className="snorlax-rating-badge__bar-fill"
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}
