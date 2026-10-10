// Sub-skill icons, served from /public/subskill as one SVG per sub skill: the
// tier letter (S/M/L) is part of the icon, so Helping Speed S and M differ. The
// file name is the sub skill's name in kebab case ("Helping Speed S" →
// helping-speed-s.svg).
export function subSkillIcon(name: string): string {
  return `/subskill/${name.toLowerCase().replace(/\s+/g, "-")}.svg`;
}
