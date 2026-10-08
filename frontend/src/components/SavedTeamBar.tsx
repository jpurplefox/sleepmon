import { useI18n } from "../i18n";
import { IconClose, IconEdit } from "./icons";

interface Props {
  /** The open saved team's name, or null for a team not yet saved. */
  teamName: string | null;
  unsaved: boolean;
  saving: boolean;
  /** False with no members: a saved team is never empty. */
  canSave: boolean;
  onSave: () => void;
  onSaveAs: () => void;
  /** Renames the open team: the only place a team is renamed. */
  onRename: () => void;
  onClose: () => void;
}

/** Team Analysis's saved-team actions, at the right of its title (PRD 0016). */
export function SavedTeamBar({
  teamName,
  unsaved,
  saving,
  canSave,
  onSave,
  onSaveAs,
  onRename,
  onClose,
}: Props) {
  const { t } = useI18n();

  if (teamName === null) {
    return (
      <div className="saved-team-bar">
        <button
          type="button"
          className="btn btn--primary"
          onClick={onSave}
          disabled={!canSave || saving}
        >
          {saving ? t("saved.saving") : t("saved.saveTeam")}
        </button>
      </div>
    );
  }

  return (
    <div className="saved-team-bar">
      <span className="saved-team-bar__team">
        <span className="sr-only">{t("saved.openedTeam")}: </span>
        <button
          type="button"
          className="saved-team-bar__name"
          title={t("saved.renameTeam", { name: teamName })}
          aria-label={t("saved.renameTeam", { name: teamName })}
          onClick={onRename}
        >
          <span className="saved-team-bar__name-text">{teamName}</span>
          <IconEdit />
        </button>
        {unsaved && (
          <span className="progress-diff saved-team-bar__unsaved">
            <span className="progress-diff__label">{t("saved.unsaved")}</span>
          </span>
        )}
        <button
          type="button"
          className="icon-btn"
          aria-label={t("saved.closeTeam")}
          title={t("saved.closeTeam")}
          onClick={onClose}
        >
          <IconClose />
        </button>
      </span>
      <button
        type="button"
        className="btn btn--primary"
        onClick={onSave}
        disabled={!unsaved || !canSave || saving}
      >
        {saving ? t("saved.saving") : t("saved.save")}
      </button>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={onSaveAs}
        disabled={!canSave || saving}
      >
        {t("saved.saveAs")}
      </button>
    </div>
  );
}
