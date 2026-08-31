import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { api } from "../api/client";
import { useI18n } from "../i18n";
import { applyProgressPatch, diffProgress } from "../progress";
import { useProgress } from "../useProgress";
import type { PlayerProgress, ProgressPatch } from "../types";
import { ExitConfirm } from "./ExitConfirm";
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
  const {
    progress,
    isLoading: progressLoading,
    isError,
    saveAsync,
    saveError,
  } = useProgress();
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.getCatalog });
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: api.getRecipes });

  const loading = progressLoading || catalog.isLoading || recipes.isLoading;

  // The draft: a private copy of `progress`, edited in memory — no PATCH fires
  // while editing. Seeded once the query resolves; a later external change to
  // `progress` (e.g. a save from another tab) is not re-applied, so it can
  // never clobber an edit already in progress.
  const [draft, setDraft] = useState<PlayerProgress | null>(null);
  useEffect(() => {
    if (draft === null && !progressLoading) setDraft(progress);
    // Seeds exactly once, the first time the query resolves — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressLoading]);

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const patch: ProgressPatch = draft ? diffProgress(progress, draft) : {};
  const hasChanges = Object.keys(patch).length > 0;
  const ready = !loading && draft !== null;

  const onDraftChange = (delta: ProgressPatch): void =>
    setDraft((prev) => (prev ? applyProgressPatch(prev, delta) : prev));

  // Funnels every way of leaving (✕, Escape, overlay click, the footer's
  // Cancelar) through one place. While the question is already showing, this
  // just cancels it instead of stacking another — so Escape reads as "cancelar".
  const requestClose = (): void => {
    if (showExitConfirm) {
      setShowExitConfirm(false);
      return;
    }
    if (!hasChanges) {
      onClose();
      return;
    }
    setShowExitConfirm(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!hasChanges) return;
    try {
      await saveAsync(patch);
      onClose();
    } catch {
      // The mutation's own error surfaces via `saveError` below; the modal
      // stays open with the draft intact so nothing typed is lost.
    }
  };

  return (
    <Modal title={t("progress.title")} onClose={requestClose} wide>
      {showExitConfirm ? (
        <ExitConfirm
          message={t("progress.exitConfirmMessage")}
          onSave={() => {
            setShowExitConfirm(false);
            void handleSave();
          }}
          onDiscard={onClose}
          onCancel={() => setShowExitConfirm(false)}
        />
      ) : (
        <>
          <div className="settings-modal-tabs" role="tablist">
            {TABS.map(({ id, labelKey }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`progress-tab-${id}`}
                aria-controls="progress-panel"
                aria-selected={activeTab === id}
                className={
                  "specialty-toggle__btn" + (activeTab === id ? " is-on" : "")
                }
                onClick={() => setActiveTab(id)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          <div
            id="progress-panel"
            role="tabpanel"
            aria-labelledby={`progress-tab-${activeTab}`}
            className="settings-modal-panel"
          >
            {saveError && (
              <p className="error" role="alert">
                {t("progress.saveError")}
              </p>
            )}
            {isError && (
              <p className="error" role="alert">
                {t("progress.loadError")}
              </p>
            )}
            {ready && draft ? (
              (activeTab === "kitchen" && (
                <ProgressKitchenTab
                  draft={draft}
                  recipes={recipes.data ?? []}
                  potLadder={catalog.data?.pot_ladder ?? []}
                  onChange={onDraftChange}
                />
              )) ||
              (activeTab === "recipes" && (
                <ProgressRecipesTab
                  draft={draft}
                  recipes={recipes.data ?? []}
                  levelBonus={catalog.data?.recipe_level_bonus ?? []}
                  onChange={onDraftChange}
                />
              )) ||
              (activeTab === "areas" && (
                <ProgressAreasTab
                  draft={draft}
                  islands={catalog.data?.islands ?? []}
                  onChange={onDraftChange}
                />
              ))
            ) : (
              <Placeholder loading>{t("progress.loading")}</Placeholder>
            )}
          </div>

          {ready && (
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={requestClose}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!hasChanges}
                onClick={() => void handleSave()}
              >
                {t("progress.save")}
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
