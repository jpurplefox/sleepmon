import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { IconMore } from "./icons";

export interface ActionMenuItem {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  /** Accessible name when the visible label needs its subject (e.g. the species). */
  ariaLabel?: string;
  /** A delete: red at rest (hover only says "clickable", and a phone has none). */
  tone?: "danger";
  /** Draws a separator above the item, to set a destructive action apart. */
  separated?: boolean;
}

/**
 * The "···" overflow menu for an item's actions (ARIA menu button). Opening focuses
 * the first item; arrows and Home/End move; Escape or a click outside closes and
 * returns focus to the trigger; Tab closes and lets focus move on.
 */
export function ActionMenu({ label, items }: { label: string; items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    wrapRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        // A click on another control takes focus itself; anywhere else, focus would
        // be lost to the body as the focused item unmounts, so it goes back to the trigger.
        const target = e.target as HTMLElement;
        if (!target.closest("a, button, input, select, textarea, [tabindex]")) {
          btnRef.current?.focus();
        }
      }
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
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

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    if (els.length === 0) return;
    const idx = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const delta = e.key === "ArrowDown" ? 1 : -1;
      els[(idx + delta + els.length) % els.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      els[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      els[els.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="action-menu" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="icon-btn action-menu__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <IconMore />
      </button>
      {open && (
        <div className="action-menu__pop" role="menu" onKeyDown={onMenuKeyDown}>
          {items.map((item) => (
            <div key={item.label} className="action-menu__group">
              {item.separated && <div className="action-menu__sep" role="separator" />}
              <button
                type="button"
                role="menuitem"
                className={
                  "action-menu__item" + (item.tone ? ` action-menu__item--${item.tone}` : "")
                }
                aria-label={item.ariaLabel}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
