import type { Catalog, Member, MemberInput, Production, ProductionInput } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
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
};
