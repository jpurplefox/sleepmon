import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

import { useI18n } from "../i18n";
import { NAV_ITEMS } from "../routes";
import { IconMenu } from "./icons";

// Top navigation: one link per tool. Styled as tabs but backed by real URLs,
// so the active item reflects the current path (aria-current="page") instead of
// tablist selection. On narrow screens CSS swaps the tab row for a menu button
// whose panel lists the same links.
export function NavTabs() {
  const { t } = useI18n();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Any navigation closes the panel, including back/forward.
  useEffect(() => setOpen(false), [location]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = NAV_ITEMS.find((item) => item.path === location);

  // A separator sits between the groups (analysis | saved); decorative, so the
  // links stay the only thing a screen reader lists.
  const links = (className: string) =>
    NAV_ITEMS.map(({ path, labelKey, group }, i) => {
      const active = location === path;
      return (
        <Fragment key={path}>
          {i > 0 && NAV_ITEMS[i - 1].group !== group && (
            <span className="nav__sep" aria-hidden="true" />
          )}
          <Link
            href={path}
            className={className + (active ? ` ${className}--active` : "")}
            aria-current={active ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {t(labelKey)}
          </Link>
        </Fragment>
      );
    });

  return (
    <nav className="nav" aria-label={t("nav.aria")}>
      <div className="tabs">{links("tab")}</div>
      <div className="nav-menu" ref={menuRef}>
        <button
          ref={btnRef}
          type="button"
          className="nav-menu__btn"
          aria-expanded={open}
          aria-controls="nav-menu-panel"
          aria-label={current ? `${t("nav.menu")} — ${t(current.labelKey)}` : t("nav.menu")}
          onClick={() => setOpen((o) => !o)}
        >
          <IconMenu width={18} height={18} />
          {current && <span>{t(current.labelKey)}</span>}
        </button>
        {open && (
          <div className="nav-menu__panel" id="nav-menu-panel">
            {links("nav-menu__item")}
          </div>
        )}
      </div>
    </nav>
  );
}
