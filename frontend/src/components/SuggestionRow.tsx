import { useI18n } from "../i18n";
import { RIBBONS } from "../constants";
import { spriteUrl } from "../sprites";
import type { Member, Nature } from "../types";
import { IngredientLineup } from "./IngredientLineup";
import { MemberConfig } from "./MemberConfig";
import { RibbonIcon } from "./RibbonIcon";

interface SuggestionRowProps {
  member: Member;
  dex: number;
  mainSkillName: string | undefined;
  natureMeta: Nature | undefined;
  tierBySubSkill: (name: string) => string | undefined;
  onPick: (m: Member) => void;
}

// A suggested Box Pokémon in Comparison's add card (design system: `.sug-row`): the
// card's title on top, a large sprite beside the build in the cards' order.
export function SuggestionRow({ member: m, dex, mainSkillName, natureMeta, tierBySubSkill, onPick }: SuggestionRowProps) {
  const { t } = useI18n();
  const ribbonIdx = RIBBONS.findIndex((r) => r.name === m.ribbon);
  return (
    <button
      type="button"
      className="sug-row"
      aria-label={t("prod.suggestionAdd", { name: m.species, level: m.level })}
      onClick={() => onPick(m)}
    >
      <div className="prod-card__title">
        <strong>{m.species}</strong> <span className="muted">{t("common.level", { level: m.level })}</span>
        {ribbonIdx > 0 && (
          <RibbonIcon index={ribbonIdx} size={18} title={t("member.ribbon", { hours: RIBBONS[ribbonIdx].hours })} />
        )}
      </div>
      <div className="sug-row__body">
        <img className="sug-row__sprite" src={spriteUrl(dex)} alt="" loading="lazy" />
        <div className="sug-row__build">
          <div className="sug-row__ings">
            <IngredientLineup level={m.level} ingredients={m.ingredients} />
          </div>
          <div className="sug-row__config prod-box-item__config">
            <MemberConfig
              level={m.level}
              nature={m.nature}
              ingredients={m.ingredients}
              subSkills={m.sub_skills}
              skillLevel={m.skill_level}
              natureMeta={natureMeta}
              mainSkillName={mainSkillName}
              tierBySubSkill={tierBySubSkill}
              showSkillLevel={false}
              showIngredients={false}
              natureAsCard
            />
          </div>
        </div>
      </div>
    </button>
  );
}
