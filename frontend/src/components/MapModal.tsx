import type { ComponentProps } from "react";

import { useI18n } from "../i18n";
import { IslandTab } from "./IslandTab";
import { Modal } from "./Modal";

type Props = ComponentProps<typeof IslandTab> & {
  /** True when the last save attempt failed. */
  saveError?: boolean;
  onClose: () => void;
};

export function MapModal({ saveError = false, onClose, ...island }: Props) {
  const { t } = useI18n();
  return (
    <Modal title={t("teams.tabIsland")} onClose={onClose} wide>
      {saveError && (
        <p className="error" role="alert">
          {t("progress.saveError")}
        </p>
      )}
      <IslandTab {...island} />
    </Modal>
  );
}
