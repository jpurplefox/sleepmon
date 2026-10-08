import { useId, useState } from "react";

import { useI18n } from "../i18n";
import { MAX_TEAM_NAME, nameError, type BoxWrite, type NameError } from "../savedTeams";
import type { SavedTeam } from "../types";
import { Modal } from "./Modal";

const NAME_ERROR_KEY: Record<NameError, string> = {
  empty: "saved.nameEmpty",
  tooLong: "saved.nameTooLong",
  taken: "saved.nameTaken",
};

interface Props {
  title: string;
  /** Start value of the name field; null hides it (saving over the open team). */
  initialName: string | null;
  /** Every saved team, to refuse a name already in use. */
  teams: readonly SavedTeam[];
  /** The team being renamed or saved over, whose own name is fine. */
  ownId: string | null;
  /** What saving writes to the Box first, listed before confirming. */
  writes?: readonly BoxWrite[];
  confirmLabel: string;
  pending: boolean;
  /** A server refusal, shown under the field. */
  serverError: string | null;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

/** Names a team (save, save as, rename) and lists what saving sends to the Box (PRD 0016). */
export function TeamNameDialog({
  title,
  initialName,
  teams,
  ownId,
  writes = [],
  confirmLabel,
  pending,
  serverError,
  onConfirm,
  onClose,
}: Props) {
  const { t } = useI18n();
  const inputId = useId();
  const errorId = useId();
  const [name, setName] = useState(initialName ?? "");
  // Validation speaks once the user has tried to confirm, not on the first keystroke.
  const [tried, setTried] = useState(false);
  const withName = initialName !== null;
  const error = withName ? nameError(name, teams, ownId) : null;
  const message = (tried && error ? t(NAME_ERROR_KEY[error]) : null) ?? serverError;

  const submit = () => {
    setTried(true);
    if (error || pending) return;
    onConfirm(name);
  };

  return (
    <Modal title={title} onClose={() => !pending && onClose()}>
      <form
        className="team-name-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {withName && (
          <div className="team-name-form__field">
            <label htmlFor={inputId}>{t("saved.nameLabel")}</label>
            <input
              id={inputId}
              type="text"
              value={name}
              maxLength={MAX_TEAM_NAME + 10}
              autoComplete="off"
              data-autofocus
              aria-invalid={message ? true : undefined}
              aria-describedby={message ? errorId : undefined}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        {message && (
          <p className="error" id={errorId} role="alert">
            {message}
          </p>
        )}
        {writes.length > 0 && (
          <div className="team-name-form__writes">
            <p className="muted">{t("saved.boxWritesLead")}</p>
            <ul>
              {writes.map((w) => (
                <li key={w.entry.id}>
                  <span>{w.entry.config.species}</span>
                  <span className="muted">
                    {w.kind === "new" ? t("saved.writeNew") : t("saved.writeUpdate")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={pending}
            data-autofocus={withName ? undefined : true}
          >
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn--primary" disabled={pending}>
            {pending ? t("saved.saving") : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
