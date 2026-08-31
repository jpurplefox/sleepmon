import { useState } from "react";

import { useI18n } from "../i18n";
import { potBounds, recipeLevelOf, stepPot } from "../progress";
import { recipeImage } from "../recipes";
import type { PlayerProgress, ProgressPatch, Recipe } from "../types";
import { FilterPopover, gridKeyDown } from "./FilterPopover";
import { Stepper } from "./Stepper";

const DISH_TYPES: Recipe["type"][] = ["Curry", "Salad", "Dessert"];

interface Props {
  progress: PlayerProgress;
  recipes: Recipe[];
  potLadder: number[];
  onSave: (patch: ProgressPatch) => void;
}

export function ProgressKitchenTab({ progress, recipes, potLadder, onSave }: Props) {
  const { t } = useI18n();
  const { atMin, atMax } = potBounds(potLadder, progress.pot_size);
  const [openType, setOpenType] = useState<Recipe["type"] | null>(null);

  const movePot = (dir: 1 | -1) =>
    onSave({ pot_size: stepPot(potLadder, progress.pot_size, dir) });

  return (
    <>
      <div className="progress-section">
        <h3 className="progress-section__head">{t("progress.potSize")}</h3>
        {/* The stepper walks the game's real ladder, so it never spells the steps out. */}
        <Stepper
          className="progress-pot"
          onPrev={() => movePot(-1)}
          onNext={() => movePot(1)}
          disablePrev={atMin}
          disableNext={atMax}
          prevLabel={t("progress.potDown")}
          nextLabel={t("progress.potUp")}
          leading={<img src="/pot.webp" alt="" style={{ width: 26, height: 26 }} />}
          primary={t("progress.potUnit", { n: String(progress.pot_size) })}
        />
      </div>

      <div className="progress-section">
        <h3 className="progress-section__head">
          {t("progress.favorites")}
          <span className="muted">{t("progress.favoritesHint")}</span>
        </h3>
        {DISH_TYPES.map((type) => {
          const current = progress.favorite_recipes[type] ?? null;
          const options = recipes.filter((r) => r.type === type);
          return (
            <div key={type} className="progress-fav-row">
              <span className="progress-fav-row__type">{type}</span>
              <FilterPopover
                open={openType === type}
                onOpenChange={(isOpen) => setOpenType(isOpen ? type : null)}
                triggerLabel={`${t("progress.favorites")} — ${type}`}
                triggerContent={
                  current === null ? (
                    <span className="filter-btn__placeholder">{t("progress.noFavorite")}</span>
                  ) : (
                    <span className="filter-btn__value">
                      <img src={recipeImage(current)} alt="" className="progress-fav-row__img" />
                      {current}
                      <span className="badge badge--level">
                        Lv {recipeLevelOf(progress, current)}
                      </span>
                    </span>
                  )
                }
              >
                <div
                  className="filter-list"
                  role="listbox"
                  aria-label={`${t("progress.favorites")} — ${type}`}
                  onKeyDown={gridKeyDown}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={current === null}
                    className={"filter-list__item" + (current === null ? " is-selected" : "")}
                    onClick={() => {
                      onSave({ favorite_recipes: { [type]: null } });
                      setOpenType(null);
                    }}
                  >
                    <span className="filter-list__label">{t("progress.noFavorite")}</span>
                  </button>
                  {options.map((r) => (
                    <button
                      key={r.name}
                      type="button"
                      role="option"
                      aria-selected={r.name === current}
                      className={"filter-list__item" + (r.name === current ? " is-selected" : "")}
                      onClick={() => {
                        onSave({ favorite_recipes: { [type]: r.name } });
                        setOpenType(null);
                      }}
                    >
                      <img src={recipeImage(r.name)} alt="" className="progress-fav-row__img" />
                      <span className="filter-list__label">{r.name}</span>
                    </button>
                  ))}
                </div>
              </FilterPopover>
            </div>
          );
        })}
      </div>
    </>
  );
}
