import { useI18n } from "../i18n";
import { Tooltip } from "./Tooltip";

interface Props {
  /** False renders nothing at all — no pill, no placeholder, no reserved space. */
  unsaved: boolean;
  /** The saved value, already formatted (e.g. "35%"). Shown in the tooltip. */
  savedLabel: string;
  onSave: () => void;
}

/**
 * Marks a value changed but not saved into Player progress, and offers to save it.
 * The saved value lives in the tooltip rather than beside the control: the same mark
 * repeats across nine areas and seventy recipes.
 */
export function UnsavedMark({ unsaved, savedLabel, onSave }: Props) {
  const { t } = useI18n();
  if (!unsaved) return null;

  return (
    <Tooltip
      content={
        <Tooltip.Row>
          <Tooltip.Label>{t("progress.savedValue")}</Tooltip.Label>
          <Tooltip.Value>{savedLabel}</Tooltip.Value>
        </Tooltip.Row>
      }
      // `content` is not a string, so the accessible name has to be given explicitly.
      label={`${t("progress.savedValue")}: ${savedLabel}`}
    >
      <span className="progress-diff">
        <span className="progress-diff__label">{t("progress.unsaved")}</span>
        <button type="button" className="progress-diff__save" onClick={onSave}>
          {t("progress.save")}
        </button>
      </span>
    </Tooltip>
  );
}
