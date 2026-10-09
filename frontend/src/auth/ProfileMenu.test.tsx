import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logout = vi.fn();
vi.mock("./AuthContext", () => ({
  useAuth: () => ({
    user: { display_name: "Ana Perez", email: "a@x.com", avatar_url: null },
    logout,
  }),
}));

import { LanguageProvider } from "../i18n";
import { recordEvents } from "../telemetry/testing";
import { ProfileMenu } from "./ProfileMenu";

describe("ProfileMenu", () => {
  let rec: ReturnType<typeof recordEvents>;
  beforeEach(() => { rec = recordEvents(); logout.mockReset(); });
  afterEach(() => rec.restore());

  it("records signed_out and logs out", () => {
    render(<LanguageProvider><ProfileMenu /></LanguageProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Ana Perez/ }));
    const items = screen.getAllByRole("menuitem");
    fireEvent.click(items[items.length - 1]);
    expect(rec.events).toEqual([{ name: "signed_out", props: {} }]);
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
