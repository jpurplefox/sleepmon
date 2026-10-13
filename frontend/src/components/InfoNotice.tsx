import type { ReactNode } from "react";

import { IconClose } from "./icons";

/** A dismissible note about the numbers on screen (design system: info notice). Never an error. */
export function InfoNotice({
  icon,
  onDismiss,
  dismissLabel,
  children,
}: {
  icon: ReactNode;
  onDismiss: () => void;
  dismissLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="info-notice">
      <span className="info-notice__icon" aria-hidden="true">{icon}</span>
      <p>{children}</p>
      <button type="button" className="icon-btn" onClick={onDismiss} aria-label={dismissLabel} title={dismissLabel}>
        <IconClose />
      </button>
    </div>
  );
}
