import { useI18n } from "../i18n";
import { IMPORT_FIELD_ORDER } from "../screenshotImport";
import type { ImportField } from "../types";
import { IconCheck } from "./icons";

const LABEL: Record<ImportField, string> = {
  nature: "form.nature",
  level: "form.level",
  ingredients: "form.ingredients",
  sub_skills: "form.subSkills",
  skill_level: "form.skillLevel",
  ribbon: "form.ribbon",
};

/** How an imported form was filled, naming what is left to check. */
export function FormSummary({ images, unread }: { images: number; unread: ImportField[] }) {
  const { t, lang } = useI18n();
  const summary = images === 1 ? t("import.summaryOne") : t("import.summary", { n: images });
  const names = IMPORT_FIELD_ORDER.filter((f) => unread.includes(f)).map((f) => t(LABEL[f]));
  const text = names.length
    ? t("import.summaryCheck", {
        summary,
        fields: new Intl.ListFormat(lang, { type: "conjunction" }).format(names),
      })
    : summary;
  return (
    <div className="form-summary" role="status">
      <IconCheck aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
