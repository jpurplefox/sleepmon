import type {
  Catalog,
  Member,
  MemberInput,
  Production,
  ProductionInput,
  Recipe,
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

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, authedInit(init));
  if (res.status === 401 && retry) {
    if (await refreshOnce()) return request<T>(path, init, false);
  }
  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // respuesta sin cuerpo JSON
    }
    throw new Error(detail);
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
        island_bonus: data.island_bonus ?? 0,
        good_camp_ticket: data.good_camp_ticket ?? false,
      }),
    }),
};
