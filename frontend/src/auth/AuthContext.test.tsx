import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import * as authApi from "./authApi";
import { tokenStore } from "./tokenStore";

afterEach(() => { tokenStore.clear(); localStorage.clear(); vi.restoreAllMocks(); });

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("useAuth", () => {
  it("starts checking, then settles to anonymous with no valid session", async () => {
    vi.spyOn(authApi, "postRefresh").mockRejectedValue(new Error("no session"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    // The mount-time postRefresh() restore hasn't resolved yet.
    expect(result.current.status).toBe("checking");
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
  });

  it("login stores the token and user", async () => {
    vi.spyOn(authApi, "postRefresh").mockRejectedValue(new Error("no session"));
    vi.spyOn(authApi, "postGoogle").mockResolvedValue({
      access_token: "a1", user: { id: "u1", email: "a@b.com", display_name: "Ada", avatar_url: null },
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    await act(async () => { await result.current.login("id-token"); });
    expect(result.current.status).toBe("authenticated");
    expect(result.current.user?.display_name).toBe("Ada");
    expect(tokenStore.get()).toBe("a1");
  });

  it("logout clears state", async () => {
    vi.spyOn(authApi, "postRefresh").mockRejectedValue(new Error("no session"));
    vi.spyOn(authApi, "postLogout").mockResolvedValue(undefined);
    tokenStore.set("a1");
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    await act(async () => { await result.current.logout(); });
    expect(result.current.status).toBe("anonymous");
    expect(tokenStore.get()).toBeNull();
  });
});
