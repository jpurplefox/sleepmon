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
  return (
    <span
      className="snorlax-rating-badge"
      aria-label={t("teams.rating.aria", { island: islandName })}
    >
      <img
        className="snorlax-rating-badge__ball"
        src={BALL[reached.tier]}
        alt=""
        width={18}
        height={18}
      />
      <span className="snorlax-rating-badge__level">{reached.level}</span>
      <span className="snorlax-rating-badge__next">
        {next
          ? t("teams.rating.toNext", { remaining: fcompact(remaining) })
          : t("teams.rating.max")}
      </span>
    </span>
  );
}
