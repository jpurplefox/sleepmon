import type { Member, Nature } from "../types";

interface Props {
  member: Member;
  nature?: Nature;
  onDelete: (id: string) => void;
}

export function MemberCard({ member, nature, onDelete }: Props) {
  return (
    <article className="card member-card">
      <header className="member-card__head">
        <div>
          <h3>{member.nickname ?? member.species}</h3>
          {member.nickname && <span className="muted">{member.species}</span>}
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
          <dd className="chips">
            {member.ingredients.map((i, idx) => (
              <span className="chip chip--ingredient" key={`${i}-${idx}`}>
                {i}
              </span>
            ))}
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
