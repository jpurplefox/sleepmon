// Test helper: records what `track` / `identify` / `registerContext` send.
import { __setSink } from "./analytics";
import type { AnalyticsEvent } from "./events";

export function recordEvents(): {
  events: AnalyticsEvent[];
  identities: (string | null)[];
  contexts: Record<string, unknown>[];
  /** Every sink call in order, to assert sequencing. */
  log: ("capture" | "identify" | "reset" | "register")[];
  restore: () => void;
} {
  const events: AnalyticsEvent[] = [];
  const identities: (string | null)[] = [];
  const contexts: Record<string, unknown>[] = [];
  const log: ("capture" | "identify" | "reset" | "register")[] = [];
  const restore = __setSink({
    capture: (name, props) => {
      log.push("capture");
      events.push({ name, props } as AnalyticsEvent);
    },
    identify: (id) => {
      log.push("identify");
      identities.push(id);
    },
    reset: () => {
      log.push("reset");
      identities.push(null);
    },
    register: (props) => {
      log.push("register");
      contexts.push(props);
    },
  });
  return { events, identities, contexts, log, restore };
}
