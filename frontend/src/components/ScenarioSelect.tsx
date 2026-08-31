import { useState } from "react";

import { useI18n } from "../i18n";
import { SCENARIOS, scenarioOption, type Scenario } from "../scenarios";
import { FilterPopover, gridKeyDown } from "./FilterPopover";

interface Props {
  value: Scenario;
  onChange: (value: Scenario) => void;
}

/** The mark of an option, or nothing for the neutral scenario. */
function Mark({ mark }: { mark: string | null }) {
  return mark ? <span className="metric-mark metric-mark--good">{mark}</span> : null;
}

/**
 * The map assumption for the whole comparison. There is no "unset" state: the
 * neutral scenario has its own name, so the trigger always shows a value.
 */
export function ScenarioSelect({ value, onChange }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const current = scenarioOption(value);

  return (
    <div className="section-head prod-scenario">
      <FilterPopover
        open={open}
        onOpenChange={setOpen}
        triggerLabel={t("prod.scenario")}
        triggerContent={
          <span className="filter-btn__value">
            {t(current.labelKey)}
            <Mark mark={current.mark} />
          </span>
        }
      >
        <div
          className="filter-list"
          role="listbox"
          aria-label={t("prod.scenario")}
          onKeyDown={gridKeyDown}
        >
          {SCENARIOS.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={"filter-list__item" + (selected ? " is-selected" : "")}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="filter-list__label">{t(option.labelKey)}</span>
                <Mark mark={option.mark} />
              </button>
            );
          })}
        </div>
      </FilterPopover>
    </div>
  );
}
