import { Link, useLocation } from "wouter";

import { useI18n } from "../i18n";
import { NAV_ITEMS } from "../routes";

// Top navigation: one link per tool. Styled as tabs but backed by real URLs,
// so the active item reflects the current path (aria-current="page") instead of
// tablist selection.
export function NavTabs() {
  const { t } = useI18n();
  const [location] = useLocation();

  return (
    <nav className="tabs" aria-label={t("nav.aria")}>
      {NAV_ITEMS.map(({ path, labelKey }) => {
        const active = location === path;
        return (
          <Link
            key={path}
            href={path}
            className={"tab" + (active ? " tab--active" : "")}
            aria-current={active ? "page" : undefined}
          >
            {t(labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
