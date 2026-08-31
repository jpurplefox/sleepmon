import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "../api/client";
import { useI18n } from "../i18n";
import { useProgress } from "../useProgress";
import { Modal } from "./Modal";
import { Placeholder } from "./Placeholder";
import { ProgressAreasTab } from "./ProgressAreasTab";
import { ProgressKitchenTab } from "./ProgressKitchenTab";
import { ProgressRecipesTab } from "./ProgressRecipesTab";

type TabId = "kitchen" | "recipes" | "areas";

const TABS: { id: TabId; labelKey: string }[] = [
  { id: "kitchen", labelKey: "progress.tabKitchen" },
  { id: "recipes", labelKey: "progress.tabRecipes" },
  { id: "areas", labelKey: "progress.tabAreas" },
];

export function ProgressModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabId>("kitchen");
  const { progress, isLoading, isError, save, saveAsync, saveError } = useProgress();
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: api.getRecipes });

  const loading = isLoading || catalog.isLoading || recipes.isLoading;

  return (
    <Modal title={t("progress.title")} onClose={onClose} wide>
      <div className="settings-modal-tabs" role="tablist">
        {TABS.map(({ id, labelKey }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className={"specialty-toggle__btn" + (activeTab === id ? " is-on" : "")}
            onClick={() => setActiveTab(id)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <div className="settings-modal-panel">
        {saveError && <p className="error" role="alert">{t("progress.saveError")}</p>}
        {isError && <p className="error" role="alert">{t("progress.loadError")}</p>}
        {loading ? (
          <Placeholder loading>{t("teams.calculating")}</Placeholder>
        ) : (
          (activeTab === "kitchen" && (
            <ProgressKitchenTab
              progress={progress}
              recipes={recipes.data ?? []}
              potLadder={catalog.data?.pot_ladder ?? []}
              onSave={save}
            />
          )) ||
          (activeTab === "recipes" && (
            <ProgressRecipesTab
              progress={progress}
              recipes={recipes.data ?? []}
              levelBonus={catalog.data?.recipe_level_bonus ?? []}
              onSave={save}
            />
          )) ||
          (activeTab === "areas" && (
            <ProgressAreasTab
              progress={progress}
              islands={catalog.data?.islands ?? []}
              onSave={saveAsync}
            />
          ))
        )}
      </div>
    </Modal>
  );
}
