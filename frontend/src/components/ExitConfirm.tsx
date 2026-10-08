import { useI18n } from "../i18n";

interface Props {
  /** Explains what leaving without saving means here — Player progress and Team
   * Analysis word this differently, so the caller supplies it. */
  message: string;
  /** The discard button's label; "salir sin guardar" unless the caller words it. */
  discardLabel?: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/**
 * The "leave with changes?" question (PRD 0011: guardar / salir sin guardar /
 * cancelar), rendered as a small card in place of the modal's own content —
 * never as a second `Modal`, so there is only one focus trap and one Escape
 * handler. `ProgressModal` uses it for its draft, and saved teams (PRD 0016) for
 * replacing a session whose team has unsaved changes.
 */
export function ExitConfirm({ message, discardLabel, onSave, onDiscard, onCancel }: Props) {
  const { t } = useI18n();
  return (
    <div className="progress-exit-confirm">
      <p>{message}</p>
      <div className="modal-actions modal-actions--center">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onDiscard}>
          {discardLabel ?? t("progress.leaveWithoutSaving")}
        </button>
        <button type="button" className="btn btn--primary" onClick={onSave}>
          {t("progress.save")}
        </button>
      </div>
    </div>
  );
}
