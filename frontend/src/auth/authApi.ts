const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export interface AuthUser { id: string; email: string; display_name: string; avatar_url: string | null; }
export interface AuthResponse { access_token: string; user: AuthUser; }

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
export const postGoogle = (credential: string) => post<AuthResponse>("/auth/google", { credential });
export const postRefresh = () => post<AuthResponse>("/auth/refresh");
export const postLogout = () => post<void>("/auth/logout");
