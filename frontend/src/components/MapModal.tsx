import { useI18n } from "../i18n";
import type { Catalog, WeeklyBonus } from "../types";
import { IslandTab } from "./IslandTab";
import { Modal } from "./Modal";

interface Props {
  catalog: Catalog;
  selectedIsland: string | null;
  favoriteBerries: string[];
  islandBonus: number;
  bonusDisabled: boolean;
  mainFavorite: string | null;
  weeklyBonus: WeeklyBonus;
  onSelectIsland: (name: string | null) => void;
  onFavoriteBerries: (berries: string[]) => void;
  onIslandBonus: (bonus: number) => void;
  onMainFavorite: (berry: string | null) => void;
  onWeeklyBonus: (bonus: WeeklyBonus) => void;
  /** True when the shown area bonus differs from what is saved. */
  bonusUnsaved: boolean;
  /** The saved area bonus, in percentage points. */
  savedBonusPct: number;
  onSaveBonus: () => void;
  /** True when the last save attempt failed. */
  saveError?: boolean;
  onClose: () => void;
}

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
