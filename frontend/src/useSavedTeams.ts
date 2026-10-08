// Saved teams' server state and the save flow (PRD 0016). Saving writes the
// Pokémon the team needs into the Box first, then the team itself.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api/client";
import { useAuth } from "./auth/AuthContext";
import type { MembersById, TeamDefinition } from "./savedTeams";
import { boxWritesFor, toSavedTeamInput } from "./savedTeams";
import { linkToBox } from "./teamRoster";
import type { Catalog, SavedTeam } from "./types";

export const SAVED_TEAMS_KEY = ["saved-teams"] as const;

export function useSavedTeamsQuery() {
  const { status } = useAuth();
  return useQuery({
    queryKey: SAVED_TEAMS_KEY,
    queryFn: api.listSavedTeams,
    enabled: status === "authenticated",
  });
}

export interface SaveTeamArgs {
  name: string;
  /** The team to save over, or null to create a new one. */
  overId: string | null;
  definition: TeamDefinition;
  members: MembersById;
  catalog: Catalog;
  /** Links an entry created on the spot to its new Box id in the session. */
  onLinked: (entryId: string, memberId: string) => void;
}

/** Writes the Box Pokémon the team needs, then the team. Resolves to the saved team. */
async function saveTeam(args: SaveTeamArgs): Promise<SavedTeam> {
  let slots = args.definition.slots;
  for (const write of boxWritesFor(slots, args.members, args.catalog)) {
    const { entry } = write;
    const existing = entry.sourceId && args.members.has(entry.sourceId) ? entry.sourceId : null;
    if (existing) {
      await api.updateMember(existing, entry.config);
    } else {
      const created = await api.createMember(entry.config);
      slots = linkToBox(slots, entry.id, created.id);
      args.onLinked(entry.id, created.id);
    }
  }
  const input = toSavedTeamInput(args.name, { ...args.definition, slots });
  return args.overId === null
    ? api.createSavedTeam(input)
    : api.replaceSavedTeam(args.overId, input);
}

export function useSaveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveTeam,
    // Into the cache at once: until the refetch lands, the list would not hold the
    // team just saved, and the session would read its open team as deleted.
    onSuccess: (team) =>
      qc.setQueryData<SavedTeam[]>(SAVED_TEAMS_KEY, (old) => [
        team,
        ...(old ?? []).filter((t) => t.id !== team.id),
      ]),
    onSettled: () => {
      // Box writes may have landed even when the team itself failed.
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["distributions"] });
      qc.invalidateQueries({ queryKey: SAVED_TEAMS_KEY });
    },
  });
}

export function useRenameTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; name: string }) => api.renameSavedTeam(vars.id, vars.name.trim()),
    onSuccess: () => qc.invalidateQueries({ queryKey: SAVED_TEAMS_KEY }),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSavedTeam(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: SAVED_TEAMS_KEY }),
  });
}
