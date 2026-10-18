import { useEffect } from "react";

// wouter dispatches pushState/replaceState events on navigation; the browser does the rest.
const EVENTS = ["pushState", "replaceState", "popstate", "hashchange"] as const;

/** Scrolls to the element with this id whenever the URL hash names it. */
export function useHashScroll(id: string): void {
  useEffect(() => {
    const scroll = () => {
      if (window.location.hash === `#${id}`) document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    scroll();
    EVENTS.forEach((e) => addEventListener(e, scroll));
    return () => EVENTS.forEach((e) => removeEventListener(e, scroll));
  }, [id]);
}
