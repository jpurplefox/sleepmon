// Test helper: records what `track` / `identify` / `registerContext` send.
import { __setSink } from "./analytics";
import type { AnalyticsEvent } from "./events";

export function recordEvents(): {
  events: AnalyticsEvent[];
  identities: (string | null)[];
  contexts: Record<string, unknown>[];
  restore: () => void;
} {
  const events: AnalyticsEvent[] = [];
  const identities: (string | null)[] = [];
  const contexts: Record<string, unknown>[] = [];
  const restore = __setSink({
    capture: (name, props) => events.push({ name, props } as AnalyticsEvent),
    identify: (id) => identities.push(id),
    reset: () => identities.push(null),
    register: (props) => contexts.push(props),
  });
  return { events, identities, contexts, restore };
}
