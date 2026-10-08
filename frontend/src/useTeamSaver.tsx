// The session's relation to its saved team, and the save / open / close flows
// shared by Team Analysis and the Teams tool (PRD 0016).
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "wouter";

import { api } from "./api/client";
import { useAuth } from "./auth/AuthContext";
import { ExitConfirm } from "./components/ExitConfirm";
import { Modal } from "./components/Modal";
import { TeamNameDialog } from "./components/TeamNameDialog";
import { useI18n } from "./i18n";
import { recipeLevelOf } from "./progress";
import { ROUTES } from "./routes";
import {
  boxWritesFor,
  definitionFromSavedTeam,
  isUnsaved,
  membersById,
  type MembersById,
} from "./savedTeams";
import { EMPTY_DEFINITION, useTeamSession } from "./teamSession";
import { linkToBox } from "./teamRoster";
import type { Catalog, SavedTeam } from "./types";
import { useProgress } from "./useProgress";
import { useRenameTeam, useSaveTeam, useSavedTeamsQuery } from "./useSavedTeams";

/** The open saved team (if it still exists) and whether the session has work a replace would lose. */
export function useOpenTeam(catalog: Catalog | undefined): {
  teams: SavedTeam[];
  openTeam: SavedTeam | null;
  /** The open team differs from what is saved. */
  unsaved: boolean;
  /** Replacing the session would lose something: unsaved changes, or an unsaved new team. */
  dirty: boolean;
  members: MembersById;
  ready: boolean;
} {
  const { status } = useAuth();
  const session = useTeamSession();
  const saved = useSavedTeamsQuery();
  const membersQuery = useQuery({
    queryKey: ["members"],
    queryFn: api.listMembers,
    enabled: status === "authenticated",
  });
  const teams = saved.data ?? [];
  const members = membersById(membersQuery.data);
  const openTeam = teams.find((t) => t.id === session.openTeamId) ?? null;
  const ready = saved.isSuccess && membersQuery.isSuccess && catalog !== undefined;

  // A deleted (or signed-out) open team leaves its roster as a team not yet saved.
  const { openTeamId, setOpenTeamId } = session;
  useEffect(() => {
    if (openTeamId === null) return;
    if (status === "anonymous" || (saved.isSuccess && !saved.data.some((t) => t.id === openTeamId)))
      setOpenTeamId(null);
  }, [openTeamId, setOpenTeamId, status, saved.isSuccess, saved.data]);

  const unsaved =
    openTeam !== null && ready && catalog !== undefined
      ? isUnsaved(session.definition, openTeam, members, catalog)
      : false;
  const dirty = openTeam !== null ? unsaved : session.slots.length > 0;
  return { teams, openTeam, unsaved, dirty, members, ready };
}

type Dialog =
  | { kind: "name"; mode: "new" | "saveAs"; then?: () => void }
  | { kind: "over"; then?: () => void }
  | { kind: "replace"; then: () => void }
  | { kind: "rename" };

/**
 * Save, Save as…, open and close for the session's team. Returns the actions and
 * the dialog node the caller renders.
 */
export function useTeamSaver(catalog: Catalog | undefined) {
  const { t } = useI18n();
  const session = useTeamSession();
  const { teams, openTeam, unsaved, dirty, members, ready } = useOpenTeam(catalog);
  const { progress } = useProgress();
  const mutation = useSaveTeam();
  const renameMutation = useRenameTeam();
  const [, navigate] = useLocation();
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const writes = catalog ? boxWritesFor(session.slots, members, catalog) : [];

  const run = (name: string, overId: string | null, then?: () => void) => {
    if (!catalog) return;
    mutation.mutate(
      {
        name,
        overId,
        definition: session.definition,
        members,
        catalog,
        onLinked: (entryId, memberId) =>
          session.setSlots((prev) => linkToBox(prev, entryId, memberId)),
      },
      {
        onSuccess: (team) => {
          session.setOpenTeamId(team.id);
          setDialog(null);
          then?.();
        },
      },
    );
  };

  /** Save over the open team (no dialog unless the Box needs writes), or name a new one. */
  const save = (then?: () => void) => {
    mutation.reset();
    if (openTeam === null) {
      setDialog({ kind: "name", mode: "new", then });
    } else if (writes.length > 0) {
      setDialog({ kind: "over", then });
    } else {
      run(openTeam.name, openTeam.id, then);
    }
  };

  const saveAs = () => {
    mutation.reset();
    setDialog({ kind: "name", mode: "saveAs" });
  };

  /** Runs `action` now, or after asking save / discard / cancel when it would lose work. */
  const guardReplace = (action: () => void) => {
    if (dirty) setDialog({ kind: "replace", then: action });
    else action();
  };

  const rename = () => {
    renameMutation.reset();
    setDialog({ kind: "rename" });
  };

  const open = (team: SavedTeam) => {
    if (!catalog) return;
    guardReplace(() => {
      const { definition, skipped } = definitionFromSavedTeam(team, members, catalog, (name) =>
        recipeLevelOf(progress, name),
      );
      session.load(definition, team.id);
      session.setNotice(skipped.length > 0 ? t("saved.skipped", { species: skipped.join(", ") }) : null);
      navigate(ROUTES.teamAnalysis);
    });
  };

  const close = () =>
    guardReplace(() => {
      session.load(EMPTY_DEFINITION, null);
      session.setNotice(null);
    });

  const closeDialog = () => {
    if (!mutation.isPending && !renameMutation.isPending) setDialog(null);
  };

  let node: ReactNode = null;
  if (dialog?.kind === "name") {
    node = (
      <TeamNameDialog
        title={dialog.mode === "new" ? t("saved.saveTitle") : t("saved.saveAsTitle")}
        initialName={dialog.mode === "saveAs" && openTeam ? openTeam.name : ""}
        teams={teams}
        ownId={null}
        writes={writes}
        confirmLabel={t("saved.save")}
        pending={mutation.isPending}
        serverError={mutation.error?.message ?? null}
        onConfirm={(name) => run(name, null, dialog.then)}
        onClose={closeDialog}
      />
    );
  } else if (dialog?.kind === "over" && openTeam) {
    node = (
      <TeamNameDialog
        title={t("saved.saveOverTitle", { name: openTeam.name })}
        initialName={null}
        teams={teams}
        ownId={openTeam.id}
        writes={writes}
        confirmLabel={t("saved.save")}
        pending={mutation.isPending}
        serverError={mutation.error?.message ?? null}
        onConfirm={() => run(openTeam.name, openTeam.id, dialog.then)}
        onClose={closeDialog}
      />
    );
  } else if (dialog?.kind === "rename" && openTeam) {
    node = (
      <TeamNameDialog
        title={t("saved.renameTitle")}
        initialName={openTeam.name}
        teams={teams}
        ownId={openTeam.id}
        confirmLabel={t("saved.save")}
        pending={renameMutation.isPending}
        serverError={renameMutation.error?.message ?? null}
        onConfirm={(name) =>
          renameMutation.mutate({ id: openTeam.id, name }, { onSuccess: () => setDialog(null) })
        }
        onClose={closeDialog}
      />
    );
  } else if (dialog?.kind === "replace") {
    const then = dialog.then;
    node = (
      <Modal title={t("saved.replaceTitle")} onClose={closeDialog}>
        <ExitConfirm
          message={
            openTeam ? t("saved.replaceOpen", { name: openTeam.name }) : t("saved.replaceNew")
          }
          discardLabel={t("saved.discard")}
          onCancel={closeDialog}
          onDiscard={() => {
            setDialog(null);
            then();
          }}
          onSave={() => save(then)}
        />
      </Modal>
    );
  }

  return {
    teams,
    openTeam,
    unsaved,
    dirty,
    members,
    ready,
    saving: mutation.isPending,
    saveError: dialog === null ? (mutation.error?.message ?? null) : null,
    save,
    saveAs,
    rename,
    open,
    close,
    dialog: node,
  };
}
