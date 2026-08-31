import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api/client";
import { EMPTY_PROGRESS } from "./progress";
import type { PlayerProgress, ProgressPatch } from "./types";

const KEY = ["progress"] as const;

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

  const mutation = useMutation({
    mutationFn: api.patchProgress,
    // PATCH returns the whole document, so the cache is refreshed without a refetch.
    onSuccess: (updated) => client.setQueryData(KEY, updated),
  });

  return {
    progress: query.data ?? EMPTY_PROGRESS,
    isLoading: query.isLoading,
    isError: query.isError,
    save: mutation.mutate,
    saveError: mutation.error,
  };
}
