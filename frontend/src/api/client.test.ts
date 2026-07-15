import { afterEach, describe, expect, it, vi } from "vitest";
import { api, __setRefreshHandler } from "./client";
import { tokenStore } from "../auth/tokenStore";

afterEach(() => { tokenStore.clear(); vi.restoreAllMocks(); localStorage.clear(); });

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("api client auth", () => {
  it("attaches the bearer token", async () => {
    tokenStore.set("access-1");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]));
    await api.listMembers();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer access-1");
  });

  it("refreshes once on 401 then retries", async () => {
    tokenStore.set("expired");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ detail: "unauthorized" }, 401))  // first call
      .mockResolvedValueOnce(jsonResponse([]));                               // retry
    __setRefreshHandler(async () => { tokenStore.set("access-2"); return true; });
    const result = await api.listMembers();
    expect(result).toEqual([]);
    const retryInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect((retryInit.headers as Record<string, string>)["Authorization"]).toBe("Bearer access-2");
  });

  it("propagates the error when refresh fails", async () => {
    tokenStore.set("expired");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ detail: "unauthorized" }, 401));
    __setRefreshHandler(async () => false);
    await expect(api.listMembers()).rejects.toThrow();
  });
});
