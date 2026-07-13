import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// We use explicit imports (no Vitest globals), so RTL's automatic afterEach
// cleanup is not wired up — do it here for every component test.
afterEach(() => {
  cleanup();
});
