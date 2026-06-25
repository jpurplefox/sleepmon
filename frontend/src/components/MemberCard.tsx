import { INGREDIENT_UNLOCK_LEVELS } from "../constants";
import { ingredientIcon } from "../ingredients";
import { spriteUrl } from "../sprites";
import type { Member, Nature } from "../types";

interface Props {
  member: Member;
  nature?: Nature;
  dex?: number;
  onDelete: (id: string) => void;
}

export function MemberCard({ member, nature, dex, onDelete }: Props) {
  return (
    <article className="card member-card">
      <header className="member-card__head">
        <div className="member-card__title">
          {dex !== undefined && (
            <img className="member-card__sprite" src={spriteUrl(dex)} alt="" loading="lazy" />
          )}
          <div>
            <h3>{member.species}</h3>
          </div>
        </div>
        <span className="badge">Nv. {member.level}</span>
      </header>

      <dl className="member-card__body">
        <div>
          <dt>Naturaleza</dt>
          <dd>
            {member.nature}
            {nature && !nature.neutral && (
              <span className="nature-effect">
                {" "}
                <span className="up">↑{nature.increased}</span>{" "}
                <span className="down">↓{nature.decreased}</span>
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Ingredientes</dt>
          <dd className="ingredient-row">
            {member.ingredients.map((ing, idx) => {
              const locked = member.level < (INGREDIENT_UNLOCK_LEVELS[idx] ?? 1);
              return (
                <img
                  key={`${ing}-${idx}`}
                  className={
                    "ingredient-row__icon" + (locked ? " ingredient-row__icon--locked" : "")
                  }
                  src={ingredientIcon(ing)}
                  alt={ing}
                  title={locked ? `${ing} (se desbloquea a nivel ${INGREDIENT_UNLOCK_LEVELS[idx]})` : ing}
                  loading="lazy"
                />
              );
            })}
          </dd>
        </div>
        <div>
          <dt>Sub skills</dt>
          <dd className="chips">
            {member.sub_skills.length === 0 && <span className="muted">—</span>}
            {member.sub_skills.map((s, idx) => (
              <span className="chip chip--subskill" key={`${s}-${idx}`}>
                {s}
              </span>
            ))}
          </dd>
        </div>
      </dl>

      <button className="btn btn--ghost" onClick={() => onDelete(member.id)}>
        Eliminar
      </button>
    </article>
  );
}
