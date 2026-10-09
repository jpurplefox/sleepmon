import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./GoogleSignInButton", () => ({ GoogleSignInButton: () => null }));

import { LanguageProvider } from "../i18n";
import { recordEvents } from "../telemetry/testing";
import { GateCard } from "./GateCard";

describe("GateCard", () => {
  it("records a page-gate prompt when shown", () => {
    const rec = recordEvents();
    render(<LanguageProvider><GateCard /></LanguageProvider>);
    expect(rec.events).toEqual([{ name: "sign_in_prompted", props: { reason: "page_gate" } }]);
    rec.restore();
  });
});
