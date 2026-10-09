import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./GoogleSignInButton", () => ({ GoogleSignInButton: () => null }));

import { LanguageProvider } from "../i18n";
import { recordEvents } from "../telemetry/testing";
import { GateCard } from "./GateCard";

describe("GateCard", () => {
  let rec: ReturnType<typeof recordEvents>;
  beforeEach(() => { rec = recordEvents(); });
  afterEach(() => rec.restore());

  it("records a page-gate prompt when shown", () => {
    render(<LanguageProvider><GateCard /></LanguageProvider>);
    expect(rec.events).toEqual([{ name: "sign_in_prompted", props: { reason: "page_gate" } }]);
  });
});
