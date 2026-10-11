// Screenshot import (PRD 0019): pure helpers shared by the dialog and the form.
import type { ImportField, ImportedForm, MemberInput, ScreenshotImport, Species } from "./types";

export const MAX_SHOTS = 3;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FORMATS = new Set(["image/png", "image/jpeg", "image/webp"]);

/** The form's order, which the summary line follows. */
export const IMPORT_FIELD_ORDER: ImportField[] = [
  "nature", "level", "ingredients", "sub_skills", "skill_level", "ribbon",
];

export type FileProblem = "format" | "size";

export function checkFile(file: { type: string; size: number }): FileProblem | null {
  if (!FORMATS.has(file.type)) return "format";
  if (file.size > MAX_FILE_BYTES) return "size";
  return null;
}

/** The form's starting values: what was read, and the create defaults for the rest. */
export function toImportedForm(r: ScreenshotImport, species: Species, images: number): ImportedForm {
  const ingredients = species.ingredient_slots.map((options, i) => r.ingredients[i] ?? options[0] ?? "");
  return {
    values: {
      species: r.species,
      level: r.level ?? 30,
      nature: r.nature ?? "",
      ingredients,
      sub_skills: r.sub_skills,
      ribbon: r.ribbon ?? "",
      skill_level: r.skill_level ?? 1,
      ...(r.versatile_skill ? { versatile_skill: r.versatile_skill } : {}),
    },
    unread: IMPORT_FIELD_ORDER.filter((f) => r.unread.includes(f)),
    images,
  };
}

const COVERS: Record<ImportField, (v: MemberInput) => string> = {
  nature: (v) => v.nature,
  level: (v) => String(v.level),
  ingredients: (v) => v.ingredients.join("|"),
  sub_skills: (v) => v.sub_skills.filter(Boolean).join("|"),
  skill_level: (v) => String(v.skill_level),
  ribbon: (v) => v.ribbon,
};

/** A mark goes away once the user changes the field it sits on. */
export function unreadAfterChange(unread: ImportField[], before: MemberInput, after: MemberInput): ImportField[] {
  return unread.filter((f) => COVERS[f](before) === COVERS[f](after));
}

// The daily-cap reset time, remembered for the session so a reopened dialog skips the round trip.
let knownResetAt: string | null = null;

/** Drops the remembered reset time (the signed-in account changed). */
export function forgetImportLimit(): void {
  knownResetAt = null;
}

export function rememberImportLimit(resetsAt: string | null): void {
  knownResetAt = resetsAt;
}

export function futureReset(): string | null {
  return knownResetAt && new Date(knownResetAt).getTime() > Date.now() ? knownResetAt : null;
}
