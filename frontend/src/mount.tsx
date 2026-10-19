import { StrictMode, type ReactNode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import { reportError } from "./telemetry/sentry";

/** Hydrates the prerendered landing when the boot script kept it, otherwise renders from scratch (ADR-0013). */
export function mountApp(root: HTMLElement, app: ReactNode): void {
  const html = document.documentElement;
  if (html.getAttribute("data-prerender") === "skip") {
    root.replaceChildren();
    html.removeAttribute("data-prerender");
  }
  const tree = <StrictMode>{app}</StrictMode>;
  if (root.hasChildNodes()) {
    // Logged as React would by default, and reported, so a mismatch shows with or without Sentry.
    hydrateRoot(root, tree, {
      onRecoverableError: (error) => {
        console.error(error);
        reportError(error, { phase: "hydration" });
      },
    });
  } else {
    createRoot(root).render(tree);
  }
}
