import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./AuthContext", () => ({ useAuth: () => ({ status: "anonymous" }) }));
vi.mock("./GoogleSignInButton", () => ({ GoogleSignInButton: () => null }));

import { LanguageProvider } from "../i18n";
import type { SignInReason } from "../telemetry/events";
import { SignInDialog } from "./SignInDialog";
import { GateProvider, useGate } from "./useGate";

let guard: ReturnType<typeof useGate>["guard"];
function Trigger() {
  guard = useGate().guard;
  return null;
}

function openFor(reason: Exclude<SignInReason, "page_gate">) {
  localStorage.setItem("sleepmon.lang", "en");
  render(
    <LanguageProvider>
      <GateProvider>
        <Trigger />
        <SignInDialog />
      </GateProvider>
    </LanguageProvider>,
  );
  act(() => guard(() => {}, reason));
}

describe("SignInDialog", () => {
  it("explains the box when a box action asks for a session", () => {
    openFor("my_pokemon");
    expect(screen.getByText(/Your box keeps your Pokémon/)).toBeInTheDocument();
  });

  it("explains screenshot reading, not the box, when importing asks for a session", () => {
    openFor("import_screenshots");
    expect(screen.getByText(/Reading game screenshots is reserved for registered users/)).toBeInTheDocument();
    expect(screen.queryByText(/Your box/)).not.toBeInTheDocument();
  });

  it("explains shared links, and that the image needs no account, when a link asks for a session", () => {
    openFor("share_link");
    expect(screen.getByText(/Sign in with Google to create a link/)).toBeInTheDocument();
    expect(screen.queryByText(/Your box/)).not.toBeInTheDocument();
  });
});
