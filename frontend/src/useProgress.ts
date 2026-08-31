import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { api } from "./api/client";
import { EMPTY_PROGRESS } from "./progress";
import type { PlayerProgress, ProgressPatch } from "./types";

const KEY = ["progress"] as const;

// Identifies which send an onSuccess callback belongs to, so a response for a
// send that has since been superseded can be told apart from the newest one.
interface SendContext {
  id: number;
}

/**
 * The user's saved progress, and a sparse save. Only mounted behind the auth gate,
 * so there is no anonymous case. Falls back to the defaults while loading or on
 * error, which is exactly what a brand-new account reads anyway.
 */
export function useProgress(): {
  progress: PlayerProgress;
  isLoading: boolean;
  isError: boolean;
  save: (patch: ProgressPatch) => void;
  saveError: Error | null;
} {
  const client = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: api.getProgress });
  const latestSend = useRef(0);

  const mutation = useMutation<PlayerProgress, Error, ProgressPatch, SendContext>({
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
    saveError: mutation.error,
  };
}
