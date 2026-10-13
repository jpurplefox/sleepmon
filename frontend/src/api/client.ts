import type {
  Catalog,
  ComparisonShare,
  ComparisonShareInput,
  Member,
  MemberInput,
  PlayerProgress,
  Production,
  ProductionInput,
  ProgressPatch,
  Recipe,
  SavedTeam,
  ScreenshotImport,
  ShotPayload,
  SavedTeamInput,
  TeamProduction,
  TeamProductionInput,
} from "../types";
import { tokenStore } from "../auth/tokenStore";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// Injected by AuthContext (Task 13). Returns true if a new access token is now available.
type RefreshHandler = () => Promise<boolean>;
let refreshHandler: RefreshHandler = async () => false;
export function __setRefreshHandler(h: RefreshHandler): void {
  refreshHandler = h;
}

let inFlight: Promise<boolean> | null = null; // single-flight refresh
function refreshOnce(): Promise<boolean> {
  if (!inFlight) {
    inFlight = refreshHandler().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

function authedInit(init?: RequestInit): RequestInit {
  const token = tokenStore.get();
  return {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, authedInit(init));
  if (res.status === 401 && retry) {
    if (await refreshOnce()) return request<T>(path, init, false);
  }
  if (!res.ok) {
    let detail = `Error ${res.status}`;
    let body: unknown = null;
    try {
      body = await res.json();
      const d = (body as { detail?: unknown } | null)?.detail;
      if (d) detail = String(d);
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new ApiError(detail, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  getCatalog: () => request<Catalog>("/catalog"),
  listMembers: () => request<Member[]>("/team"),
  createMember: (data: MemberInput) =>
    request<Member>("/team", { method: "POST", body: JSON.stringify(data) }),
  updateMember: (id: string, data: MemberInput) =>
    request<Member>(`/team/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteMember: (id: string) => request<void>(`/team/${id}`, { method: "DELETE" }),
  computeProduction: (data: ProductionInput) =>
    request<Production>("/production", { method: "POST", body: JSON.stringify(data) }),
  getRecipes: () => request<Recipe[]>("/recipes"),
  computeTeamProduction: (data: TeamProductionInput) =>
    request<TeamProduction>("/teams/production", {
      method: "POST",
      body: JSON.stringify({
        slots: data.slots,
        meals: data.meals,
        favorite_berries: data.favorite_berries ?? [],
        island: data.island ?? null,
        main_favorite: data.main_favorite ?? null,
        weekly_bonus: data.weekly_bonus ?? null,
        island_bonus: data.island_bonus ?? 0,
        good_camp_ticket: data.good_camp_ticket ?? false,
        pot_size: data.pot_size,
        event_effects: data.event_effects ?? [],
      }),
    }),
  getProgress: () => request<PlayerProgress>("/progress"),
  patchProgress: (patch: ProgressPatch) =>
    request<PlayerProgress>("/progress", { method: "PATCH", body: JSON.stringify(patch) }),
  listSavedTeams: () => request<SavedTeam[]>("/saved-teams"),
  createSavedTeam: (data: SavedTeamInput) =>
    request<SavedTeam>("/saved-teams", { method: "POST", body: JSON.stringify(data) }),
  replaceSavedTeam: (id: string, data: SavedTeamInput) =>
    request<SavedTeam>(`/saved-teams/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  renameSavedTeam: (id: string, name: string) =>
    request<SavedTeam>(`/saved-teams/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteSavedTeam: (id: string) => request<void>(`/saved-teams/${id}`, { method: "DELETE" }),
  deleteAccount: () => request<void>("/auth/account", { method: "DELETE" }),
  importScreenshots: (images: ShotPayload[]) =>
    request<ScreenshotImport>("/screenshot-import", { method: "POST", body: JSON.stringify({ images }) }),
  createComparisonShare: (data: ComparisonShareInput) =>
    request<ComparisonShare>("/comparison-shares", { method: "POST", body: JSON.stringify(data) }),
  getComparisonShare: (id: string) =>
    request<ComparisonShare>(`/comparison-shares/${encodeURIComponent(id)}`),
};
