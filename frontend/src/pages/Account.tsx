import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Link } from "wouter";

import { accountSummary, isDefaultProgress } from "../account";
import { api } from "../api/client";
import { initials } from "../auth/ProfileMenu";
import { useAuth } from "../auth/AuthContext";
import { DeleteAccountDialog } from "../components/DeleteAccountDialog";
import { IconTrash } from "../components/icons";
import { ToolHeader } from "../components/ToolHeader";
import { useI18n } from "../i18n";
import { ROUTES } from "../routes";
import { useProgress } from "../useProgress";
import { useSavedTeamsQuery } from "../useSavedTeams";

/** "Your account": who is signed in, what is saved, and the way out (PRD 0018). */
export function Account({ onDeleted }: { onDeleted: () => void }) {
  const { t } = useI18n();
  const { user, status } = useAuth();
  const [photoBroken, setPhotoBroken] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const needsDataId = useId();

  // Guarded like every Box read, so clearing the session after a deletion stops it.
  const members = useQuery({
    queryKey: ["members"],
    queryFn: api.listMembers,
    enabled: status === "authenticated",
  });
  const teams = useSavedTeamsQuery();
  const progress = useProgress();

  if (!user) return null;

  const loading = members.isLoading || teams.isLoading || progress.isLoading;
  const failed = members.isError || teams.isError || progress.isError;
  // Once nothing is in flight, a failure offers Retry (and explains the disabled delete).
  const needsRetry = !loading && failed;
  const showPhoto = Boolean(user.avatar_url) && !photoBroken;

  // What each row reads: its value, "—" if that query failed, "…" while loading.
  const value = (ready: boolean, errored: boolean, text: () => string) =>
    ready ? text() : errored ? "—" : "…";
  const boxSize = members.data?.length ?? 0;
  const teamCount = teams.data?.length ?? 0;
  // The dialog states, and the event records, real counts only: no summary (and no
  // way to delete) until all three have loaded.
  const summary =
    members.isSuccess && teams.isSuccess && !progress.isLoading && !progress.isError
      ? accountSummary(members.data, teams.data, progress.progress)
      : null;

  const retry = () => {
    void members.refetch();
    void teams.refetch();
    progress.refetch();
  };

  return (
    <div className="layout">
      <div className="doc-page">
        <ToolHeader title={t("account.title")} />

        <section className="card doc-identity">
          <div className="avatar-lg doc-identity__avatar">
            {showPhoto ? (
              <img src={user.avatar_url ?? ""} alt="" onError={() => setPhotoBroken(true)} />
            ) : (
              initials(user.display_name)
            )}
          </div>
          <div>
            <div className="doc-identity__name">{user.display_name}</div>
            <div className="doc-identity__mail">{t("account.googleAccount", { email: user.email })}</div>
          </div>
        </section>

        <section className="card">
          <h2>{t("account.savedTitle")}</h2>
          <dl className="doc-dl">
            <dt>{t("account.box")}</dt>
            <dd>
              {value(members.isSuccess, members.isError, () =>
                boxSize === 0 ? t("account.boxEmpty") : t("account.boxCount", { n: boxSize }),
              )}
            </dd>
            <dt>{t("account.teams")}</dt>
            <dd>{value(teams.isSuccess, teams.isError, () => (teamCount === 0 ? t("account.teamsNone") : String(teamCount)))}</dd>
            <dt>{t("account.profile")}</dt>
            <dd>
              {value(!progress.isLoading && !progress.isError, progress.isError, () =>
                isDefaultProgress(progress.progress) ? t("account.profileNotSaved") : t("account.profileSaved"),
              )}
            </dd>
          </dl>
          {needsRetry && (
            <p className="error" role="alert">
              {t("account.loadError")}{" "}
              <button type="button" className="btn btn--ghost" onClick={retry}>
                {t("common.retry")}
              </button>
            </p>
          )}
          <p className="doc-note">
            {t("account.privacyLead")}{" "}
            <Link href={ROUTES.privacy}>{t("account.privacyLink")}</Link>
          </p>
        </section>

        <section className="card">
          <h2>{t("account.deleteCardTitle")}</h2>
          <p className="muted">{t("account.deleteCardBody")}</p>
          <button
            type="button"
            className="btn btn--delete"
            disabled={summary === null}
            aria-describedby={needsRetry ? needsDataId : undefined}
            onClick={() => setDeleting(true)}
          >
            <IconTrash className="mini-icon" />
            {t("account.deleteEntry")}
          </button>
          {needsRetry && (
            <p className="muted" id={needsDataId}>
              {t("account.deleteNeedsData")}
            </p>
          )}
        </section>
      </div>
      {deleting && summary && (
        <DeleteAccountDialog
          email={user.email}
          summary={summary}
          onClose={() => setDeleting(false)}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
