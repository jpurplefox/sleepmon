import { Fragment, useId, useState } from "react";

import { emailMatches, type AccountSummary } from "../account";
import { useI18n } from "../i18n";
import { useDeleteAccount } from "../useDeleteAccount";
import { Modal } from "./Modal";

interface Props {
  email: string;
  summary: AccountSummary;
  onClose: () => void;
  onDeleted: () => void;
}

/** Renders `**bold**` spans of a translated string as <strong>. */
function withStrong(text: string) {
  return text.split("**").map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>));
}

/** Confirmation for deleting the account: what is lost, then the typed email. */
export function DeleteAccountDialog({ email, summary, onClose, onDeleted }: Props) {
  const { t } = useI18n();
  const inputId = useId();
  const errorId = useId();
  const [typed, setTyped] = useState("");
  const { remove, pending, error } = useDeleteAccount(onDeleted);

  const { boxSize, savedTeams, hasProfile } = summary;
  const parts = [
    t("account.lossAccount"),
    boxSize === 0
      ? t("account.lossBoxEmpty")
      : t(boxSize === 1 ? "account.lossBoxOne" : "account.lossBox", { n: boxSize }),
    savedTeams === 0
      ? t("account.lossTeamsNone")
      : t(savedTeams === 1 ? "account.lossTeamsOne" : "account.lossTeams", { n: savedTeams }),
    ...(hasProfile ? [t("account.lossProfile")] : []),
  ];
  const list = `${parts.slice(0, -1).join(", ")}${t("saved.and")}${parts[parts.length - 1]}`;

  return (
    // Not closable while the request is in flight: the outcome must stay in view.
    <Modal title={t("account.deleteTitle")} onClose={() => !pending && onClose()}>
      <form
        className="delete-account-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending && emailMatches(typed, email)) remove(summary);
        }}
      >
        <p>{withStrong(t("account.deleteLoss", { list }))}</p>
        <p className="muted">{t("account.deleteUndone")}</p>
        <div className="delete-account-form__field">
          <label htmlFor={inputId}>
            {t("account.deleteConfirmLabel")} <span className="muted">({email})</span>
          </label>
          <input
            id={inputId}
            type="email"
            value={typed}
            placeholder={email}
            autoComplete="off"
            spellCheck={false}
            data-autofocus
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        {error && (
          <p className="error" id={errorId} role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn--danger" disabled={pending || !emailMatches(typed, email)}>
            {pending ? t("account.deleting") : t("account.deleteConfirm")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
