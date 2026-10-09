// Deleting the signed-in account: the server call, then everything the client must forget.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { flushSync } from "react-dom";

import type { AccountSummary } from "./account";
import { api } from "./api/client";
import { useAuth } from "./auth/AuthContext";
import { useComparisonSession } from "./comparisonSession";
import { useI18n } from "./i18n";
import { useTeamSession } from "./teamSession";
import { track } from "./telemetry/analytics";

export function useDeleteAccount(onDeleted: () => void): {
  remove: (summary: AccountSummary) => void;
  pending: boolean;
  error: string | null;
  reset: () => void;
} {
  const qc = useQueryClient();
  const { clearSession } = useAuth();
  const comparison = useComparisonSession();
  const team = useTeamSession();
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: (_summary: AccountSummary) => api.deleteAccount(),
    onSuccess: (_void, summary) => {
      // Counts only, and only once the server confirmed: never email or name.
      track({
        name: "account_deleted",
        props: { box_size: summary.boxSize, saved_teams: summary.savedTeams },
      });
      // Commit the signed-out state before anything else renders: the navigation in
      // onDeleted renders synchronously, and a page mounting while auth still reads
      // "authenticated" would fetch the (now gone) Box without a token.
      flushSync(() => clearSession());
      qc.clear();
      // What is on screen stays, as after signing out, but its Box no longer exists.
      comparison.unlinkFromBox();
      team.unlinkFromBox();
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
