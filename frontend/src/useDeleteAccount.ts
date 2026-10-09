// Deleting the signed-in account: the server call, then everything the client must forget.
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AccountSummary } from "./account";
import { api } from "./api/client";
import { useAuth } from "./auth/AuthContext";
import { useI18n } from "./i18n";
import { track } from "./telemetry/analytics";

export function useDeleteAccount(onDeleted: () => void): {
  remove: (summary: AccountSummary) => void;
  pending: boolean;
  error: string | null;
  reset: () => void;
} {
  const qc = useQueryClient();
  const { clearSession } = useAuth();
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: (_summary: AccountSummary) => api.deleteAccount(),
    onSuccess: (_void, summary) => {
      // Counts only, and only once the server confirmed: never email or name.
      track({
        name: "account_deleted",
        props: { box_size: summary.boxSize, saved_teams: summary.savedTeams },
      });
      qc.clear();
      clearSession();
      onDeleted();
    },
  });

  return {
    remove: (summary) => mutation.mutate(summary),
    pending: mutation.isPending,
    error: mutation.isError ? t("account.deleteFailed") : null,
    reset: mutation.reset,
  };
}
