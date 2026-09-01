import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { api } from "./api/client";
import { useAuth } from "./auth/AuthContext";
import { EMPTY_PROGRESS } from "./progress";
import type { PlayerProgress, ProgressPatch } from "./types";

const KEY = ["progress"] as const;

// Identifies which send an onSuccess callback belongs to, so a response for a
// send that has since been superseded can be told apart from the newest one.
interface SendContext {
  id: number;
}

/**
 * The user's saved progress, and a sparse save. Falls back to the defaults while
 * loading, on error, or with no session — which is exactly what a brand-new account
 * reads anyway. Team Analysis mounts this while anonymous, so the read only fires
 * once signed in: /progress is reserved and would answer 401.
 */
export function useProgress(): {
  progress: PlayerProgress;
  isLoading: boolean;
  isError: boolean;
  save: (patch: ProgressPatch) => void;
  /** Same mutation as `save`, awaitable — lets a caller (Player progress's
   * Guardar) know whether the save succeeded before deciding to close. */
  saveAsync: (patch: ProgressPatch) => Promise<PlayerProgress>;
  saveError: Error | null;
} {
  const client = useQueryClient();
  const { status } = useAuth();
  const query = useQuery({
    queryKey: KEY,
    queryFn: api.getProgress,
    enabled: status === "authenticated",
  });
  const latestSend = useRef(0);

  const mutation = useMutation<
    PlayerProgress,
    Error,
    ProgressPatch,
    SendContext
  >({
    mutationFn: api.patchProgress,
    onMutate: () => ({ id: ++latestSend.current }),
    // Responses can land out of order; only the newest send may write the
    // cache, so a stale one never clobbers a fresher document.
    onSuccess: (updated, _patch, context) => {
      if (context.id === latestSend.current) client.setQueryData(KEY, updated);
    },
  });

  return {
    progress: query.data ?? EMPTY_PROGRESS,
    isLoading: query.isLoading,
    isError: query.isError,
    save: mutation.mutate,
    saveAsync: mutation.mutateAsync,
    saveError: mutation.error,
  };
}
