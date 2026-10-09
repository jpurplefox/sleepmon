import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

import { fitDropdownsIn } from "../fitDropdowns";
import { useI18n } from "../i18n";
import { IconClose } from "./icons";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /** Takes the full available height, so filtering its content never resizes it. */
  tall?: boolean;
  /** The content holds unsaved input: a tap outside, Escape or ✕ ask before discarding it. */
  dirty?: boolean;
}

export function Modal({ title, onClose, children, wide, tall, dirty = false }: Props) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const confirmId = useId();
  const [confirming, setConfirming] = useState(false);

  // Every way of leaving (✕, Escape, a tap outside) goes through here. With unsaved
  // input it asks first, over the content, which stays mounted so "Keep editing"
  // loses nothing; asked again while the question shows, it means "keep editing".
  const requestClose = () => {
    if (confirming) setConfirming(false);
    else if (dirty) setConfirming(true);
    else onClose();
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  // Cerrar con Escape, atrapar el foco con Tab dentro del panel y bloquear el
  // scroll del fondo mientras está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        requestCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      // While the discard question shows, Tab cycles inside it alone.
      const root = panel.querySelector<HTMLElement>(".modal-confirm") ?? panel;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // Al abrir, mover el foco a un elemento marcado con [data-autofocus] si existe
  // (p. ej. el campo de búsqueda del picker), o al primer interactivo del panel
  // en su defecto; al cerrar, devolver el foco al elemento que abrió el modal.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const target =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
    target?.focus();
    // preventScroll: the opener may sit in a swiped deck (the "+" slide), and
    // scrolling it into view would undo the pager bringing the new card in.
    return () => opener?.focus({ preventScroll: true });
  }, []);

  // Dropdowns opened inside fit the body, so only one thing scrolls.
  useEffect(
    () => (bodyRef.current ? fitDropdownsIn(bodyRef.current) : undefined),
    [],
  );

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <div
        className={
          "modal-panel" +
          (wide ? " modal-panel--wide" : "") +
          (tall ? " modal-panel--tall" : "")
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* `inert` while the question shows: the form stays mounted but out of reach. */}
        <header className="modal-head" {...inertIf(confirming)}>
          <h2 id={titleId}>{title}</h2>
          <button
            className="modal-close"
            onClick={requestClose}
            aria-label={t("common.close")}
          >
            <IconClose />
          </button>
        </header>
        <div className="modal-body" ref={bodyRef} {...inertIf(confirming)}>
          {children}
        </div>
        {confirming && (
          <div className="modal-confirm" role="alertdialog" aria-labelledby={confirmId}>
            <div className="modal-confirm__card">
              <p id={confirmId}>{t("modal.discardQuestion")}</p>
              <div className="modal-actions modal-actions--center">
                <button
                  ref={keepRef}
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setConfirming(false)}
                >
                  {t("modal.keepEditing")}
                </button>
                <button type="button" className="btn btn--danger" onClick={onClose}>
                  {t("modal.discard")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// React 18 has no typed `inert` prop; the attribute is set as a plain string.
function inertIf(on: boolean): Record<string, string> {
  return on ? { inert: "" } : {};
}
