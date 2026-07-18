import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import * as authApi from "./authApi";
import { sessionHint, tokenStore } from "./tokenStore";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const ADA = { id: "u1", email: "a@b.com", display_name: "Ada", avatar_url: null };

describe("useAuth", () => {
  it("settles to anonymous WITHOUT calling refresh when there is no session hint", async () => {
    const refresh = vi.spyOn(authApi, "postRefresh").mockRejectedValue(new Error("no session"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("restores an existing session on load when the hint is present", async () => {
    sessionHint.mark();
    vi.spyOn(authApi, "postRefresh").mockResolvedValue({ access_token: "a2", user: ADA });
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.status).toBe("checking");
    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.user?.display_name).toBe("Ada");
    expect(tokenStore.get()).toBe("a2");
  });

  it("clears the stale hint when a restore attempt fails", async () => {
    sessionHint.mark();
    vi.spyOn(authApi, "postRefresh").mockRejectedValue(new Error("expired"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    expect(sessionHint.present()).toBe(false);
  });

  it("login stores the token, user and session hint", async () => {
    vi.spyOn(authApi, "postGoogle").mockResolvedValue({ access_token: "a1", user: ADA });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    await act(async () => { await result.current.login("id-token"); });
    expect(result.current.status).toBe("authenticated");
    expect(result.current.user?.display_name).toBe("Ada");
    expect(tokenStore.get()).toBe("a1");
    expect(sessionHint.present()).toBe(true);
  });

  it("logout clears token, hint and state", async () => {
    vi.spyOn(authApi, "postLogout").mockResolvedValue(undefined);
    vi.spyOn(authApi, "postGoogle").mockResolvedValue({ access_token: "a1", user: ADA });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    await act(async () => { await result.current.login("id-token"); });
    await act(async () => { await result.current.logout(); });
    expect(result.current.status).toBe("anonymous");
    expect(tokenStore.get()).toBeNull();
    expect(sessionHint.present()).toBe(false);
  });
});
