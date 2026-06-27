import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

import { IconClose } from "./icons";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Cerrar con Escape, atrapar el foco con Tab dentro del panel y bloquear el
  // scroll del fondo mientras está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
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

  // Al abrir, mover el foco al primer elemento interactivo del panel; al cerrar,
  // devolver el foco al elemento que abrió el modal.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
    return () => opener?.focus();
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <IconClose />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
