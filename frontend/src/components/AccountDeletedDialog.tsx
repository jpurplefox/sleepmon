import { useI18n } from "../i18n";
import { Modal } from "./Modal";

/** Shown once the account is gone and the app is signed out. */
export function AccountDeletedDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal title={t("account.deletedTitle")} onClose={onClose}>
      <p>{t("account.deletedBody")}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn--primary" data-autofocus onClick={onClose}>
          {t("account.deletedOk")}
        </button>
      </div>
    </Modal>
  );
}
