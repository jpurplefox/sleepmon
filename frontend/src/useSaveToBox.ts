// Saving a roster entry to the Box, with its feedback. Shared by Comparison and
// Team Analysis so neither carries save state in its own entry model.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { api } from "./api/client";
import type { RosterEntry } from "./roster";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface SaveStatus {
  state: SaveState;
  error?: string | null;
}

const IDLE: SaveStatus = { state: "idle" };

// How long "saved" stays on screen before fading back to idle. The durable
// answer to "is this saved?" is the icon's in-box tint, not this.
const SAVED_MS = 2500;

export function useSaveToBox(): {
  save: (entry: RosterEntry, onCreated?: (memberId: string) => void) => void;
  statusOf: (entryId: string) => SaveStatus;
  reset: (entryId: string) => void;
} {
  const qc = useQueryClient();
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const timers = useRef<Record<string, number>>({});

  const setStatus = useCallback((entryId: string, status: SaveStatus) => {
    setStatuses((prev) => ({ ...prev, [entryId]: status }));
  }, []);

  const mutation = useMutation({
    mutationFn: (vars: { entry: RosterEntry; onCreated?: (memberId: string) => void }) =>
      vars.entry.sourceId
        ? api.updateMember(vars.entry.sourceId, vars.entry.config)
        : api.createMember(vars.entry.config),
    onMutate: (vars) => setStatus(vars.entry.id, { state: "saving" }),
    onSuccess: (member, vars) => {
      setStatus(vars.entry.id, { state: "saved" });
      if (!vars.entry.sourceId) vars.onCreated?.(member.id);
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["distributions"] });
      window.clearTimeout(timers.current[vars.entry.id]);
      timers.current[vars.entry.id] = window.setTimeout(() => {
        setStatuses((prev) =>
          prev[vars.entry.id]?.state === "saved"
            ? { ...prev, [vars.entry.id]: IDLE }
            : prev,
        );
      }, SAVED_MS);
    },
    onError: (err: Error, vars) =>
      setStatus(vars.entry.id, { state: "error", error: err.message }),
  });

  const save = useCallback(
    (entry: RosterEntry, onCreated?: (memberId: string) => void) =>
      mutation.mutate({ entry, onCreated }),
    [mutation],
  );

  const statusOf = useCallback((entryId: string) => statuses[entryId] ?? IDLE, [statuses]);

  // Drops one entry's status back to idle. Callers use this on edit: the old
  // feedback (saved or errored) describes a config that no longer applies.
  const reset = useCallback((entryId: string) => {
    window.clearTimeout(timers.current[entryId]);
    setStatuses((prev) => (entryId in prev ? { ...prev, [entryId]: IDLE } : prev));
  }, []);

  return { save, statusOf, reset };
}
