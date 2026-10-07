import { useState } from "react";

import { useI18n } from "../i18n";
import type { Lang } from "../i18n";
import { FilterPopover, gridKeyDown } from "./FilterPopover";
import { IconGlobe } from "./icons";

const LANGS: Lang[] = ["es", "en"];

/** Language control for signed-out visitors; signed in, it lives in the account menu. */
export function LanguageMenu() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <FilterPopover
      open={open}
      onOpenChange={setOpen}
      triggerLabel={t("nav.language")}
      triggerClassName="lang-btn"
      triggerContent={
        <span className="filter-btn__value">
          <IconGlobe />
          {lang.toUpperCase()}
        </span>
      }
    >
      <div className="filter-list" role="listbox" aria-label={t("nav.language")} onKeyDown={gridKeyDown}>
        {LANGS.map((code) => (
          <button
            key={code}
            type="button"
            role="option"
            aria-selected={lang === code}
            className={"filter-list__item" + (lang === code ? " is-selected" : "")}
            onClick={() => {
              setLang(code);
              setOpen(false);
            }}
          >
            <span className="filter-list__label">{t(`lang.${code}`)}</span>
          </button>
        ))}
      </div>
    </FilterPopover>
  );
}
